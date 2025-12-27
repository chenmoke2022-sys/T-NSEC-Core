# 📄 Thomas Lab 学术论文摘要集 (Academic Abstracts)

为了方便非英语母语者快速理解 T-NSEC 的核心学术贡献，此处汇总了所有核心论文的中文摘要。

---

## 1. T-NSEC: 统一神经符号操作系统
**T-NSEC: A Unified Neuro-Symbolic Operating System for Edge Intelligence**

> **核心问题**：现在的 AI 太重（依赖 GPU）、太贵（推理成本高）、且容易遗忘（无法持续学习）。
> **解决方案**：我们提出了“存算分离”架构。内核归零，记忆即图谱。
> **创新点**：将操作系统内核设计为一个纯粹的调度器，而将所有业务逻辑下沉到 MCP 插件和 SQLite 图谱中。

## 2. H-Spec++: 分层索引导向推测解码
**H-Spec++: Hierarchical Index-Guided Speculation for CPU-Bound Inference**

> **核心问题**：在 CPU 上跑大模型太慢，内存带宽是瓶颈。
> **解决方案**：利用人类语言的重复性（齐夫定律）。
> **创新点**：引入 Trie-Cache（字典树缓存）作为“L0 级猜测”，0.5B 模型作为“L1 级猜测”，7B 模型仅作为“验证者”。这实现了 O(1) 复杂度的常见查询响应。

## 3. TK-APO: 时间-业力异步偏好优化
**TK-APO: Temporal-Karma Asynchronous Preference Optimization**

> **核心问题**：微调模型会导致“灾难性遗忘”，且无法在边缘设备上运行。
> **解决方案**：模拟人脑的突触连接强度（Karma）。
> **创新点**：引入“时间向量衰减”。不常用的知识权重自动下降，被用户点赞的知识权重上升。这实现了无需梯度的强化学习（RLHF）。

## 4. SGE: 拓扑感知稀疏图编码
**SGE: Topology-Aware Sparse Graph Encoding**

> **核心问题**：RAG（检索增强生成）检索的内容太乱，容易导致模型幻觉。
> **解决方案**：不检索“点”，检索“结构”。
> **创新点**：利用 Weighted PPR 算法，提取与查询最相关的“子图结构”。将图结构编码为 prompt，让模型能“看到”知识之间的逻辑关系，而不仅仅是关键词。

## 5. D-VSR: 基于视觉差分推理的 GUI 自动化
**D-VSR: Differential Visual-State Reasoning for GUI Automation**

> **核心问题**：用 AI 操作电脑（Computer Use）太慢、太贵。
> **解决方案**：少截图，多干活。
> **创新点**：只在屏幕发生显著变化（差分 > 5%）时才调用视觉模型。对于重复性操作，建立“视觉哈希索引”，实现毫秒级的“肌肉记忆”操作。

---

**Thomas Lab**
*Dedicated to the democratization of AGI.*

