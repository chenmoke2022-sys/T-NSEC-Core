# 论文基准测试指南

## 概述

此脚本用于根据交付包.md的要求，运行完整的基准测试并生成论文所需的所有数据：
- CSV数据文件
- 性能图表
- 综合测试报告

## 快速开始

### 方法1: 使用批处理脚本（Windows）

```bash
scripts\run_complete_benchmark.bat
```

### 方法2: 使用Python脚本

```bash
# Windows
py -3.12 scripts\run_complete_benchmark.py

# Linux/Mac
python3.12 scripts/run_complete_benchmark.py
```

### 方法3: 使用npm脚本

```bash
npm run paper-benchmark
```

## 测试流程

脚本将执行以下步骤：

1. **检查/启动服务器**
   - 检查4个模型服务器是否运行（0.5B, 1.5B, 3B, 14B）
   - 如果未运行，提示启动或自动启动

2. **运行TypeScript基准测试**
   - 执行 `benchmark-full.ts`
   - 测试H-SGE、Tree-CoS、TK-APO等核心模块
   - 生成JSON报告

3. **收集服务器测试数据**
   - 对每个服务器运行推理测试
   - 收集延迟、TPS、GPU指标等

4. **导出数据**
   - 生成CSV文件（服务器测试结果、基准指标）

5. **生成报告**
   - 生成Markdown格式的综合报告

6. **生成图表**
   - 生成性能对比图表（需要matplotlib）

## 输出文件

脚本运行时会把原始结果写到本地 `reports/paper_benchmark/`（默认被 `.gitignore` 忽略，不随开源发布）。  
开源仓中会额外保留一份“可公开的证据快照”在 `benchmark/paper_benchmark/`（CSV/图/报告），便于读者直接复核。

### CSV文件

1. **server_tests_YYYYMMDD_HHMMSS.csv**
   - 服务器测试结果
   - 包含：服务器、端口、测试输入、延迟、TPS、GPU指标等
   - **说明**：属于原始运行日志，默认不提交到开源仓（会备份到根目录 `backup/`）

2. **benchmark_metrics_YYYYMMDD_HHMMSS.csv**
   - TypeScript基准测试指标
   - 包含：BWT、认知熵、类比迁移率、延迟统计、图谱指标、GPU指标等

### 报告文件

**comprehensive_report_YYYYMMDD_HHMMSS.md**
- 综合测试报告
- 包含所有关键指标和统计信息

### 图表文件

**benchmark_charts_YYYYMMDD_HHMMSS.png**
- 性能对比图表
- 包含：服务器延迟对比、TPS对比、延迟分布、核心指标、性能指标、GPU指标

## 依赖要求

### Python包

```bash
# 必需
pip install requests

# 可选（用于生成图表）
pip install matplotlib numpy
```

### Node.js环境

- Node.js >= 20.0.0
- 已安装项目依赖（`npm install`）

### 服务器

确保4个模型服务器已启动或可以启动：
- 0.5B: 端口 8080
- 1.5B: 端口 8081
- 3B: 端口 8082
- 14B: 端口 8083

## 测试内容

### TypeScript基准测试

根据交付包.md要求，测试以下模块：

1. **硬件基准** - CPU/内存性能
2. **HDC性能** - 超维计算编码和相似度
3. **图谱操作** - 节点/边插入、查询性能
4. **H-SGE编码** - 全息稀疏图编码性能
5. **Tree-CoS推理** - 树状一致性模拟
6. **TK-APO记忆演化** - 时间业力优化
7. **流式更新** - 增量更新性能
8. **夜间巩固** - GGA抽象

### 服务器测试

对每个模型服务器测试：
- 推理延迟
- TPS (Tokens Per Second)
- GPU内存使用
- GPU负载

## 关键指标

### 核心认知指标

- **BWT (Backward Transfer)**: 后向迁移能力
- **认知熵**: 图结构复杂度
- **类比迁移率**: 跨域知识应用能力
- **校准误差 (ECE)**: 置信度校准准确性

### 性能指标

- **延迟统计**: 平均、P50、P95、P99
- **TPS**: Tokens Per Second
- **GPU指标**: VRAM使用、GPU负载、能效比

### 图谱指标

- **节点数/边数**: 图谱规模
- **平均Karma**: 知识重要性
- **模块度**: 图结构质量

## 验收标准

根据交付包.md的要求：

- ✅ H-SGE类比查询 < 10ms
- ✅ Tree-CoS 10路径 ≤ 3s
- ✅ 认知熵下降 ≥ 20%
- ✅ 单次更新 < 50ms
- ✅ 夜间巩固模块度提升 ≥ 10%

## 故障排除

### 问题1: 服务器未启动

**解决方案**:
```bash
# 手动启动服务器
scripts\start_models.bat
# 或
py -3.12 scripts\start_models.py
```

### 问题2: TypeScript基准测试失败

**检查**:
- Node.js版本是否正确
- 依赖是否已安装 (`npm install`)
- 模型文件是否存在

### 问题3: 图表未生成

**解决方案**:
```bash
pip install matplotlib numpy
```

### 问题4: Python版本错误

**解决方案**:
```bash
# 检查Python版本
py -3.12 --version

# 如果未安装Python 3.12.7，请从官网下载
```

## 数据使用

生成的CSV文件可以直接用于：
- Excel分析
- Python数据分析（pandas）
- R统计分析
- 论文图表制作

报告文件可以：
- 直接用于论文
- 转换为PDF（使用pandoc等工具）
- 在线展示（GitHub等）

## 示例输出

```
reports/paper_benchmark/
├── server_tests_20251223_143022.csv          # 原始运行日志（默认不提交开源仓）
├── benchmark_metrics_20251223_143022.csv
├── comprehensive_report_20251223_143022.md
└── benchmark_charts_20251223_143022.png
```

## 注意事项

1. **测试时间**: 完整测试可能需要30-60分钟
2. **资源占用**: 确保有足够的GPU显存和系统内存
3. **数据备份**: 测试前建议备份现有数据
4. **多次运行**: 建议运行多次取平均值，提高数据可靠性

## 联系与支持

如有问题，请查看：
- `交付包.md` - 项目需求文档
- `CUDA_SETUP.md` - CUDA配置指南
- `DEPLOYMENT.md` - 部署指南

