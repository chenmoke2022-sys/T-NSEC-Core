# H-Spec++: Hierarchical Index-Guided Speculation for CPU-Bound Inference
# H-Spec++：面向 CPU 受限环境的分层索引导向推测解码

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

## Abstract (摘要)
> **核心问题**：在 CPU 上跑大模型太慢，内存带宽是瓶颈。
> **解决方案**：利用人类语言的重复性（齐夫定律）。
> **创新点**：引入 Trie-Cache（字典树缓存）作为“L0 级猜测”，0.5B 模型作为“L1 级猜测”，7B 模型仅作为“验证者”。这实现了 O(1) 复杂度的常见查询响应。

## 1. Introduction
*   Speculative Decoding is usually for GPUs. We adapt it for CPUs.
*   The "Zif's Law" in user interactions (commands are repetitive).

## 2. Algorithm: H-Spec++
*   **Level 0**: Trie-based Exact Match (0ms).
*   **Level 1**: Draft Model (0.5B) Speculation.
*   **Level 2**: Target Model (7B) Verification.

## 3. The "Vector Shift" Hypothesis (H-Spec-V)
*   Exploring linear mapping between 0.5B and 7B embedding spaces.
*   "Caesar Cipher" intuition: Semantic tolerance in verification.

## 4. Results
*   Speedup ratios on various hardware (Haswell i5 to M2 Pro).

## 5. Conclusion

