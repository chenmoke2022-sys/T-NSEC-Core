# 研究灵感备忘录（未验证）：频谱蒸馏 & 数据效率拐点

> **状态**：未验证（No claims）。  
> **用途**：把早期研究灵感降维成"可执行实验计划"，等待跑出数据后再迁移到 `docs/research/`。

## 1) Data-Efficient Alignment Elbow（对齐数据效率拐点）

### 核心主张（未验证）

小模型对齐存在边际收益递减点：训练集的前 \(p\%\)“高密度样本”贡献主要提升，后续数据收益明显下降甚至引入噪声。

### 为什么它具有潜力（工程含义）

- **训练成本**：用更少数据达到相同对齐/检索指标 → 降低蒸馏与迭代成本
- **核心特性**：可以在论文/技术报告中用 1 张曲线讲清楚“数据效率阈值”

### 最小实验（建议的执行顺序）

在 `qwen-sentence-align v2.1` 的现有 pipeline 上做训练比例扫描（固定训练步数/epoch，控制变量）：

- 数据比例：1%、5%、10%、20%、50%、100%
- 指标：
  - 对齐：avg cosine / P95 / Spearman
  - 下游：CPU-only Leave-One-Out Recall@K / MRR
  - 门控：output-level gate 的 accept 曲线（如果成本允许）

输出物（验收标准）：
- 1 张 `data_ratio_vs_metrics.png`
- 1 份 `data_ratio_vs_metrics.csv`
- 1 份 `report.md`（明确 elbow 点与推荐比例）

## 2) Spectral Distillation（频谱蒸馏：Spectral Loss）

### 核心主张（未验证）

仅对齐向量方向（cosine）可能不足以约束“结构一致性”；对齐 embedding 的频谱能量分布（FFT 幅度谱）可能帮助捕捉组合结构/长依赖统计特征。

### 为什么它具有潜力（工程含义）

- **鲁棒性**：减少不同输出风格导致的 gate/retrieval 波动（潜在收益）
- **理论价值**：不用真的做复数网络，也能用“频谱/相位”描述研究特征

### 最小改动（只动训练 loss）

令 aligned 向量为 \(z_s\)，teacher 向量为 \(z_t\)，对它们做实数 FFT：

\[
L_{spec}=\mathrm{MSE}(|\mathrm{RFFT}(z_s)|,|\mathrm{RFFT}(z_t)|)
\]

总损失：
\[
L = L_{cos} + \lambda \cdot L_{spec}
\]

可从 \(\lambda \in \{0.001, 0.01, 0.05\}\) 扫描，先只对齐“幅度谱”，相位相关内容留作 future work。

输出物（验收标准）：
- A/B 对比表（baseline vs +spectral）：对齐指标 + 检索指标
- 频谱可视化（至少 1 张对比图）

### 已产生的基线证据（已跑通，但**不代表 Spectral Loss 有效**）

> 这是一份 **“未加 Spectral Loss”** 的频域度量 baseline，用于后续 A/B 对照：  
> - mapped draft embedding：`mapped = W * draft_emb`  
> - teacher embedding：`teacher_emb`

- **Artifacts**
  - CSV：`benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline.csv`
  - 图：`benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline.png`
  - 报告：`benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline_report.md`

- **Summary（Samples=3, Ollama + qwen2.5:0.5b vs qwen2.5:7b, W_v2_1.npy）**
  - cosine(mapped, teacher)：mean=0.419761, p50=0.396737, p95=0.472700
  - spec_mse（|RFFT| 幅度谱，L2 归一化后 MSE）：mean=0.00020555
  - spec_cosine（幅度谱余弦）：mean=0.815723

- **Re-run**
  - `py -3.12 tests/test_spectral_alignment.py --n 10`

## 3) 迁移规则（非常重要）

只有当满足以下条件时，才把结论写入 `docs/research/`：

- 有可复现脚本（含 seed/配置）
- 有原始数据（CSV/JSON）
- 有图表/报告（能被第三方复核）
- 结论段落中明确“数据来源路径”


