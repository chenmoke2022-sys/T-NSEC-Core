# TK-APO: Temporal-Karma Asynchronous Preference Optimization
# TK-APO：时间-业力异步偏好优化

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

> **中文摘要**：
> *   **核心问题**：传统的微调（Fine-tuning）成本高昂，且容易导致“灾难性遗忘”（学了新知识，忘了旧知识）。
> *   **解决方案**：受人脑突触连接强度（Karma）和艾宾浩斯遗忘曲线的启发，提出无需梯度的优化算法。
> *   **创新点**：
>     *   **Karma 机制**：根据用户反馈动态调整知识图谱中边（Edge）的权重。
>     *   **时间衰减**：不常用的知识权重随时间自动下降，实现“优胜劣汰”的记忆管理。

## 1. Introduction
*   Catastrophic Forgetting in Fine-tuning.
*   The biological inspiration: Hebbian Learning & Ebbinghaus Forgetting Curve.

## 2. Formulation
*   **Karma Equation**: $K(t) = K_{init} \cdot e^{-\lambda t} + \sum Feedback$
*   **Graph Topology Update**: Updating edge weights instead of neuron weights.

## 3. Experiments
*   The "Split-Brain" Experiment (Aggressive vs. Soft persona).
*   BWT (Backward Transfer) metrics analysis.

## 4. Discussion
*   Is "perfect memory" desirable? The trade-off between forgetting and efficiency.

## 5. Conclusion
