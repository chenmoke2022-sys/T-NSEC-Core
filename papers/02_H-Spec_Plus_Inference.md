# H-Spec++: Hierarchical Index-Guided Speculation for CPU-Bound Inference
# H-Spec++：面向 CPU 受限环境的分层索引导向推测解码

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

> **中文摘要**：
> *   **核心问题**：在 CPU 上运行 7B 以上大模型时，内存带宽是主要瓶颈，导致推理速度极慢。
> *   **解决方案**：利用人类语言的“齐夫定律”（高频词重复出现），构建分层推测机制。
> *   **创新点**：
>     1.  **L0 级**：Trie-Cache（字典树缓存），实现常用短语的 O(1) 极速命中。
>     2.  **L1 级**：0.5B 小模型作为“草稿生成器”，快速产出候选文本。
>     3.  **L2 级**：7B 大模型仅作为“验证者”，大幅减少昂贵的计算次数。

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
