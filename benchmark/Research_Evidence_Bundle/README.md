# Research Evidence Bundle（可复现证据包）

> **用途**：把“可公开复核的证据”集中在一个目录入口，方便展示与复核。  
> **规则**：这里放 **已验证证据**（图/CSV/报告）。未验证想法只放 `docs/ideas/`。

## 1) Graph Memory 100k Stress Test（检索不塌缩）

- 图：`docs/assets/stress_test_100k.png`
- CSV：`benchmark/stress_test_100k.csv`
- 证据页：`docs/research/Thomas-Lab-Portfolio/appendix/CaseStudy_StressTest_100k.md`

## 2) Superego Learning Curve（Karma 权重熵减 PoC）

- 图：`docs/assets/superego_learning_curve.png`
- 脚本：`examples/superego_test.py`
- 证据页：`docs/research/Thomas-Lab-Portfolio/appendix/CaseStudy_Superego_Karma_Learning.md`

## 3) Paper Benchmark（离线基准：8轮汇总）

- 指标：`reports/paper_benchmark/benchmark_metrics_20251226_184118.csv`
- 报告：`reports/paper_benchmark/comprehensive_report_20251226_184118.md`
- 索引：`reports/paper_benchmark/OVERNIGHT_INDEX_20251226_182337.md`

## 4) Spectral Loss Evidence（频谱蒸馏，待验证）

> 这里先预留位置。当前已跑通 **频域度量的 baseline（未加 Spectral Loss）**，用于后续 A/B 对照；当完成“加 Spectral Loss 的对比结果”后，再把结论写进论文的“已验证证据”。

- Planned：`docs/ideas/Spectral_Distillation_and_Data_Elbow.md`
- Baseline (no spectral loss yet):
  - `benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline.csv`
  - `benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline.png`
  - `benchmark/qwen-sentence-align/reports/spectral/spectral_alignment_baseline_report.md`


