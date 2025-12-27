# Paper Benchmark Suite README
# 论文基准测试套件说明

> **中文摘要**：
> 本文档说明了如何生成用于学术论文的基准测试数据。
> *   **目的**：执行全套自动化测试，生成 CSV 数据和可视化图表，直接用于论文插图。
> *   **覆盖范围**：包括硬件探针、H-Spec 调度效率、图谱内存增长、APO 学习曲线等核心指标。
> *   **产出物**：所有结果将保存在 `benchmark/paper_benchmark/` 目录下。

---

## Overview

This suite automates the collection of experimental data for the T-NSEC research paper. It runs a series of stress tests and ablation studies to verify the system's performance claims.

## How to Run

1.  **Ensure Ollama is running** with `qwen2.5:0.5b` and `qwen2.5:7b`.
2.  **Execute the benchmark script**:

```bash
npm run paper-benchmark
# OR directly via Python (requires matplotlib, pandas)
python scripts/run_complete_benchmark.py
```

## Output Artifacts (产出物)

All results are saved to `benchmark/paper_benchmark/`:

*   `benchmark_metrics_*.csv`: Raw data points.
*   `benchmark_charts_*.png`: Generated plots (Latency, TPS, Memory).
*   `comprehensive_report_*.md`: A summarized report in Markdown format.

## Key Metrics Tracked (核心指标)

1.  **Inference Latency**: Comparison between Direct 7B inference and H-Spec (0.5B + 7B).
2.  **Throughput (TPS)**: Tokens per second improvement.
3.  **Memory Growth**: Graph database size vs. Number of nodes (linear scalability verification).
4.  **Learning Curve**: Accuracy improvement over time via TK-APO feedback loop.
