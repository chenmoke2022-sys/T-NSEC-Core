/**
 * dev-ollama.ts
 *
 * 推荐的 dev 模式：
 * - 不依赖 GGUF 文件
 * - 只依赖 Ollama（更容易复现）
 *
 * 默认：
 * - Draft: qwen2.5:0.5b  -> http://localhost:8081/infer
 * - Verify: qwen2.5:7b   -> http://localhost:8080/infer (以及 /hspec)
 *
 * 环境变量：
 * - T_NSEC_OLLAMA_BASE_URL (default http://localhost:11434)
 * - T_NSEC_OLLAMA_DRAFT_MODEL (default qwen2.5:0.5b)
 * - T_NSEC_OLLAMA_VERIFY_MODEL (default qwen2.5:7b)
 * - T_NSEC_DRAFT_PORT (default 8081)
 * - T_NSEC_VERIFY_PORT (default 8080)
 */

import http from 'http';
import { URL } from 'url';

type InferRequest = {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

function json(res: http.ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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

async function ollamaGenerate(baseUrl: string, model: string, prompt: string, opts: { temperature?: number; num_predict?: number }) {
  const url = new URL('/api/generate', baseUrl);
  const payload = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.7,
      num_predict: opts.num_predict ?? 256,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Ollama generate failed: ${r.status} ${r.statusText} ${txt}`);
  }
  const data: any = await r.json();
  return String(data.response ?? '');
}

function createProxyServer(kind: 'draft' | 'verify', port: number, baseUrl: string, model: string) {
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const path = new URL(req.url || '/', `http://localhost:${port}`).pathname;

    if (path === '/' || path === '/health') {
      return json(res, 200, { status: 'ok', service: `Ollama ${kind} proxy`, port, model, ollama: baseUrl });
    }

    const handleInfer = async () => {
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as InferRequest;
        if (!payload.prompt) return json(res, 400, { error: 'Missing prompt' });

        const maxTokens = payload.maxTokens ?? 256;
        const temperature = payload.temperature ?? 0.7;
        const t0 = performance.now();
        const text = await ollamaGenerate(baseUrl, model, payload.prompt, { temperature, num_predict: maxTokens });
        const dt = performance.now() - t0;

        return json(res, 200, {
          text,
          tokens: Math.max(1, Math.ceil(text.length / 4)),
          duration: dt,
          tokensPerSecond: Math.max(1, Math.ceil(text.length / 4)) / Math.max(0.001, dt / 1000),
          gpuMemoryUsed: 0,
          gpuLoad: 0,
        });
      } catch (e: any) {
        return json(res, 500, { error: String(e?.message || e) });
      }
    };

    if (path === '/infer' && req.method === 'POST') {
      return await handleInfer();
    }

    // verify proxy supports /hspec as alias of /infer (endpoint compatibility)
    if (kind === 'verify' && path === '/hspec' && req.method === 'POST') {
      // Endpoint parity only. True H-Spec logic lives in T-NSEC core, not Ollama.
      return await handleInfer();
    }

    return json(res, 404, { error: 'Not found' });
  });

  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
}

async function main() {
  const baseUrl = process.env.T_NSEC_OLLAMA_BASE_URL || 'http://localhost:11434';
  const draftModel = process.env.T_NSEC_OLLAMA_DRAFT_MODEL || 'qwen2.5:0.5b';
  const verifyModel = process.env.T_NSEC_OLLAMA_VERIFY_MODEL || 'qwen2.5:7b';
  const draftPort = parseInt(process.env.T_NSEC_DRAFT_PORT || '8081', 10);
  const verifyPort = parseInt(process.env.T_NSEC_VERIFY_PORT || '8080', 10);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         T-NSEC Dev (Ollama Mode)                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Ollama: ${baseUrl}`);
  console.log(`Draft : ${draftModel} -> http://localhost:${draftPort}`);
  console.log(`Verify : ${verifyModel} -> http://localhost:${verifyPort}`);
  console.log('');

  // quick health check
  try {
    const r = await fetch(new URL('/api/tags', baseUrl));
    if (!r.ok) throw new Error(`status=${r.status}`);
  } catch (e: any) {
    console.error(`[dev-ollama] ERROR: Ollama not reachable at ${baseUrl}. Start Ollama and pull models: ${draftModel}, ${verifyModel}`);
    console.error(`   Details: ${String(e?.message || e)}`);
    process.exit(1);
  }

  await Promise.all([
    createProxyServer('draft', draftPort, baseUrl, draftModel),
    createProxyServer('verify', verifyPort, baseUrl, verifyModel),
  ]);

  console.log('[dev-ollama] Proxy servers running');
  console.log(`  Draft:  POST http://localhost:${draftPort}/infer`);
  console.log(`  Verify: POST http://localhost:${verifyPort}/infer`);
  console.log(`  H-Spec: POST http://localhost:${verifyPort}/hspec (alias)`);
  console.log('\nPress Ctrl+C to stop.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});


