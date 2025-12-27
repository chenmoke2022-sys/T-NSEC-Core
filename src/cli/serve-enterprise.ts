/**
 * serve-enterprise.ts
 *
 * Production-oriented HTTP server:
 * - Auth (optional API key)
 * - Rate limiting (token bucket, in-memory)
 * - Health/ready endpoints
 * - Prometheus-style /metrics
 * - Unified inference endpoint (routes to draft/verify models via Ollama)
 *
 * No UI, no interactive prompts.
 */

import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

type InferRequest = {
  prompt: string;
  model?: 'draft' | 'verify';
  maxTokens?: number;
  temperature?: number;
};

type InferResponse = {
  text: string;
  tokens: number;
  durationMs: number;
  tokensPerSecond: number;
  model: string;
  requestId: string;
};

function nowMs() {
  return Date.now();
}

function json(res: http.ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getRequestId(req: http.IncomingMessage) {
  const h = req.headers['x-request-id'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  return crypto.randomUUID();
}

function getClientKey(req: http.IncomingMessage) {
  const xf = req.headers['x-forwarded-for'];
  const ip = typeof xf === 'string' && xf.trim()
    ? xf.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';
  return ip;
}

function parseBearer(authz: string | undefined): string | null {
  if (!authz) return null;
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
}

type TokenBucket = {
  tokens: number;
  lastRefillMs: number;
};

function createRateLimiter(rps: number, burst: number) {
  const buckets = new Map<string, TokenBucket>();
  const refillPerMs = rps / 1000;

  function allow(key: string): boolean {
    const t = nowMs();
    const b = buckets.get(key) || { tokens: burst, lastRefillMs: t };
    const dt = Math.max(0, t - b.lastRefillMs);
    b.tokens = Math.min(burst, b.tokens + dt * refillPerMs);
    b.lastRefillMs = t;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      buckets.set(key, b);
      return true;
    }
    buckets.set(key, b);
    return false;
  }

  return { allow };
}

async function ollamaGenerate(baseUrl: string, model: string, prompt: string, opts: { temperature: number; num_predict: number }) {
  const url = new URL('/api/generate', baseUrl);
  const payload = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: opts.temperature,
      num_predict: opts.num_predict,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`ollama_generate_failed status=${r.status} ${r.statusText} body=${txt}`);
  }
  const data: any = await r.json();
  return String(data.response ?? '');
}

type Metrics = {
  startedAtMs: number;
  requestsTotal: number;
  requestsBlockedAuth: number;
  requestsBlockedRate: number;
  requestsErrors: number;
  inferRequests: number;
  inferTotalTokens: number;
  inferTotalDurationMs: number;
};

function formatPrometheus(metrics: Metrics) {
  const upSeconds = Math.max(0, (nowMs() - metrics.startedAtMs) / 1000);
  return [
    '# TYPE tnsec_uptime_seconds gauge',
    `tnsec_uptime_seconds ${upSeconds.toFixed(3)}`,
    '# TYPE tnsec_requests_total counter',
    `tnsec_requests_total ${metrics.requestsTotal}`,
    '# TYPE tnsec_requests_blocked_auth_total counter',
    `tnsec_requests_blocked_auth_total ${metrics.requestsBlockedAuth}`,
    '# TYPE tnsec_requests_blocked_rate_total counter',
    `tnsec_requests_blocked_rate_total ${metrics.requestsBlockedRate}`,
    '# TYPE tnsec_requests_errors_total counter',
    `tnsec_requests_errors_total ${metrics.requestsErrors}`,
    '# TYPE tnsec_infer_requests_total counter',
    `tnsec_infer_requests_total ${metrics.inferRequests}`,
    '# TYPE tnsec_infer_total_tokens counter',
    `tnsec_infer_total_tokens ${metrics.inferTotalTokens}`,
    '# TYPE tnsec_infer_total_duration_ms counter',
    `tnsec_infer_total_duration_ms ${metrics.inferTotalDurationMs.toFixed(0)}`,
  ].join('\n') + '\n';
}

async function main() {
  const host = process.env.T_NSEC_HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.T_NSEC_PORT || '8088', 10);

  const ollamaBaseUrl = process.env.T_NSEC_OLLAMA_BASE_URL || 'http://localhost:11434';
  const draftModel = process.env.T_NSEC_OLLAMA_DRAFT_MODEL || 'qwen2.5:0.5b';
  const verifyModel = process.env.T_NSEC_OLLAMA_VERIFY_MODEL || 'qwen2.5:7b';

  const apiKey = (process.env.T_NSEC_API_KEY || '').trim();
  const rateRps = Number.parseFloat(process.env.T_NSEC_RATE_RPS || '5');
  const rateBurst = Number.parseFloat(process.env.T_NSEC_RATE_BURST || '20');
  const limiter = createRateLimiter(
    Number.isFinite(rateRps) && rateRps > 0 ? rateRps : 5,
    Number.isFinite(rateBurst) && rateBurst > 0 ? rateBurst : 20,
  );

  const metrics: Metrics = {
    startedAtMs: nowMs(),
    requestsTotal: 0,
    requestsBlockedAuth: 0,
    requestsBlockedRate: 0,
    requestsErrors: 0,
    inferRequests: 0,
    inferTotalTokens: 0,
    inferTotalDurationMs: 0,
  };

  const server = http.createServer(async (req, res) => {
    metrics.requestsTotal += 1;
    const requestId = getRequestId(req);
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Request-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const u = new URL(req.url || '/', `http://${host}:${port}`);
    const path = u.pathname;

    if (path === '/health' && req.method === 'GET') {
      return json(res, 200, { status: 'ok', service: 't-nsec-enterprise', requestId });
    }

    if (path === '/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(formatPrometheus(metrics));
      return;
    }

    // Optional auth (enabled only when T_NSEC_API_KEY is set)
    if (apiKey) {
      const key = (req.headers['x-api-key'] as string | undefined)?.trim() || parseBearer(req.headers['authorization']);
      if (!key || key !== apiKey) {
        metrics.requestsBlockedAuth += 1;
        return json(res, 401, { error: 'unauthorized', requestId });
      }
    }

    // Rate limiting by IP (or by X-Forwarded-For)
    const clientKey = getClientKey(req);
    if (!limiter.allow(clientKey)) {
      metrics.requestsBlockedRate += 1;
      return json(res, 429, { error: 'rate_limited', requestId });
    }

    if (path === '/v1/infer' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as InferRequest;
        if (!payload.prompt || typeof payload.prompt !== 'string') {
          return json(res, 400, { error: 'missing_prompt', requestId });
        }

        const which = payload.model === 'draft' ? 'draft' : 'verify';
        const model = which === 'draft' ? draftModel : verifyModel;
        const maxTokens = Number.isFinite(payload.maxTokens as any) ? Number(payload.maxTokens) : 256;
        const temperature = Number.isFinite(payload.temperature as any) ? Number(payload.temperature) : 0.7;

        const t0 = performance.now();
        const text = await ollamaGenerate(ollamaBaseUrl, model, payload.prompt, { temperature, num_predict: maxTokens });
        const dt = performance.now() - t0;

        const tokens = Math.max(1, Math.ceil(text.length / 4));
        const resp: InferResponse = {
          text,
          tokens,
          durationMs: dt,
          tokensPerSecond: tokens / Math.max(0.001, dt / 1000),
          model,
          requestId,
        };

        metrics.inferRequests += 1;
        metrics.inferTotalTokens += tokens;
        metrics.inferTotalDurationMs += dt;

        return json(res, 200, resp);
      } catch (e: any) {
        metrics.requestsErrors += 1;
        return json(res, 500, { error: 'infer_failed', detail: String(e?.message || e), requestId });
      }
    }

    return json(res, 404, { error: 'not_found', requestId });
  });

  server.listen(port, host, () => {
    console.log(`[t-nsec-enterprise] listening http://${host}:${port}`);
    console.log(`[t-nsec-enterprise] ollama=${ollamaBaseUrl} draft=${draftModel} verify=${verifyModel}`);
    console.log(`[t-nsec-enterprise] auth=${apiKey ? 'on' : 'off'} rate_rps=${rateRps} rate_burst=${rateBurst}`);
  });
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});


