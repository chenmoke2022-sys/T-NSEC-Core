# T-NSEC-CORE: Edge-First Neuro-Symbolic Architecture
# T-NSEC-CORE: 边缘优先神经符号 AI 架构

> **Institution**: Thomas Lab
> **Focus**: Edge AI, Neuro-Symbolic, Cognitive Architecture, HCI
>
> **Manifesto**: "The Dao of Intelligence lies not in the scale of parameters, but in the topology of connections."
> **宣言**：“智能之道，不在参数之巨，而在连接之构。”

---

## 🏛️ Project Overview (项目概览)

**T-NSEC-CORE** is a proof-of-concept for a **CPU-first**, **Neuro-Symbolic** runtime designed for edge devices. It proposes a radical **"Memory-Compute Decoupling"** architecture, allowing AI to "learn" via graph topology evolution without expensive GPU fine-tuning.

**T-NSEC-CORE** 是一个面向边缘设备的 **CPU 优先**、**神经符号** 运行时验证原型。它提出了激进的 **“存算分离”** 架构，允许 AI 通过图谱拓扑演化进行“学习”，而无需昂贵的 GPU 微调。

### Core Innovations (核心创新)

1.  **H-Spec (Hierarchical Speculation)**: Running 7B models on consumer CPUs with **3x speedup** via 0.5B draft models.
2.  **SGE (Sparse Graph Encoding)**: Eliminating hallucination via **Weighted PPR** subgraph retrieval.
3.  **TK-APO (Temporal-Karma Optimization)**: Gradient-free **Continual Learning** via graph edge evolution.

---

## 📚 Thomas Lab Research Matrix (实验室研究矩阵)

> This repository serves as the engineering implementation of the following research papers.
> 本仓库是以下研究论文的工程实现载体。

### Part A: Systems & Infrastructure (核心系统架构)
*   **[Flagship] T-NSEC: A Unified Neuro-Symbolic Operating System**
    *   *Proposed the "Empty Kernel" paradigm and "Memory-Compute Decoupling".*
    *   [📄 Read Abstract](papers/01_T-NSEC_System_Architecture.md)
*   **H-Spec++: Hierarchical Index-Guided Speculation**
    *   *Solving memory bandwidth bottlenecks on consumer CPUs.*
    *   [📄 Read Abstract](papers/02_H-Spec_Plus_Inference.md)

### Part B: Algorithms & Cognition (认知算法与理论)
*   **TK-APO: Temporal-Karma Asynchronous Preference Optimization**
    *   *Gradient-free reinforcement learning via graph topology evolution.*
    *   [📄 Read Abstract](papers/03_TK-APO_Continual_Learning.md)
*   **SGE: Topology-Aware Sparse Graph Encoding**
    *   *Eliminating hallucination via structured subgraph retrieval.*
    *   [📄 Read Abstract](papers/04_SGE_Graph_Encoding.md)

### Part C: Embodied AI & HCI (具身智能与交互)
*   **D-VSR: Differential Visual-State Reasoning**
    *   *"Less screenshot, more action" via visual difference.*
    *   [📄 Read Abstract](papers/05_D-VSR_Embodied_Interaction.md)

### Part D: Philosophy & Vision (产品哲学)
*   [**Cultivation of the Machine (机器修真录)**](docs/philosophy/Cultivation_of_the_Machine.md)
    *   *Mapping AI evolution to Eastern Cultivation Philosophy.*
*   [**Entropy & Dao (熵与道)**](docs/inspirations/Entropy_and_Dao.md)
    *   *The thermodynamics of intelligence.*

---

## 🛠️ Engineering Assets (工程资产)

This is not just theory; it is deployed code.

| Component | Path | Description |
| :--- | :--- | :--- |
| **Enterprise Server** | [`src/cli/serve-enterprise.ts`](src/cli/serve-enterprise.ts) | Dockerized, Auth, Rate-Limit, Metrics. |
| **Inference Engine** | [`src/inference/`](src/inference/) | The H-Spec Scheduler logic. |
| **Memory Graph** | [`src/graph/`](src/graph/) | SQLite-based Knowledge Graph. |
| **Workflow** | [`docs/methodology/AI_WORKFLOW.md`](docs/methodology/AI_WORKFLOW.md) | How we architect with AI. |

---

## ✅ Quick Start (快速开始)

```bash
# 1. Install dependencies
npm install

# 2. Run the full verification suite (Unit Tests + Logic Verification)
npm test

# 3. View the Project Showcase (Summary of artifacts)
npm run showcase
```

---

**License**: MIT
**Maintainer**: Thomas Lab (Thomas Tan)
