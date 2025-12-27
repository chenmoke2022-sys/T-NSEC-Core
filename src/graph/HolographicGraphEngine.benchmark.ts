/**
 * HolographicGraphEngine 性能基准测试
 * 
 * 测试目标：
 * - 验证 HDC 方法的 O(1) 时间复杂度特性
 * - 测量不同图谱规模下的查询延迟
 * - 生成性能报告和 CSV 数据
 * 
 * 测试方法：
 * - 从 1,000 到 100,000 节点规模不断增长
 * - 对每个规模执行 1,000 次随机查询
 * - 记录平均查询延迟（毫秒）
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { GraphManager } from './GraphManager.js';
import { HSGE } from './HSGE.js';
import { HDCEngine, hdcEngine } from '../hdc/HDCEngine.js';

/**
 * 基准测试结果
 */
interface BenchmarkResult {
  nodeCount: number;
  edgeCount: number;
  queryCount: number;
  avgQueryLatency: number;      // 毫秒
  minQueryLatency: number;
  maxQueryLatency: number;
  p50Latency: number;           // 中位数
  p95Latency: number;           // 95分位
  p99Latency: number;           // 99分位
  totalTime: number;             // 总耗时（毫秒）
  queriesPerSecond: number;      // QPS
  encodingTime: number;          // 编码总耗时
  searchTime: number;            // 搜索总耗时
}

/**
 * 测试配置
 */
interface BenchmarkConfig {
  minNodes: number;              // 最小节点数
  maxNodes: number;              // 最大节点数
  stepSize: number;              // 步长（节点数）
  queriesPerScale: number;       // 每个规模的查询次数
  dbPath: string;                // 临时数据库路径
  outputCsvPath: string;         // CSV 输出路径
  hops: number;                  // 子图跳数
  topK: number;                  // 返回的 top-K 结果
}

/**
 * 基准测试类
 */
export class HolographicGraphEngineBenchmark {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config?: Partial<BenchmarkConfig>) {
    this.config = {
      minNodes: 1000,
      maxNodes: 100000,
      stepSize: 5000,            // 每 5K 节点一个测试点
      queriesPerScale: 1000,
      dbPath: './data/benchmark-graph.db',
      outputCsvPath: './reports/holographic-benchmark.csv',
      hops: 2,
      topK: 5,
      ...config,
    };
  }

  /**
   * 运行完整基准测试
   */
  async run(): Promise<BenchmarkResult[]> {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     HolographicGraphEngine 性能基准测试                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 节点范围: ${this.config.minNodes.toLocaleString()} - ${this.config.maxNodes.toLocaleString()}`.padEnd(61) + '║');
    console.log(`║ 步长: ${this.config.stepSize.toLocaleString()} 节点`.padEnd(61) + '║');
    console.log(`║ 每规模查询次数: ${this.config.queriesPerScale}`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const nodeCounts: number[] = [];
    for (let n = this.config.minNodes; n <= this.config.maxNodes; n += this.config.stepSize) {
      nodeCounts.push(n);
    }

    // 确保包含最大节点数
    if (nodeCounts[nodeCounts.length - 1] !== this.config.maxNodes) {
      nodeCounts.push(this.config.maxNodes);
    }

    for (let i = 0; i < nodeCounts.length; i++) {
      const nodeCount = nodeCounts[i];
      console.log(`\n[${i + 1}/${nodeCounts.length}] 测试规模: ${nodeCount.toLocaleString()} 节点`);
      console.log('━'.repeat(60));

      const result = await this.benchmarkScale(nodeCount);
      this.results.push(result);

      // 打印当前结果
      this.printResult(result);
    }

    // 生成报告
    await this.generateReport();

    return this.results;
  }

  /**
   * 对特定规模进行基准测试
   */
  private async benchmarkScale(nodeCount: number): Promise<BenchmarkResult> {
    // 创建临时数据库
    const dbPath = `${this.config.dbPath}.${nodeCount}`;
    const graph = new GraphManager(dbPath);
    const hsge = new HSGE(graph, hdcEngine);

    // 生成图谱
    console.log('  [Benchmark] Generating graph');
    const generationStart = performance.now();
    const { edgeCount, nodeIds } = await this.generateGraph(graph, nodeCount);
    const generationTime = performance.now() - generationStart;
    console.log(`  [Benchmark] Graph generation complete (${generationTime.toFixed(0)}ms)`);
    console.log(`     节点数: ${nodeCount.toLocaleString()}`);
    console.log(`     边数: ${edgeCount.toLocaleString()}`);

    // 预编码所有节点（模拟实际使用场景）
    console.log('  🔄 预编码节点结构...');
    const encodingStart = performance.now();
    hsge.encodeAllNodes(this.config.hops);
    const encodingTime = performance.now() - encodingStart;
    console.log(`  [Benchmark] Encoding complete (${encodingTime.toFixed(0)}ms)`);

    // 执行查询测试
    console.log(`  [Benchmark] Running ${this.config.queriesPerScale} random queries`);
    const queryLatencies: number[] = [];
    const searchStart = performance.now();

    for (let i = 0; i < this.config.queriesPerScale; i++) {
      // 随机选择一个查询节点
      const queryNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      
      const queryStart = performance.now();
      
      // 执行 HDC 相似性查询
      const querySignature = hsge.encodeNodeStructure(queryNodeId, this.config.hops);
      const results = hsge.fastSearch(querySignature.vector, this.config.topK);
      
      const queryLatency = performance.now() - queryStart;
      queryLatencies.push(queryLatency);

      // 进度显示
      if ((i + 1) % 100 === 0) {
        const avgSoFar = queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length;
        process.stdout.write(`\r     进度: ${i + 1}/${this.config.queriesPerScale} (平均延迟: ${avgSoFar.toFixed(2)}ms)`);
      }
    }

    const searchTime = performance.now() - searchStart;
    console.log(`\n  [Benchmark] Queries complete (total: ${searchTime.toFixed(0)}ms)`);

    // 计算统计信息
    queryLatencies.sort((a, b) => a - b);
    const avgLatency = queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length;
    const minLatency = queryLatencies[0];
    const maxLatency = queryLatencies[queryLatencies.length - 1];
    const p50Latency = queryLatencies[Math.floor(queryLatencies.length * 0.5)];
    const p95Latency = queryLatencies[Math.floor(queryLatencies.length * 0.95)];
    const p99Latency = queryLatencies[Math.floor(queryLatencies.length * 0.99)];

    // 清理临时数据库
    graph.close();
    try {
      fs.unlinkSync(dbPath);
      fs.unlinkSync(`${dbPath}-wal`);
      fs.unlinkSync(`${dbPath}-shm`);
    } catch (error) {
      // 忽略删除错误
    }

    return {
      nodeCount,
      edgeCount,
      queryCount: this.config.queriesPerScale,
      avgQueryLatency: avgLatency,
      minQueryLatency: minLatency,
      maxQueryLatency: maxLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      totalTime: searchTime,
      queriesPerSecond: (this.config.queriesPerScale / searchTime) * 1000,
      encodingTime,
      searchTime,
    };
  }

  /**
   * 生成测试图谱
   */
  private async generateGraph(
    graph: GraphManager,
    nodeCount: number
  ): Promise<{ edgeCount: number; nodeIds: string[] }> {
    const nodeIds: string[] = [];
    const nodeTypes = ['concept', 'entity', 'event', 'property', 'relation'];
    const relations = [
      'is_a', 'has_a', 'part_of', 'related_to', 'causes',
      'depends_on', 'similar_to', 'contains', 'belongs_to',
    ];

    // 创建节点
    for (let i = 0; i < nodeCount; i++) {
      const nodeType = nodeTypes[i % nodeTypes.length];
      const node = graph.addNode({
        label: `Node_${i}`,
        type: nodeType,
        karma: 0.5 + Math.random() * 0.5,
      });
      nodeIds.push(node.id);
    }

    // 创建边（平均每个节点 3-5 条边）
    // 使用集合避免重复边
    const edgeSet = new Set<string>();
    const avgDegree = 3 + Math.random() * 2;
    const targetEdgeCount = Math.floor(nodeCount * avgDegree);
    let edgeCount = 0;
    let attempts = 0;
    const maxAttempts = targetEdgeCount * 10; // 防止无限循环

    while (edgeCount < targetEdgeCount && attempts < maxAttempts) {
      const sourceIdx = Math.floor(Math.random() * nodeCount);
      const targetIdx = Math.floor(Math.random() * nodeCount);
      
      if (sourceIdx !== targetIdx) {
        const edgeKey = `${nodeIds[sourceIdx]}:${nodeIds[targetIdx]}`;
        
        // 避免重复边
        if (!edgeSet.has(edgeKey)) {
          const relation = relations[Math.floor(Math.random() * relations.length)];
          try {
            graph.addEdge({
              sourceId: nodeIds[sourceIdx],
              targetId: nodeIds[targetIdx],
              relation,
              weight: 0.5 + Math.random() * 0.5,
              karma: 0.5 + Math.random() * 0.5,
            });
            edgeSet.add(edgeKey);
            edgeCount++;
          } catch (error) {
            // 忽略添加边时的错误（可能是重复边）
          }
        }
      }
      attempts++;
    }

    return { edgeCount, nodeIds };
  }

  /**
   * 打印单个测试结果
   */
  private printResult(result: BenchmarkResult): void {
    console.log('\n  📈 测试结果:');
    console.log(`     平均查询延迟: ${result.avgQueryLatency.toFixed(3)}ms`);
    console.log(`     最小延迟: ${result.minQueryLatency.toFixed(3)}ms`);
    console.log(`     最大延迟: ${result.maxQueryLatency.toFixed(3)}ms`);
    console.log(`     P50 (中位数): ${result.p50Latency.toFixed(3)}ms`);
    console.log(`     P95: ${result.p95Latency.toFixed(3)}ms`);
    console.log(`     P99: ${result.p99Latency.toFixed(3)}ms`);
    console.log(`     查询吞吐量: ${result.queriesPerSecond.toFixed(1)} QPS`);
  }

  /**
   * 生成 CSV 报告
   */
  private async generateReport(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              生成性能报告                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 确保输出目录存在
    const outputDir = path.dirname(this.config.outputCsvPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成 CSV
    const csvLines: string[] = [];
    csvLines.push('节点数,边数,查询次数,平均延迟(ms),最小延迟(ms),最大延迟(ms),P50(ms),P95(ms),P99(ms),总耗时(ms),QPS,编码时间(ms),搜索时间(ms)');

    for (const result of this.results) {
      csvLines.push([
        result.nodeCount,
        result.edgeCount,
        result.queryCount,
        result.avgQueryLatency.toFixed(3),
        result.minQueryLatency.toFixed(3),
        result.maxQueryLatency.toFixed(3),
        result.p50Latency.toFixed(3),
        result.p95Latency.toFixed(3),
        result.p99Latency.toFixed(3),
        result.totalTime.toFixed(2),
        result.queriesPerSecond.toFixed(2),
        result.encodingTime.toFixed(2),
        result.searchTime.toFixed(2),
      ].join(','));
    }

    fs.writeFileSync(this.config.outputCsvPath, csvLines.join('\n'), 'utf-8');
    console.log(`[Benchmark] CSV report saved: ${this.config.outputCsvPath}`);

    // 生成摘要报告
    await this.generateSummary();
  }

  /**
   * 生成摘要报告
   */
  private async generateSummary(): Promise<void> {
    if (this.results.length === 0) return;

    const summaryPath = this.config.outputCsvPath.replace('.csv', '-summary.txt');
    const lines: string[] = [];

    lines.push('╔════════════════════════════════════════════════════════════╗');
    lines.push('║     HolographicGraphEngine 性能基准测试摘要              ║');
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push(`║ 测试时间: ${new Date().toISOString()}`.padEnd(61) + '║');
    lines.push(`║ 测试规模: ${this.config.minNodes.toLocaleString()} - ${this.config.maxNodes.toLocaleString()} 节点`.padEnd(61) + '║');
    lines.push(`║ 每规模查询次数: ${this.config.queriesPerScale}`.padEnd(61) + '║');
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ 延迟分析 (验证 O(1) 复杂度):'.padEnd(61) + '║');
    lines.push('╠════════════════════════════════════════════════════════════╣');

    // 计算延迟变化趋势
    const firstResult = this.results[0];
    const lastResult = this.results[this.results.length - 1];
    const scaleFactor = lastResult.nodeCount / firstResult.nodeCount;
    const latencyFactor = lastResult.avgQueryLatency / firstResult.avgQueryLatency;

    lines.push(`║ 节点规模增长: ${scaleFactor.toFixed(1)}x`.padEnd(61) + '║');
    lines.push(`║ 平均延迟增长: ${latencyFactor.toFixed(2)}x`.padEnd(61) + '║');

    if (latencyFactor < 1.5) {
      lines.push('║ ✅ 延迟基本恒定，符合 O(1) 复杂度理论'.padEnd(61) + '║');
    } else if (latencyFactor < Math.log(scaleFactor)) {
      lines.push('║ ⚠️  延迟增长缓慢，接近 O(1) 复杂度'.padEnd(61) + '║');
    } else {
      lines.push('║ ❌ 延迟增长明显，可能不符合 O(1) 复杂度'.padEnd(61) + '║');
    }

    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ 详细结果:'.padEnd(61) + '║');
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ 节点数      │ 平均延迟(ms) │ P95(ms) │ QPS    ║');
    lines.push('╠════════════════════════════════════════════════════════════╣');

    for (const result of this.results) {
      lines.push(
        `║ ${String(result.nodeCount).padStart(10)} │ ${result.avgQueryLatency.toFixed(3).padStart(11)} │ ${result.p95Latency.toFixed(3).padStart(7)} │ ${result.queriesPerSecond.toFixed(1).padStart(6)} ║`
      );
    }

    lines.push('╚════════════════════════════════════════════════════════════╝');

    fs.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');
    console.log(`[Benchmark] Summary report saved: ${summaryPath}`);

    // 打印摘要到控制台
    console.log('\n' + lines.join('\n') + '\n');
  }
}

/**
 * 主函数：运行基准测试
 */
export async function runBenchmark(): Promise<void> {
  const benchmark = new HolographicGraphEngineBenchmark({
    minNodes: 1000,
    maxNodes: 100000,
    stepSize: 5000,
    queriesPerScale: 1000,
    outputCsvPath: './reports/holographic-benchmark.csv',
  });

  try {
    await benchmark.run();
    console.log('\n[Benchmark] Complete');
  } catch (error) {
    console.error('\n❌ 基准测试失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(console.error);
}

export default HolographicGraphEngineBenchmark;

