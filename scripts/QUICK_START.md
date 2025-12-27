# Quick Start Guide
# 快速开始指南

> **中文摘要**：
> 本文档是 T-NSEC-CORE 的“一键启动”手册。
> *   **前置要求**：需要安装 Node.js v20+ 和 Ollama（用于运行本地 LLM）。
> *   **核心命令**：包含安装依赖、运行单元测试、启动开发服务器和运行基准测试的标准命令。
> *   **故障排查**：提供了常见的环境问题解决方案。

---

## Prerequisites (前置要求)

1.  **Node.js**: v20 or higher.
2.  **Ollama**: Installed and running (for local inference).
    *   `ollama pull qwen2.5:0.5b` (Draft model)
    *   `ollama pull qwen2.5:7b` (Verify model)

## Commands (核心命令)

### 1. Setup (安装)
```bash
npm install
```

### 2. Verify Environment (环境验证)
```bash
npm run verify-env
# Checks if Ollama is running and models are available
```

### 3. Run Tests (测试)
```bash
npm test
# Runs unit tests for Graph, H-Spec, and HDC modules
```

### 4. Showcase (演示)
```bash
npm run showcase
# Displays key artifacts and metrics in the terminal
```

### 5. Benchmark (跑分)
```bash
npm run benchmark-full
# Runs the full system benchmark (Memory, Latency, TPS)
```

## Troubleshooting (故障排查)

*   **Ollama Connection Error**: Ensure Ollama is running on port 11434 (`ollama serve`).
*   **Model Not Found**: Run `ollama list` to check if `qwen2.5:0.5b` and `qwen2.5:7b` are installed.
*   **Memory Issues**: For `benchmark-full`, ensure you have at least 8GB RAM available.
