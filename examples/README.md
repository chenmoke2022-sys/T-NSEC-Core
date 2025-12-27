## Examples（演示脚本）

这里存放演示与概念验证（PoC）脚本：

- **CPU‑First**：在纯 CPU 下跑通的最小推理/检索/门控 demo  
- **Evidence‑Driven**：直接读取 `benchmark/` 下的 CSV/报告，打印关键指标与对照

### superego_test.py - 超我概念验证实验

**目的**：验证 T-NSEC 的"超我"概念，展示通过 Karma 权重调节实现行为矫正（无需梯度反向传播）

**实验设计**：
- **本我（Id）**：模拟 0.5B 模型的幻觉，随机生成错误答案
- **环境（Truth）**：简单的加法计算器（1+1=2）
- **TK-APO（业力）**：根据正确性更新 Karma 权重
  - 正确：Karma + 2
  - 错误：Karma - 2
- **超我（Superego）**：使用 Karma 权重影响本我的行为选择

**运行方法**：
```bash
py -3.12 examples\superego_test.py
```

**预期结果**：
- 错误率从早期 ~30% 降低到后期 ~7%
- Karma 权重从 0 增长到 100+
- 展示无需梯度反向传播的行为矫正效果

**依赖**：
- Python 3.12+
- numpy（必需）
- matplotlib（可选，用于可视化）

**安装依赖**：
```bash
py -3.12 -m pip install -U numpy matplotlib
```


