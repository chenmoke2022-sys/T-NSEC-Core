# 研发资产分布与路线图 (Research Roadmap & Asset Matrix)

> **核心原则**：严格区分“已验证的研究资产 (Verified Assets)”与“规划中的实验 (Planned/Future Work)”。

## 1. 研发阶段定位

当前 `T-NSEC-CORE` 定位为 **Neuro‑Symbolic Research Runtime（神经符号研究运行时）**。它不是一个最终的商业 OS，而是一个用于验证边缘侧认知模型、外部记忆演化及推理路由算法的**研究试验床**。

### 已实现的核心内核 (Research Runtime)
- **图谱内核**：基于 SQLite 的高性能拓扑存储。
- **编码引擎**：HDC (超维计算) 与 H‑SGE (全息稀疏图编码)。
- **推理调度**：H‑Spec 任务感知路由与推测解码原型。
- **记忆演化**：TK‑APO (时间业力优化) 衰减与强化机制。
- **评测仪器**：自动化基准测试链路 (CSV/JSON/Metrics 导出)。

---

## 2. 核心研发资产矩阵

### A. 知识图谱记忆层 (Graph Memory)
- **实现入口**：`src/graph/GraphManager.ts`
- **验证证据**：
  - `tests/graph-manager.test.ts` (单元测试闭环)
  - `benchmark/stress_test_100k.csv` (10 万节点检索不塌缩压力测试)
- **学术价值**：验证了拓扑结构在边缘侧存储与检索的稳定性。

### B. 超维编码与类比 (HDC & H‑SGE)
- **实现入口**：`src/hdc/HDCEngine.ts` / `src/graph/HSGE.ts`
- **验证证据**：
  - `npm run verify-hdc`
  - `reports/paper_benchmark/` (含类比迁移率指标)
- **学术价值**：将符号结构映射为稠密向量，实现跨域概念类比。

### C. 推理路由与 H‑Spec (Inference & Routing)
- **实现入口**：`src/inference/HSpecScheduler.ts`
- **验证证据**：
  - `tests/hspec-scheduler.test.ts`
  - `benchmark/qwen-sentence-align/reports/hspec_gate_v2_1_output_calibrated_report.md` (门控校准曲线)
- **学术价值**：证明了基于输出口径约束的资源路由能有效降低推理能耗。

### D. 持续学习与熵减 (TK‑APO & GGA)
- **实现入口**：`src/evolution/TKAPOCalibrator.ts` / `src/evolution/DreamEngine.ts`
- **验证证据**：
  - `docs/assets/superego_learning_curve.png` (无梯度行为矫正 PoC)
  - `examples/superego_test.py`
- **学术价值**：验证了通过 Karma (业力) 权重调节实现非参数化持续学习的可行性。

---

## 3. 研发演进表 (Roadmap)

| 模块 | 状态 | 证据入口 | 备注 |
|---|---|---|---|
| **核心图谱算子** | ✅ 已验证 | `src/graph/*` | 支持子图提取与 PPR 检索 |
| **H‑Spec 推理路由** | ✅ 已验证 | `src/inference/*` | 产出可调门控校准曲线 |
| **TK‑APO 熵减机制** | 🧪 PoC 阶段 | `examples/superego_test.py` | 验证了 Karma 累积与误差下降关系 |
| **Spectral Loss** | 📅 规划中 | `docs/ideas/` | 已跑出 baseline 频域数据 |
| **MCP 插件生态** | 📅 规划中 | - | 属于产品化路线，非研究核心 |
| **D‑VSR 视觉推理** | 📅 规划中 | - | 下一阶段 GUI 自动化核心 |

---

## 4. 资产分层与合规规则

1. **Research Assets**：必须具备 *代码实现 + 原始数据 (CSV) + 验证报告*。
2. **Planned Experiments**：已确定实验方案，但尚未产生论文级数据的模块。
3. **Speculative Ideas**：存放于 `docs/ideas/`，不作为核心实验结论。
