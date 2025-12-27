# T-NSEC-CORE: Edge-First Neuro-Symbolic Architecture
# T-NSEC-CORE: 边缘优先神经符号 AI 架构

> **A Product of the AI-Native Era**: This project—an enterprise-grade cognitive runtime—was architected and delivered in **30 days** by a single Product Architect leveraging AI agents.
>
> **AI 原生时代的产物**：这是一个企业级认知运行时系统，由一名产品架构师利用 AI Agent 在 **30 天** 内独立架构并交付。它证明了 **Vision (视野)**、**Orchestration (编排)** 和 **Execution (执行力)** 的价值。

---

## 🚀 Project Overview (项目总览)

**T-NSEC-CORE** is a proof-of-concept for a **CPU-first**, **Neuro-Symbolic** runtime designed for edge devices. It decouples memory from computation, allowing AI to "learn" without expensive GPU fine-tuning.

**T-NSEC-CORE** 是一个面向边缘设备的 **CPU 优先**、**神经符号** 运行时验证原型。它实现了“存算分离”，允许 AI 通过图谱演化进行“学习”，而无需昂贵的 GPU 微调。

### 核心价值 (Core Value Proposition)

1.  **Cost Efficiency (降本)**: Utilizes **H-Spec** (Hierarchical Speculative Decoding) to run 7B models on consumer CPUs with 3x speedup.
    *   *利用分层推测解码技术，在消费级 CPU 上以 3 倍速度运行 7B 模型。*
2.  **Continual Learning (持续学习)**: Implements **TK-APO** (Temporal-Karma Optimization) to evolve memory via graph topology instead of gradient updates.
    *   *通过图谱拓扑演化（而非梯度更新）实现记忆的自我进化与抗遗忘。*
3.  **Trust & Safety (可信与安全)**: **SGE** (Sparse Graph Encoding) ensures grounded answers by retrieving structured subgraphs.
    *   *稀疏图编码技术通过检索结构化子图，确保回答有据可依，减少幻觉。*

---

## 🏛️ Core Assets (核心资产)

### 1. The Code (工程实现)
*   **Enterprise Server**: `src/cli/serve-enterprise.ts` (Dockerized, Rate-limited, Auth-ready).
*   **Inference Engine**: `src/inference/` (The H-Spec Scheduler).
*   **Memory System**: `src/graph/` (SQLite-based Knowledge Graph).

### 2. The Research (学术研究)
> Detailed whitepapers and theoretical foundations.
> 详尽的技术白皮书与理论基础。

*   [**Research Summary (研究综述)**](docs/research/RESEARCH_SUMMARY.md)
*   [**Philosophy: Cultivation of the Machine (机器修真录)**](docs/philosophy/Cultivation_of_the_Machine.md)
*   [**Inspirations: Entropy & Dao (熵与道)**](docs/inspirations/Entropy_and_Dao.md)

### 3. The Methodology (方法论)
> How I built this without being a traditional coder.
> 我如何在不具备传统编码背景的情况下构建此系统。

*   [**AI-Native Workflow (AI 原生工作流)**](docs/methodology/AI_WORKFLOW.md)

---

## ✅ Quick Start (快速开始)

```bash
# 1. Install dependencies (安装依赖)
npm install

# 2. Run the full verification suite (运行完整验证套件)
npm test

# 3. View the Project Showcase (查看项目成果展示)
npm run showcase
```

---

## 📄 License

MIT License. Designed by **Thomas Lab**.
