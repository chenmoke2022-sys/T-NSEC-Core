# Enterprise Server Deployment (Production Mode)

This repository provides a production-oriented HTTP entrypoint: `src/cli/serve-enterprise.ts`.

## What it provides
- **Auth (optional)**: enable by setting `T_NSEC_API_KEY`
- **Rate limiting**: token bucket, in-memory (`T_NSEC_RATE_RPS`, `T_NSEC_RATE_BURST`)
- **Health**: `GET /health`
- **Metrics**: `GET /metrics` (Prometheus text format)
- **Inference**: `POST /v1/infer` routed to **draft** or **verify** model via Ollama

## Environment variables
- `T_NSEC_HOST` (default `0.0.0.0`)
- `T_NSEC_PORT` (default `8088`)
- `T_NSEC_API_KEY` (optional; when set, requires `Authorization: Bearer <key>` or `X-API-Key: <key>`)
- `T_NSEC_RATE_RPS` (default `5`)
- `T_NSEC_RATE_BURST` (default `20`)
- `T_NSEC_OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `T_NSEC_OLLAMA_DRAFT_MODEL` (default `qwen2.5:0.5b`)
- `T_NSEC_OLLAMA_VERIFY_MODEL` (default `qwen2.5:7b`)

## Run locally

```bash
ollama pull qwen2.5:0.5b
ollama pull qwen2.5:7b

npm install
npm run serve
```

### Request examples

```bash
curl -s http://localhost:8088/health
curl -s http://localhost:8088/metrics
```

```bash
curl -s http://localhost:8088/v1/infer ^
  -H "Content-Type: application/json" ^
  -d "{\"prompt\":\"Explain neuro-symbolic continual learning in one sentence.\",\"model\":\"verify\",\"maxTokens\":128,\"temperature\":0.2}"
```

## Docker (enterprise profile)

```bash
docker compose -f docker-compose.enterprise.yml up --build
```

Notes:
- The container expects Ollama reachable at `host.docker.internal:11434` by default.
- For Linux servers, set `T_NSEC_OLLAMA_BASE_URL` to the correct Ollama host/IP.


