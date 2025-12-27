# Tree-CoS vs CoS-MoE 对比测试

## 📋 概述

本对比测试用于验证 Tree-CoS（树状一致性模拟）相比传统 CoS-MoE（10次独立并行模拟）的性能优势。

### 测试目标

- **验证延迟降低**：Tree-CoS 是否实现 >60% 的延迟降低
- **GPU 内存对比**：测量两种方法的 GPU 内存峰值占用
- **共识一致性**：比较两种方法的共识一致性分数

### 测试方法

1. **CoS-MoE（方法 A）**：
   - 并行执行 10 次独立的推理任务
   - 每个推理任务完全独立，无共享计算
   - 使用 GPU 并行能力同时处理多个推理

2. **Tree-CoS（方法 B）**：
   - 单次树状推测推理
   - 共享前缀计算（KV-cache 复用）
   - 分支探索多条推理路径
   - 通过共享主干减少计算量

## 🚀 使用方法

### 运行对比测试

```bash
npm run benchmark-treecos-comparison
```

或直接运行：

```bash
npx tsx scripts/benchmark-treecos-comparison.ts
```

### 测试任务

默认测试任务是一个复杂的推理任务：

> 为一个电商网站设计用户登录、商品浏览和下单支付的完整测试用例。请包括：
> 1. 用户登录流程的测试用例（正常登录、错误密码、账户锁定等场景）
> 2. 商品浏览功能的测试用例（搜索、筛选、排序、分页等）
> 3. 下单支付流程的测试用例（添加购物车、结算、支付、订单确认等）
> 请确保测试用例覆盖正常流程和异常情况。

## 📊 测试指标

### 1. 总耗时（Latency）

- **CoS-MoE**：10 次并行推理的总耗时
- **Tree-CoS**：单次树状推理的总耗时
- **延迟降低**：`(CoS-MoE耗时 - Tree-CoS耗时) / CoS-MoE耗时 * 100%`

### 2. GPU 内存峰值占用

- 使用 `nvidia-smi` 或 `InferenceEngine.getGPUStatus()` 监控
- 每 50ms 采样一次 GPU 内存使用
- 记录峰值内存占用

### 3. 共识一致性分数

- **CoS-MoE**：计算 10 次独立推理结果之间的相似度（Jaccard 相似度）
- **Tree-CoS**：使用 `CoSResult.consensusRatio`（路径间的共识比例）

## 📈 输出结果

### 控制台输出

测试会在控制台输出详细的对比结果：

```
╔════════════════════════════════════════════════════════════╗
║                   对比测试结果                            ║
╠════════════════════════════════════════════════════════════╣
║ 性能指标对比:                                             ║
╠════════════════════════════════════════════════════════════╣
║ 总耗时:                                                    ║
║   CoS-MoE:     15000.00ms                                 ║
║   Tree-CoS:    5000.00ms                                  ║
║   延迟降低:    66.7% ✅                                   ║
╠════════════════════════════════════════════════════════════╣
║ GPU内存峰值:                                               ║
║   CoS-MoE:     8500 MB                                    ║
║   Tree-CoS:    6000 MB                                    ║
║   内存降低:    29.4%                                      ║
╠════════════════════════════════════════════════════════════╣
║ 共识一致性分数:                                            ║
║   CoS-MoE:     75.2%                                      ║
║   Tree-CoS:    82.5%                                      ║
║   差异:        +7.3%                                      ║
╚════════════════════════════════════════════════════════════╝
```

### CSV 报告

测试完成后会生成 CSV 文件：`./reports/treecos-comparison.csv`

包含以下列：
- `任务`：测试任务描述
- `CoS-MoE耗时(ms)`：CoS-MoE 总耗时
- `Tree-CoS耗时(ms)`：Tree-CoS 总耗时
- `延迟降低(%)`：延迟降低百分比
- `CoS-MoE内存(MB)`：CoS-MoE GPU 内存峰值
- `Tree-CoS内存(MB)`：Tree-CoS GPU 内存峰值
- `内存降低(%)`：内存降低百分比
- `CoS-MoE共识分数`：CoS-MoE 共识一致性分数
- `Tree-CoS共识分数`：Tree-CoS 共识一致性分数
- `共识差异`：共识分数差异
- `是否达标`：是否达到 >60% 延迟降低目标

## 🔍 技术细节

### GPU 内存监控

使用 `GPUMemoryMonitor` 类进行实时监控：

```typescript
const monitor = new GPUMemoryMonitor(inferenceEngine);
await monitor.startMonitoring(50); // 每50ms采样

// 执行推理...

const peakMemory = monitor.stopMonitoring(); // 获取峰值
```

### 共识一致性计算

**CoS-MoE**：
- 提取所有 10 次推理的结果
- 计算每对结果之间的 Jaccard 相似度
- 平均所有相似度作为共识分数

**Tree-CoS**：
- 使用 `CoSResult.consensusRatio`
- 基于路径间的共识比例计算

### 并行效率

CoS-MoE 的并行效率计算：

```
并行效率 = (平均单次推理耗时 × 10) / 实际总耗时
```

理想情况下应该是 100%（10 倍加速），但实际可能更低，因为：
- GPU 资源竞争
- 内存带宽限制
- 调度开销

## ⚙️ 配置选项

可以在代码中修改配置：

```typescript
const comparisonTest = new TreeCoSComparisonTest(llm, graph, hsge, inferenceEngine);

// 修改并行模拟数量
comparisonTest.numParallelSimulations = 10;

// 修改 Tree-CoS 配置
const treeCoS = new TreeCoSInferencer(llm, graph, hsge, {
  numPaths: 10,        // 路径数
  maxDepth: 5,         // 最大深度
  branchFactor: 3,     // 分支因子
});
```

## 📝 预期结果

### 延迟降低

根据理论分析，Tree-CoS 应该实现：
- **目标**：>60% 延迟降低
- **原理**：通过共享前缀，将 N 次独立推理的计算量从 N 倍降至 ~1.5-2 倍

### GPU 内存

Tree-CoS 的内存占用应该更低，因为：
- 共享 KV-cache
- 不需要同时加载多个独立的推理上下文

### 共识一致性

两种方法的共识一致性分数应该相近，因为：
- 都执行了多次推理路径
- 都通过多数投票或加权融合计算最终结果

## 🔧 故障排除

### GPU 内存监控失败

如果无法监控 GPU 内存：

1. 确保安装了 NVIDIA 驱动
2. 确保 `nvidia-smi` 命令可用
3. 检查 `InferenceEngine` 是否正确初始化

### 测试时间过长

如果测试时间过长，可以：
- 减少并行模拟数量（`numParallelSimulations`）
- 使用更小的模型
- 减少 Tree-CoS 的路径数（`numPaths`）

### 共识分数异常

如果共识分数异常低：
- 检查推理结果是否正常
- 验证字符串相似度计算是否正确
- 确认任务复杂度是否合适

## 📚 相关文档

- [TreeInferencer 文档](../inference/TreeInferencer.ts)
- [LocalLLM 文档](../llm/LocalLLM.ts)
- [InferenceEngine 文档](../inference/InferenceEngine.ts)

## 📊 示例结果

```
任务: 为一个电商网站设计用户登录、商品浏览和下单支付的完整测试用例...

CoS-MoE 结果:
  总耗时: 15234.56ms
  GPU内存峰值: 8723 MB
  共识一致性分数: 76.3%
  平均置信度: 78.5%
  并行效率: 85.2%

Tree-CoS 结果:
  总耗时: 5234.12ms
  GPU内存峰值: 6124 MB
  共识一致性分数: 81.2%
  置信度: 79.8%
  加速比: 2.91x

对比结果:
  延迟降低: 65.6% ✅
  内存降低: 29.8%
  共识差异: +4.9%
  是否达标: 是
```

## 🎯 验收标准

- ✅ **延迟降低**：>60%
- ✅ **GPU 内存**：Tree-CoS 内存占用 ≤ CoS-MoE
- ✅ **共识一致性**：两种方法的共识分数差异 < 10%
- ✅ **RTX 3080 优化**：充分利用 GPU 并行能力

