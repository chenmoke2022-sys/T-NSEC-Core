# 附录 C：Graph Memory 10 万项压力测试（Retrieval Collapse Audit）

## 结论先行（可引用）

- **检索稳定性**：从 10k → 100k 项，**Golden Memory 的检索排名始终为 Rank=1**（未出现 retrieval collapse）。
- **内存增长**：RAM 从 **41.51MB → 55.20MB**，呈近似线性增长（+13.69MB/100k）。
- **可扩展性**：端到端耗时从 **0.47s → 7.48s**（100k）。

## 证据文件（真实存在）

- **CSV（原始数据）**：`benchmark/stress_test_100k.csv`
- **图表**：`docs/assets/stress_test_100k.png`
- **测试脚本**：`tests/stress_test_retrieval_collapse.py`
- **绘图脚本**：`scripts/plot_stress_test.py`

## 实验设置（口径说明）

- **目标**：回答一个系统问题——当图记忆规模增长到 100k 时，检索是否会“塌缩”（目标项排名快速下降或丢失）。
- **Golden Memory**：固定的目标节点（在持续插入新节点后，仍应被 top‑1 命中）。
- **Embedding**：使用 `MockEmbedder` 生成 **896 维、L2 归一化**随机向量（用于压测“存储/索引/相似度检索”路径，不代表语义质量）。
- **存储**：SQLite（WAL），embedding 以 BLOB 形式写入与读取。
- **排名指标**：对所有节点计算余弦相似度并排序，记录目标节点排名（1‑based，-1 表示未找到）。

## 如何复现（Windows / Python 3.12.7）

在 `T-NSEC-CORE/` 下：

```bash
py -3.12 -m pip install -U numpy psutil tqdm matplotlib
py -3.12 tests\stress_test_retrieval_collapse.py --max-items 100000 --output .\benchmark\stress_test_100k.csv
py -3.12 scripts\plot_stress_test.py
```

> 运行完成后，图表默认输出到 `docs/assets/stress_test_100k.png`。

## 研究范围与局限性 (Scope & Limitations)

- 该压测证明的是 **Graph Memory 的“结构与工程可扩展性”**（不会因规模而崩溃），不证明“语义检索质量”。
- 若要进一步做成论文级对比实验：可把 `MockEmbedder` 替换为真实 embedding（例如本地 embedding server），并加入 **吞吐/延迟/内存占用** 的多配置扫描。


