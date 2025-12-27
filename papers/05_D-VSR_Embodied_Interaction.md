# D-VSR: Differential Visual-State Reasoning for GUI Automation
# D-VSR：基于视觉差分推理的 GUI 自动化

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

## Abstract (摘要)
> **核心问题**：用 AI 操作电脑（Computer Use）太慢、太贵。
> **解决方案**：少截图，多干活。
> **创新点**：只在屏幕发生显著变化（差分 > 5%）时才调用视觉模型。对于重复性操作，建立“视觉哈希索引”，实现毫秒级的“肌肉记忆”操作。

## 1. Introduction
*   The cost of VLM (Vision Language Model) inference.
*   Latency issues in real-time GUI automation.

## 2. Algorithm: D-VSR
*   **Differential Check**: pHash / SSIM comparison.
*   **Action Prediction**: Predicting next state before full visual analysis.

## 3. VMM (Visual Muscle Memory)
*   Caching {Screen Hash -> Action} pairs.
*   Achieving reflex-like speed for repetitive tasks.

## 4. Experiments
*   Success rate and latency on WebArena / MiniWoB++.

## 5. Conclusion

