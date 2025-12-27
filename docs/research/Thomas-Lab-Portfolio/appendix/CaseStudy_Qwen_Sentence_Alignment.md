# 附录 A：Qwen 0.5B→7B 检索感知语义空间对齐 (v2.1)

## 1. 核心贡献

本项目开发了一套针对边缘侧 CPU 推理场景的语义对齐流水线，成功将 Qwen2.5‑0.5B 模型的嵌入向量对齐至 7B 教师模型。

### 实验闭环说明：
- **可运行性**：提供了从数据集生成到训练评测的完整脚本。
- **可量化性**：对齐质量与下游检索收益均经过严格测量。
- **数据来源说明**：训练集采用 LLM 生成的蒸馏集 (Synthetic Distillation Set)。

---

## 2. 已验证的关键指标

> 数据汇总自 `benchmark/qwen-sentence-align/reports/alignment_metrics_v2_1.csv`

### A. 语义空间对齐质量 (Draft vs Aligned vs Teacher)
| 状态 | Avg Cosine | P95 | Spearman ρ |
|---|---|---|---|
| **对齐后 (v2.1)** | **0.9835** | **0.9932** | **0.9552** |

### B. CPU‑only 下游检索收益 (Leave‑One‑Out)
在“原句不在索引库”的极端场景下，验证对齐头对检索排序的提升：

| 实验组 | Recall@5 | MRR (Mean Reciprocal Rank) |
|---|---|---|
| Raw 0.5B | 0.490 | 0.3087 |
| **Aligned 0.5B (v2.1)** | **0.535** | **0.3329** |
| Teacher 7B | 0.500 | 0.2950 |

**结论**：对齐模型在特定评测集上的表现优于原始教师模型，Recall@5 提升达 **9.2%**，MRR 提升 **7.8%**。

---

## 3. 核心改进路径 (Retrieval-Aware Distillation)

从 v1 到 v2.1，项目经历了两项关键决策迭代：
1. **评测脱饱和**：引入 Leave‑One‑Out 机制，解决早期实验指标虚高（Recall=1.0）的问题。
2. **检索损失注入**：在传统的 Cosine 对齐损失上，额外引入 **Triplet Loss**（三元组损失），将优化目标从“向量接近”升级为“序结构一致”。

---

## 4. 实验资产索引

- **证据目录**：`benchmark/qwen-sentence-align/`
- **详细报告**：`reports/v2_1_alignment_report.md`
- **对齐权重**：`artifacts/W_v2_1.npy`
- **训练配置**：`artifacts/run_config_v2_1.json`
