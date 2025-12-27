# SystemSupervisor 资源监控功能

## 📋 概述

`SystemSupervisor` 的资源监控功能用于实时监控系统在高负载下的资源使用情况，帮助分析系统稳定性和性能瓶颈。

### 监控指标

1. **系统内存使用量**：系统 RAM 的使用情况（MB 和百分比）
2. **GPU 显存使用量**：GPU VRAM 的使用情况（MB 和百分比）
3. **GPU 利用率**：GPU 计算负载百分比
4. **CPU 整体利用率**：CPU 整体使用率百分比
5. **GPU 温度**（可选）：GPU 温度（°C）

### 采样频率

默认每秒采样一次（1000ms），可在启动监控时自定义间隔。

## 🚀 使用方法

### 基本用法

```typescript
import { SystemSupervisor, ResourceMonitor } from './src/core/SystemSupervisor.js';
import { InferenceEngine } from './src/inference/InferenceEngine.js';

// 初始化系统监督器
const supervisor = new SystemSupervisor();
await supervisor.initialize('env1');

// 创建推理引擎（用于 GPU 监控）
const inferenceEngine = new InferenceEngine({...});
await inferenceEngine.initialize();

// 创建资源监控器
const monitor = supervisor.createResourceMonitor(inferenceEngine);

// 开始监控（每秒采样一次）
monitor.startMonitoring(1000);

// ... 执行任务 ...

// 停止监控并获取统计
const stats = monitor.stopMonitoring();

// 打印统计报告
monitor.printStats();

// 生成 ASCII 图表
console.log(monitor.generateASCIIChart('systemMemory'));
console.log(monitor.generateASCIIChart('gpuMemory'));
console.log(monitor.generateASCIIChart('gpuUtilization'));
console.log(monitor.generateASCIIChart('cpuUtilization'));

// 导出数据
monitor.exportJSON('./reports/resource-monitor.json');
monitor.exportCSV('./reports/resource-monitor.csv');
```

### 在集成测试中使用

资源监控已集成到 `scripts/run-integration-test.ts` 中：

```bash
npm run integration-test "整理我桌面上的所有截图文件，并按日期重命名"
```

测试会自动：
1. 在任务开始时启动资源监控
2. 每秒采样一次资源使用情况
3. 在任务结束时停止监控
4. 生成统计报告和 ASCII 图表
5. 导出 JSON 和 CSV 数据

## 📊 输出格式

### 控制台输出

#### 统计报告

```
╔════════════════════════════════════════════════════════════╗
║              资源监控统计报告                              ║
╠════════════════════════════════════════════════════════════╣
║ 监控时长: 45.23s                                           ║
║ 采样数量: 45                                               ║
╠════════════════════════════════════════════════════════════╣
║ 系统内存:                                                  ║
║   平均使用: 8.45 GB                                        ║
║   峰值使用: 12.34 GB                                       ║
╠════════════════════════════════════════════════════════════╣
║ GPU 显存:                                                  ║
║   平均使用: 10.23 GB                                      ║
║   峰值使用: 11.56 GB                                       ║
╠════════════════════════════════════════════════════════════╣
║ GPU 利用率:                                                ║
║   平均: 85.3%                                              ║
║   峰值: 97.5%                                              ║
╠════════════════════════════════════════════════════════════╣
║ CPU 利用率:                                                ║
║   平均: 45.2%                                              ║
║   峰值: 78.9%                                              ║
╠════════════════════════════════════════════════════════════╣
║ GPU 温度:                                                  ║
║   平均: 72.5°C                                             ║
║   峰值: 85.0°C                                             ║
╚════════════════════════════════════════════════════════════╝
```

#### ASCII 图表

```
系统内存使用率 趋势图 (45.2% - 78.9%)
──────────────────────────────────────────────────────────────
 79% │                                                      █
 75% │                                                  ████
 71% │                                              ████
 67% │                                          ████
 63% │                                      ████
 59% │                                  ████
 55% │                              ████
 51% │                          ████
 47% │                      ████
 45% │                  ████
     └──────────────────────────────────────────────────────
      时间 → (60 个采样点)
```

### JSON 输出

```json
{
  "samples": [
    {
      "timestamp": 1234567890123,
      "systemMemoryUsedMB": 8654.32,
      "systemMemoryTotalMB": 16384.0,
      "systemMemoryPercent": 52.8,
      "gpuMemoryUsedMB": 10485.76,
      "gpuMemoryTotalMB": 16384.0,
      "gpuMemoryPercent": 64.0,
      "gpuUtilization": 85.5,
      "cpuUtilization": 45.2,
      "gpuTemperature": 72.5
    },
    ...
  ],
  "duration": 45230,
  "avgSystemMemoryMB": 8456.78,
  "peakSystemMemoryMB": 12345.67,
  "avgGPUMemoryMB": 10234.56,
  "peakGPUMemoryMB": 11567.89,
  "avgGPUUtilization": 85.3,
  "peakGPUUtilization": 97.5,
  "avgCPUUtilization": 45.2,
  "peakCPUUtilization": 78.9,
  "avgGPUTemperature": 72.5,
  "peakGPUTemperature": 85.0
}
```

### CSV 输出

```csv
时间戳,系统内存使用(MB),系统内存总量(MB),系统内存使用率(%),GPU显存使用(MB),GPU显存总量(MB),GPU显存使用率(%),GPU利用率(%),CPU利用率(%),GPU温度(°C)
1234567890123,8654.32,16384.00,52.80,10485.76,16384.00,64.00,85.50,45.20,72.5
1234567891123,8723.45,16384.00,53.20,10523.45,16384.00,64.20,87.30,46.50,73.2
...
```

## 🔍 技术细节

### CPU 利用率计算

CPU 利用率通过比较两次采样之间的 CPU 时间计算：

```typescript
usage = 100 - (idleDiff / totalDiff) * 100
```

其中：
- `idleDiff`：两次采样之间的空闲时间差
- `totalDiff`：两次采样之间的总时间差

### GPU 状态获取

优先使用 `InferenceEngine.getGPUStatus()`，如果不可用，则直接调用 `nvidia-smi`：

```bash
nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu --format=csv,noheader,nounits
```

### 采样间隔

默认 1000ms（1秒），可根据需要调整：
- **更频繁采样**（如 500ms）：更详细的数据，但可能影响性能
- **更稀疏采样**（如 2000ms）：减少开销，但可能错过峰值

## 📈 数据分析

### 识别瓶颈

通过分析资源监控数据，可以识别：

1. **内存瓶颈**：
   - 系统内存使用率持续 > 90%
   - GPU 显存使用率接近 100%

2. **计算瓶颈**：
   - GPU 利用率持续 > 95%（可能受限于计算能力）
   - CPU 利用率持续 > 90%（可能受限于 CPU 处理能力）

3. **温度问题**：
   - GPU 温度 > 85°C（可能触发降频）

### 稳定性分析

- **内存泄漏**：系统内存使用量持续上升
- **资源竞争**：GPU/CPU 利用率波动剧烈
- **性能退化**：相同任务下资源使用量随时间增加

## ⚙️ 配置选项

### 自定义采样间隔

```typescript
monitor.startMonitoring(500); // 每 500ms 采样一次
```

### 自定义图表尺寸

```typescript
monitor.generateASCIIChart('gpuUtilization', 80, 15); // 宽度80，高度15
```

### 清空数据

```typescript
monitor.clear(); // 清空所有采样数据
```

## 🔧 故障排除

### GPU 监控失败

如果 GPU 监控返回 0 或空值：

1. 检查 `nvidia-smi` 是否可用
2. 检查 NVIDIA 驱动是否正确安装
3. 检查 `InferenceEngine` 是否正确初始化

### CPU 利用率始终为 0

CPU 利用率需要至少 2 次采样才能计算。确保：
1. 监控运行时间 > 采样间隔
2. 采样间隔足够大（建议 >= 500ms）

### 内存数据异常

如果内存数据异常：
1. 检查系统是否有足够权限读取内存信息
2. 在 Windows 上可能需要管理员权限

## 📚 相关文档

- [SystemSupervisor 文档](./SystemSupervisor.ts)
- [InferenceEngine 文档](../inference/InferenceEngine.ts)
- [集成测试脚本](../../scripts/run-integration-test.ts)

## 📝 示例输出

运行集成测试后的典型输出：

```
📊 资源监控已停止（总时长: 45.23s，采样数: 45）

╔════════════════════════════════════════════════════════════╗
║              资源监控统计报告                              ║
╠════════════════════════════════════════════════════════════╣
║ 监控时长: 45.23s                                           ║
║ 采样数量: 45                                               ║
╠════════════════════════════════════════════════════════════╣
║ 系统内存:                                                  ║
║   平均使用: 8.45 GB                                        ║
║   峰值使用: 12.34 GB                                       ║
╠════════════════════════════════════════════════════════════╣
║ GPU 显存:                                                  ║
║   平均使用: 10.23 GB                                      ║
║   峰值使用: 11.56 GB                                       ║
╠════════════════════════════════════════════════════════════╣
║ GPU 利用率:                                                ║
║   平均: 85.3%                                              ║
║   峰值: 97.5%                                              ║
╠════════════════════════════════════════════════════════════╣
║ CPU 利用率:                                                ║
║   平均: 45.2%                                              ║
║   峰值: 78.9%                                              ║
╚════════════════════════════════════════════════════════════╝

系统内存使用率 趋势图 (45.2% - 78.9%)
──────────────────────────────────────────────────────────────
 79% │                                                      █
 75% │                                                  ████
 71% │                                              ████
...
```

✅ 资源监控数据已导出为 JSON: ./reports/resource-monitor-1234567890.json
✅ 资源监控数据已导出为 CSV: ./reports/resource-monitor-1234567890.csv

