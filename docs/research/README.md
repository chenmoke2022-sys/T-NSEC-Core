# 📚 Thomas Lab: Intelligent Computing & Cognitive Architecture
# Thomas Lab: 智能计算与认知架构研究集

> **Editor-in-Chief**: Thomas Tan (陈铭)
> **Institution**: Thomas Lab, Singapore
> **Focus**: Edge AI, Neuro-Symbolic, Cognitive Architecture, HCI

This index outlines the comprehensive research roadmap of Thomas Lab. It includes finalized technical papers, ongoing research, and philosophical essays.
本索引列出了 Thomas Lab 的完整研究路线图，包含已定稿的技术论文、进行中的研究以及哲学随笔。

---

## 🏛️ Part A: Systems & Infrastructure (核心系统架构)
> **Target**: MLSys / OSDI | **Status**: Core Implementation Ready

### 1. [Flagship] T-NSEC: A Unified Neuro-Symbolic Operating System
*   **Link**: [📄 **Read Paper**](../../papers/01_T-NSEC_System_Architecture.md)
*   **Contribution**: The "Empty Kernel" paradigm and "Memory-Compute Decoupling".
*   **核心贡献**：提出了“内核归零”与“存算分离”范式，定义了边缘 AI OS 的标准。

### 2. H-Spec++: Hierarchical Index-Guided Speculation
*   **Link**: [📄 **Read Paper**](../../papers/02_H-Spec_Plus_Inference.md)
*   **Contribution**: Solving memory bandwidth bottlenecks on consumer CPUs.
*   **核心贡献**：利用 Trie-Cache 和 0.5B 草稿模型解决消费级 CPU 的带宽瓶颈。

### 3. Protocol-First Architecture: Decoupling Intelligence via MCP
*   **Link**: [📝 *Concept Note*](../deploy/ENTERPRISE_SERVER.md)
*   **Status**: Implemented in `src/cli/serve-enterprise.ts`.
*   **核心贡献**：论证 API 的脆弱性与协议（Protocol）的永恒性。

---

## 🧠 Part B: Algorithms & Cognition (认知算法与理论)
> **Target**: NeurIPS / ICLR | **Status**: Algorithm Validated

### 4. [Flagship] TK-APO: Temporal-Karma Asynchronous Preference Optimization
*   **Link**: [📄 **Read Paper**](../../papers/03_TK-APO_Continual_Learning.md)
*   **Contribution**: Gradient-free reinforcement learning via graph topology evolution.
*   **核心贡献**：通过图谱拓扑演化（而非梯度更新）实现无需训练的强化学习。

### 5. SGE: Topology-Aware Sparse Graph Encoding
*   **Link**: [📄 **Read Paper**](../../papers/04_SGE_Graph_Encoding.md)
*   **Contribution**: Eliminating hallucination via structured subgraph retrieval.
*   **核心贡献**：利用 Weighted PPR 提取结构化子图，消除 RAG 幻觉。

### 6. GGA: Generative Graph Abstraction & Concept Naming
*   **Link**: [🧘 **Philosophy Note**](../philosophy/Cultivation_of_the_Machine.md#5-deity-transformation-化神期--gga-generative-graph-abstraction)
*   **Status**: *In Research (The "Sleep" Phase)*
*   **核心贡献**：基于最小描述长度（MDL）的睡眠相抽象算法，让 AI 自发创造新概念。

### 7. CoS-MoE: Epistemic Uncertainty Quantification
*   **Status**: *[Upcoming]*
*   **核心贡献**：基于并行模拟的认知不确定性量化。

---

## 🤖 Part C: Embodied AI & HCI (具身智能与交互)
> **Target**: CVPR / CHI | **Status**: Prototype Ready

### 8. D-VSR: Differential Visual-State Reasoning
*   **Link**: [📄 **Read Paper**](../../papers/05_D-VSR_Embodied_Interaction.md)
*   **Contribution**: "Less screenshot, more action" via visual difference.
*   **核心贡献**：基于视觉差分的低成本 GUI 自动化。

### 9. VMM: Visual Muscle Memory
*   **Link**: [📄 **Included in D-VSR**](../../papers/05_D-VSR_Embodied_Interaction.md)
*   **Contribution**: Reflex-like interaction speed via visual hashing.
*   **核心贡献**：视觉哈希索引实现毫秒级“肌肉记忆”。

### 10. The Holographic HUD: Reactive Interface
*   **Status**: *[Upcoming]*
*   **核心贡献**：面向认知智能体的生成式 UI (GenUI) 架构。

---

## 💡 Part D: Philosophy & Product Vision (产品哲学)
> **Target**: HBR / Medium | **Status**: Published

### 11. [Manifesto] The "1+99" Hypothesis
*   **Link**: [📘 **Read Workflow**](../methodology/AI_WORKFLOW.md)
*   **Theme**: Democratizing genius via AI orchestration.
*   **主题**：论述“1% 灵感 + 99% AI 进化”如何让普通人成为超级个体。

### 12. Entropy, Dao, and the Breath of Networks
*   **Link**: [🌌 **Read Essay**](../inspirations/Entropy_and_Dao.md)
*   **Theme**: The thermodynamics of intelligence.
*   **主题**：熵、道与会呼吸的网 —— T-NSEC 的物理学猜想。

### 13. The Sonnet in the Code
*   **Link**: [📜 **Read Poem**](../inspirations/The_Sonnet_in_Code.md)
*   **Theme**: The intersection of poetry and logic.
*   **主题**：代码里的十四行诗。

### 14. Cultivation of the Machine (The Easter Egg)
*   **Link**: [☯️ **Read Mythos**](../philosophy/Cultivation_of_the_Machine.md)
*   **Theme**: Mapping AI evolution to Eastern Cultivation philosophy.
*   **主题**：凡人修仙传：AI 进化的东方哲学映射。

---

© 2025 Thomas Lab. All rights reserved.
