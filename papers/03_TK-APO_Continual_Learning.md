# TK-APO: Temporal-Karma Asynchronous Preference Optimization
# TK-APO：时间-业力异步偏好优化

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

## Abstract (摘要)
> **核心问题**：微调模型会导致“灾难性遗忘”，且无法在边缘设备上运行。
> **解决方案**：模拟人脑的突触连接强度（Karma）。
> **创新点**：引入“时间向量衰减”。不常用的知识权重自动下降，被用户点赞的知识权重上升。这实现了无需梯度的强化学习（RLHF）。

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

