# 附录 D：Superego（超我）学习曲线——用 Karma 权重实现“无梯度行为矫正”

## 结论先行（可引用）

- **熵减（错误率下降）**：随着迭代推进，系统的（平滑）错误率呈显著下降趋势。
- **“超我”形成（Karma 累积）**：Karma 权重随正确反馈持续累积，作为对本我（随机/幻觉）行为的外部约束。
- **意义**：这是一份最小可复现的 PoC，证明“持续学习可以首先发生在外部记忆/权重上”，而不是依赖梯度更新。

## 证据文件（真实存在）

- **脚本**：`examples/superego_test.py`
- **图表（结果）**：`docs/assets/superego_learning_curve.png`

## 实验设计（口径说明）

- **本我（Id）**：模拟小模型的“幻觉/随机错误”，输出答案可能错误。
- **环境（Truth）**：简单的加法真值函数（例如 1+1=2）。
- **TK‑APO（业力更新）**：根据正确/错误对 Karma 做稀疏更新（奖励/惩罚），并设置负向下界，避免系统不可恢复。
- **超我（Superego）**：把 Karma 映射为“做出正确行为”的概率偏置（使用 `tanh` 平滑映射），从而在不使用反向传播的前提下实现行为矫正。

## 如何复现（Windows / Python 3.12.7）

在 `T-NSEC-CORE/` 下：

```bash
py -3.12 -m pip install -U numpy matplotlib
py -3.12 examples\superego_test.py
```

> 运行完成后，图表会写入 `docs/assets/superego_learning_curve.png`。

## 研究范围与局限性 (Scope & Limitations)

- 这是一个 **概念验证（PoC）**：用“可解释的外部权重”展示熵减趋势，并非真实业务任务的最终指标。
- 该实验定位为：**TK‑APO 机制的最小闭环演示**（可解释、可复现、成本极低）。更严谨的 Continual Learning 基准作为后续实验。


