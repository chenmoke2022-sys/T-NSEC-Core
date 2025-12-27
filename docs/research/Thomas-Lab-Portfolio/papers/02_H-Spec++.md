# 2. H‑Spec++：面向 CPU 受限环境的分层索引导向推测解码（推理与调度论文）

## 一句话

H‑Spec++ 把“推理”变成“调度”：让小模型（Draft）先跑，只有在不确定/不一致时才回退到大模型（Verify），并用 **索引/缓存** 进一步突破 CPU 内存墙。

## Abstract (摘要)

- **H‑Spec (Base)**：基于 Draft(0.5B) → Verify(7B) 的分层推测架构。
- **H‑Spec++ (Pro)**：在调度层前置 Trie/N‑gram cache，实现高频指令片段的 O(1) 匹配。

## 论文贡献点（可写作）

1. **CPU‑bound 推理瓶颈建模**：把瓶颈从 FLOPs 转移到 memory wall（缓存命中/带宽）
2. **任务感知路由（Resource Router）**：H‑Spec 不只是加速器，也是“何时用大模型”的策略器
3. **索引导向推测**：Trie Cache + Draft Model 双层加速

## 已验证的相关组件证据 (Component Evidence)

来自 `qwen-sentence-align` 的“语义一致性/门控”实验，可作为 H‑Spec 的子模块证据：

- **输入级一致性（input-level gate）**：在 v2.1 对齐后可能出现 100% accept（分布过易，需要更难任务或更严格 gate 定义）
- **输出级一致性（output-level gate）**：可能出现 0% accept（输出口径不一致、阈值未校准）

> 这两者的结论不是“好/坏”，而是：**门控定义必须与任务目标匹配**。

## 需要补齐的论文级实验（Planned）

- **速度与能耗**：TPS / Latency / TPW（tokens per watt）
- **质量-成本曲线**：Accept/Reject vs 阈值；以及“输出口径约束”前后的曲线变化
- **对比基线**：无推测（全 Verify）、无 Trie（只有 H‑Spec）、无门控（固定比例回退）

### 最小实验（Planned）

> 这些实验不需要改系统架构，只需要改评测与少量训练/损失函数；目标是产出可复核的 CSV/图/报告，用于论文写作与技术复现。

1) **Data-Efficient Alignment Elbow（对齐数据效率拐点）**
- 问题：对齐收益是否集中在少量“高密度样本”上？拐点在哪里？
- 方法：训练集比例扫描（1/5/10/20/50/100%），对齐指标 + CPU-only 检索 + gate 曲线联动。
- 产物：`data_ratio_vs_metrics.csv/.png` + `report.md`

2) **Spectral Distillation（频谱蒸馏：Spectral Loss）**
- 问题：只对齐 cosine 是否不足以约束结构一致性？加入频谱约束是否改善检索/门控稳定性？
- 方法：在对齐训练里加入 \(L_{spec}=\mathrm{MSE}(|\mathrm{RFFT}(z_s)|,|\mathrm{RFFT}(z_t)|)\) 并扫描 \(\lambda\)。
- 产物：A/B 对比表（baseline vs +spectral）+ 频谱对比图 + 指标 CSV

> 未验证说明：上述两项属于下一阶段实验计划，当前不计入“已验证实验数据”。未验证主张的详细备忘录放在 `docs/ideas/`。

## 复现入口（现有）

- `benchmark/qwen-sentence-align/reports/hspec_gate_v2_1_*`：门控相关报告与 CSV


