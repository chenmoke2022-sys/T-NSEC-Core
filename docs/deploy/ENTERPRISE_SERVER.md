# Enterprise Server Deployment (Production Mode)
# 企业级服务器部署指南（生产模式）

> **中文摘要**：
> 本文档介绍了如何部署 T-NSEC-CORE 的生产级 HTTP 服务器 (`serve-enterprise.ts`)。
> *   **功能**：提供 API 密钥认证、速率限制 (Rate Limiting)、健康检查和 Prometheus 监控指标。
> *   **架构**：支持 Docker 容器化部署，通过 HTTP 接口统一调度 Draft (0.5B) 和 Verify (7B) 模型。
> *   **场景**：适用于需要对外提供稳定 AI 服务的企业环境。

---

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
