# D-VSR: Differential Visual-State Reasoning for GUI Automation
# D-VSR：基于视觉差分推理的 GUI 自动化

**Status**: Draft for arXiv Preprint
**Authors**: Thomas Lab

> **中文摘要**：
> *   **核心问题**：现有的 GUI 自动化（Computer Use）方案过于依赖高频截图和视觉模型（VLM），延迟高且成本昂贵。
> *   **解决方案**：引入“视觉肌肉记忆”概念，减少不必要的视觉推理。
> *   **创新点**：
>     *   **视觉差分**：只在屏幕发生显著变化（差分 > 5%）时才调用视觉模型。
>     *   **VMM (视觉肌肉记忆)**：建立“屏幕哈希 -> 操作动作”的映射表，对于重复性任务实现毫秒级响应。

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
