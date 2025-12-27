# 1. [Flagship] T‑NSEC：面向边缘智能的统一神经符号操作系统（系统综述/架构论文）

## 一句话

T‑NSEC 是一个 **CPU‑First 的“认知操作系统”架构**：把“智能”从模型里拆出来，落到 **外部图谱记忆 + 可解释调度 + 可复现评测** 上。

## Abstract (摘要)

- **核心挑战**：边缘设备算力/能耗受限；微调昂贵且会遗忘；RAG 容易召回冗余且缺乏可解释性。
- **研究主张**：用“可进化的外部记忆（图谱）”替代梯度更新，持续学习主要发生在 **记忆层** 而非 **参数层**。
- **系统解耦**：推理由模型服务（Ollama/llama.cpp）负责；T‑NSEC 作为 **调度器 + 记忆内核 + 评测仪器**。

## 三大定律

- **Kernel is Empty（内核归零）**：内核只做调度/记忆/可观测，不绑死具体模型。
- **Memory is Graph（记忆即图谱）**：长期知识用加权图谱承载（可解释/可压缩/可演化）。
- **Everything is Protocol（一切皆协议/MCP）**：工具与能力通过协议抽象，避免脆弱 API 耦合。

## 关键组件（系统视角）

- **SGE / U‑SGE**：稀疏图编码（Topology-aware retrieval & compression）
- **H‑Spec / H‑Spec++**：分层推测/资源路由（Draft→Verify）
- **(TK-)APO**：异步偏好优化/业力权重演化（可做成“睡眠时变强”）
- **D‑VSR / VMM**：具身侧的视觉差分与肌肉记忆（降低视觉调用成本）

## 已验证的核心证据 (Verified Results)

> 本节汇总了当前最可信的数值证据，主要来自 `qwen-sentence-align` 实验闭环。

- **语义对齐 (0.5B→7B)**：avg cosine **0.9835**，P95 **0.9932**，Spearman ρ **0.9552**
- **CPU‑only 检索收益 (Leave‑One‑Out)**：Recall@5 **0.535**（Raw 0.490），MRR **0.3329**（Raw 0.3087）

数据来源：`../../LAB_ASSETS_ENGINEERING.md` 与 `benchmark/qwen-sentence-align/reports/alignment_metrics_v2_1.csv`

---

## 系统级可复现证据（截至 2025-12-26）

> 说明：以下属于“可复现实验产物”，用于证明系统内核与评测链路可跑、可量化；其中部分指标为 *proxy*（非标准学术基准），已在各子论文中明确后续严谨评测计划。

### E0：Paper Benchmark（离线基准：不依赖模型服务器）

- **证据文件**：
  - 指标汇总（含 8 条报告行）：`reports/paper_benchmark/benchmark_metrics_20251226_184118.csv`
  - 综合报告：`reports/paper_benchmark/comprehensive_report_20251226_184118.md`

**8 轮汇总（mean / min~max）**

| 指标 | mean | min~max | 说明 |
|---|---:|---:|---|
| cognitiveEntropy | 0.3750 | 0.3500 ~ 0.3900 | 认知熵（proxy） |
| calibrationError | 0.3742 | 0.3494 ~ 0.3876 | 校准误差（proxy） |
| avgLatency (ms) | 3468.86 | 3394.58 ~ 3534.42 | 端到端平均延迟 |
| p50Latency (ms) | 379.45 | 361.24 ~ 398.18 | 延迟中位数 |
| p95Latency (ms) | 24673.89 | 23823.72 ~ 25444.80 | 延迟 P95 |
| nodeCount | 1007.38 | 1007 ~ 1008 | 图谱规模（节点） |
| edgeCount | 4990.88 | 4988 ~ 4993 | 图谱规模（边） |
| avgKarma | 0.8296 | 0.8255 ~ 0.8360 | 平均 Karma |
| modularity | 0.1235 | 0.1181 ~ 0.1267 | 模块度（proxy） |

### E1：Graph Memory 10 万项压力测试（检索不塌缩）

- **结论**：Golden Memory Rank 在 10k→100k 过程中 **始终=1**；RAM 线性增长（41.51→55.20MB）；100k 总耗时 7.48s。
- **证据页**：`../appendix/CaseStudy_StressTest_100k.md`

### E2：Superego（超我）学习曲线（Karma 权重熵减 PoC）

- **结论**：错误率随迭代显著下降，Karma 累积上升；展示“外部权重演化”的最小闭环（无梯度）。
- **证据页**：`../appendix/CaseStudy_Superego_Karma_Learning.md`

## 研究范围与局限性 (Scope & Limitations)

- **持续学习指标 (BWT)**：当前使用 *BWT-like proxy* 进行初步评估，标准 BWT 评测已列入后续计划。
- **门控策略**：input-level gate 与 output-level gate 的表现差异主要源于门控定义与输出口径，不代表单一模型的质量结论。

## 实验计划（可发表最小集）

- **E1 可运行性**：CPU-only 下跑通 SGE→推理→写回→再检索闭环
- **E2 资源约束**：Latency/TPS/内存/能耗（可用 TPW tokens/J）
- **E3 Ablation**：w/o 记忆演化、w/o 结构编码、w/o 资源路由
- **E4 Continual**：任务序列 + 标准 BWT/FWT + forgetting curve

---

## 下一步实验计划（Planned）

> 原则：只把“可短周期跑出证据”的内容写进论文计划；更宏大的世界观/隐喻放入 `docs/ideas/`，等待数据验证后再迁移到研究资产。

1) **对齐数据效率拐点（Data Elbow）**  
在现有对齐 pipeline 上做数据比例扫描，产出“数据→指标”的拐点曲线，用于指导后续蒸馏成本与数据选择策略。

2) **频谱蒸馏（Spectral Loss）**  
在对齐损失里加入频域能量分布约束（幅度谱），做 A/B + 超参扫描，观察是否改善检索与 output-level gate 的稳定性。

未验证主张备忘录：`docs/ideas/Spectral_Distillation_and_Data_Elbow.md`

## 复现入口（本仓相关）

- `benchmark/qwen-sentence-align/`：语义对齐与门控实验（可作为 T‑NSEC 的组件证据）


