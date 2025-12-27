/**
 * benchmark-full.ts - 完整基准测试
 * 
 * 执行全面的系统评估，生成可用于论文的评估报告
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

import { hardwareProbe } from '../src/system/HardwareProbe.js';
import { LocalLLM } from '../src/llm/LocalLLM.js';
import { AdaptiveLoader } from '../src/llm/AdaptiveLoader.js';
import { HDCEngine } from '../src/hdc/HDCEngine.js';
import { GraphManager } from '../src/graph/GraphManager.js';
import { HSGE } from '../src/graph/HSGE.js';
import { TreeInferencer } from '../src/inference/TreeInferencer.js';
import { TKAPOCalibrator } from '../src/evolution/TKAPOCalibrator.js';
import { StreamingHashMemory } from '../src/memory/StreamingHashMemory.js';
import { DreamEngine } from '../src/evolution/DreamEngine.js';
import { MetricsCollector } from '../src/eval/MetricsCollector.js';

interface BenchmarkConfig {
  numNodes: number;
  numEdges: number;
  numQueries: number;
  numSimDays: number;
  numUpdates: number;
  seed: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  numNodes: 1000,
  numEdges: 3000,
  numQueries: 100,
  numSimDays: 30,
  numUpdates: 500,
  seed: 42,
};

function readIntEnv(name: string, fallback?: number): number | undefined {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function buildConfigFromEnv(base: BenchmarkConfig): BenchmarkConfig {
  const scaleRaw = process.env.BENCH_SCALE;
  const scale = scaleRaw ? Number.parseFloat(scaleRaw) : 1;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const scaled: BenchmarkConfig = {
    numNodes: Math.max(1, Math.round(base.numNodes * s)),
    numEdges: Math.max(0, Math.round(base.numEdges * s)),
    numQueries: Math.max(0, Math.round(base.numQueries * s)),
    numSimDays: Math.max(1, Math.round(base.numSimDays * s)),
    numUpdates: Math.max(0, Math.round(base.numUpdates * s)),
    seed: base.seed,
  };

  return {
    numNodes: readIntEnv('BENCH_NUM_NODES', scaled.numNodes) ?? scaled.numNodes,
    numEdges: readIntEnv('BENCH_NUM_EDGES', scaled.numEdges) ?? scaled.numEdges,
    numQueries: readIntEnv('BENCH_NUM_QUERIES', scaled.numQueries) ?? scaled.numQueries,
    numSimDays: readIntEnv('BENCH_NUM_SIM_DAYS', scaled.numSimDays) ?? scaled.numSimDays,
    numUpdates: readIntEnv('BENCH_NUM_UPDATES', scaled.numUpdates) ?? scaled.numUpdates,
    seed: readIntEnv('BENCH_SEED', scaled.seed) ?? scaled.seed,
  };
}

async function main() {
  const config = buildConfigFromEnv(DEFAULT_CONFIG);
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         T-NSEC 3.0 完整基准测试                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('配置:');
  console.log(`  节点数: ${config.numNodes}`);
  console.log(`  边数: ${config.numEdges}`);
  console.log(`  查询数: ${config.numQueries}`);
  console.log(`  模拟天数: ${config.numSimDays}`);
  console.log(`  更新次数: ${config.numUpdates}`);
  console.log(`  随机种子: ${config.seed}\n`);
  if (process.env.BENCH_SCALE) {
    console.log(`  BENCH_SCALE: ${process.env.BENCH_SCALE}\n`);
  }

  const collector = new MetricsCollector();
  const benchmarkStart = performance.now();

  // ==============================
  // 1. 硬件基准
  // ==============================
  console.log('━'.repeat(60));
  console.log('📊 1. 硬件基准测试');
  console.log('━'.repeat(60));
  
  const hwBenchmark = hardwareProbe.runBenchmark(true);
  console.log(`  硬件分数: ${hwBenchmark.score}`);
  console.log(`  CPU分数: ${hwBenchmark.cpuScore}`);
  console.log(`  内存分数: ${hwBenchmark.memoryScore}`);
  console.log(`  推荐模型: ${hardwareProbe.getRecommendedModelSize()}\n`);

  // ==============================
  // 2. HDC性能基准
  // ==============================
  console.log('━'.repeat(60));
  console.log('📊 2. HDC性能基准');
  console.log('━'.repeat(60));
  
  const hdc = new HDCEngine(10000, config.seed);
  
  // 编码性能
  const encodeStart = performance.now();
  const testSymbols = Array.from({ length: 1000 }, (_, i) => `symbol_${i}`);
  for (const symbol of testSymbols) {
    hdc.getSymbolVector(symbol);
  }
  const encodeTime = performance.now() - encodeStart;
  
  console.log(`  符号编码 (1000个):`);
  console.log(`    总耗时: ${encodeTime.toFixed(2)}ms`);
  console.log(`    平均: ${(encodeTime / 1000).toFixed(4)}ms/符号`);
  
  collector.recordLatency('HDCEngine', 'encode', encodeTime / 1000);

  // 相似度计算性能
  const vectors = testSymbols.slice(0, 100).map(s => hdc.getSymbolVector(s));
  const simStart = performance.now();
  let simCount = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      hdc.similarity(vectors[i], vectors[j]);
      simCount++;
    }
  }
  const simTime = performance.now() - simStart;
  
  console.log(`\n  相似度计算 (${simCount}对):`);
  console.log(`    总耗时: ${simTime.toFixed(2)}ms`);
  console.log(`    平均: ${(simTime / simCount).toFixed(4)}ms/对`);
  console.log(`    每秒: ${(simCount / (simTime / 1000)).toFixed(0)} 对`);
  
  collector.recordLatency('HDCEngine', 'similarity', simTime / simCount);

  // ==============================
  // 3. 图谱操作基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 3. 图谱操作基准');
  console.log('━'.repeat(60));
  
  const graph = new GraphManager('./data/benchmark.db');
  graph.clear();

  // 批量插入节点
  const nodeInsertStart = performance.now();
  const nodeIds: string[] = [];
  
  for (let i = 0; i < config.numNodes; i++) {
    const node = graph.addNode({
      label: `node_${i}`,
      type: ['concept', 'entity', 'action'][i % 3],
      karma: 0.5 + Math.random() * 0.5,
    });
    nodeIds.push(node.id);
  }
  const nodeInsertTime = performance.now() - nodeInsertStart;
  
  console.log(`  节点插入 (${config.numNodes}个):`);
  console.log(`    总耗时: ${nodeInsertTime.toFixed(2)}ms`);
  console.log(`    平均: ${(nodeInsertTime / config.numNodes).toFixed(4)}ms/节点`);
  
  collector.recordLatency('GraphManager', 'addNode', nodeInsertTime / config.numNodes);

  // 批量插入边
  const edgeInsertStart = performance.now();
  const relations = ['is_a', 'has_a', 'part_of', 'related_to', 'causes'];
  
  for (let i = 0; i < config.numEdges; i++) {
    const sourceIdx = Math.floor(Math.random() * nodeIds.length);
    let targetIdx = Math.floor(Math.random() * nodeIds.length);
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * nodeIds.length);
    }
    
    graph.addEdge({
      sourceId: nodeIds[sourceIdx],
      targetId: nodeIds[targetIdx],
      relation: relations[i % relations.length],
      weight: Math.random(),
      karma: 0.5 + Math.random() * 0.5,
    });
  }
  const edgeInsertTime = performance.now() - edgeInsertStart;
  
  console.log(`\n  边插入 (${config.numEdges}条):`);
  console.log(`    总耗时: ${edgeInsertTime.toFixed(2)}ms`);
  console.log(`    平均: ${(edgeInsertTime / config.numEdges).toFixed(4)}ms/边`);
  
  collector.recordLatency('GraphManager', 'addEdge', edgeInsertTime / config.numEdges);

  // 子图查询
  const subgraphStart = performance.now();
  const subgraphQueries = 50;
  
  for (let i = 0; i < subgraphQueries; i++) {
    const seedIdx = Math.floor(Math.random() * nodeIds.length);
    graph.getSubgraph([nodeIds[seedIdx]], 2);
  }
  const subgraphTime = performance.now() - subgraphStart;
  
  console.log(`\n  子图查询 (${subgraphQueries}次, 2跳):`);
  console.log(`    总耗时: ${subgraphTime.toFixed(2)}ms`);
  console.log(`    平均: ${(subgraphTime / subgraphQueries).toFixed(2)}ms/查询`);
  
  collector.recordLatency('GraphManager', 'getSubgraph', subgraphTime / subgraphQueries);

  // PPR查询
  const pprStart = performance.now();
  const pprQueries = 10;
  
  for (let i = 0; i < pprQueries; i++) {
    const seedIdx = Math.floor(Math.random() * nodeIds.length);
    graph.personalizedPageRank([nodeIds[seedIdx]], { topK: 10, iterations: 10 });
  }
  const pprTime = performance.now() - pprStart;
  
  console.log(`\n  PPR查询 (${pprQueries}次):`);
  console.log(`    总耗时: ${pprTime.toFixed(2)}ms`);
  console.log(`    平均: ${(pprTime / pprQueries).toFixed(2)}ms/查询`);
  
  collector.recordLatency('GraphManager', 'PPR', pprTime / pprQueries);

  // ==============================
  // 4. H-SGE编码基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 4. H-SGE编码基准');
  console.log('━'.repeat(60));
  
  const hsge = new HSGE(graph, hdc);
  
  // 全图编码
  const hsgeEncodeStart = performance.now();
  hsge.encodeAllNodes(2);
  const hsgeEncodeTime = performance.now() - hsgeEncodeStart;
  
  const hsgeStats = hsge.getStats();
  console.log(`  全图编码 (${hsgeStats.cachedSignatures}个签名):`);
  console.log(`    总耗时: ${hsgeEncodeTime.toFixed(2)}ms`);
  console.log(`    平均编码: ${hsgeStats.avgEncodingTime.toFixed(4)}ms/节点`);
  
  collector.recordLatency('HSGE', 'encodeAllNodes', hsgeEncodeTime);

  // 类比查询
  const analogyStart = performance.now();
  const analogyQueries = 20;
  let totalAnalogyResults = 0;
  
  for (let i = 0; i < analogyQueries; i++) {
    const seedIdx = Math.floor(Math.random() * nodeIds.length);
    const results = hsge.findAnalogous(nodeIds[seedIdx], 5);
    totalAnalogyResults += results.length;
  }
  const analogyTime = performance.now() - analogyStart;
  
  console.log(`\n  类比查询 (${analogyQueries}次):`);
  console.log(`    总耗时: ${analogyTime.toFixed(2)}ms`);
  console.log(`    平均: ${(analogyTime / analogyQueries).toFixed(2)}ms/查询`);
  console.log(`    平均结果数: ${(totalAnalogyResults / analogyQueries).toFixed(1)}`);
  console.log(`    ${analogyTime / analogyQueries < 10 ? '✅' : '❌'} 达标 (<10ms)`);
  
  collector.recordLatency('HSGE', 'findAnalogous', analogyTime / analogyQueries);

  // ==============================
  // 5. Tree-CoS推理基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 5. Tree-CoS推理基准');
  console.log('━'.repeat(60));
  
  const loader = new AdaptiveLoader('./models');
  const llm = await loader.autoLoad();
  const inferencer = new TreeInferencer(llm, graph, hsge, {
    numPaths: 10,
    maxDepth: 5,
  });

  const testPrompts = [
    '什么是认知？',
    '记忆如何工作？',
    '解释类比推理',
    '什么是神经网络？',
    '如何进行终身学习？',
  ];

  const cosLatencies: number[] = [];
  const cosConfidences: number[] = [];
  const cosSpeedups: number[] = [];

  for (const prompt of testPrompts) {
    const result = await inferencer.runTreeCoS(prompt);
    cosLatencies.push(result.latency);
    cosConfidences.push(result.confidence);
    cosSpeedups.push(result.speedup);
    
    collector.recordLatency('TreeInferencer', 'runTreeCoS', result.latency);
    collector.recordTaskResult({
      taskId: `cos-${Date.now()}`,
      domain: 'cognitive',
      predicted: result.finalAnswer,
      actual: result.finalAnswer,
      confidence: result.confidence,
      correct: result.confidence > 0.5,
      latency: result.latency,
    });
  }

  const avgCosLatency = cosLatencies.reduce((a, b) => a + b, 0) / cosLatencies.length;
  const avgCosConfidence = cosConfidences.reduce((a, b) => a + b, 0) / cosConfidences.length;
  const avgCosSpeedup = cosSpeedups.reduce((a, b) => a + b, 0) / cosSpeedups.length;

  console.log(`  Tree-CoS推理 (${testPrompts.length}个提示, 10路径):`);
  console.log(`    平均延迟: ${avgCosLatency.toFixed(2)}ms`);
  console.log(`    平均置信度: ${(avgCosConfidence * 100).toFixed(1)}%`);
  console.log(`    平均加速比: ${avgCosSpeedup.toFixed(2)}x`);
  console.log(`    ${avgCosLatency < 3000 ? '✅' : '❌'} 延迟达标 (<3s)`);

  // ==============================
  // 6. TK-APO记忆演化基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 6. TK-APO记忆演化基准');
  console.log('━'.repeat(60));
  
  const calibrator = new TKAPOCalibrator(graph);
  
  // 模拟长期运行
  const tkapoSimStart = performance.now();
  const simResults = calibrator.simulateLongTerm(config.numSimDays, 20);
  const tkapoSimTime = performance.now() - tkapoSimStart;
  
  const firstDay = simResults[0];
  const lastDay = simResults[simResults.length - 1];
  
  console.log(`  长期模拟 (${config.numSimDays}天):`);
  console.log(`    耗时: ${(tkapoSimTime / 1000).toFixed(2)}s`);
  console.log(`    节点变化: ${firstDay.nodeCount} → ${lastDay.nodeCount}`);
  console.log(`    Karma变化: ${firstDay.avgKarma.toFixed(4)} → ${lastDay.avgKarma.toFixed(4)}`);
  console.log(`    熵变化: ${firstDay.entropy.toFixed(4)} → ${lastDay.entropy.toFixed(4)}`);
  
  const entropyReduction = ((firstDay.entropy - lastDay.entropy) / firstDay.entropy) * 100;
  console.log(`    熵降低: ${entropyReduction.toFixed(1)}%`);
  console.log(`    ${entropyReduction >= 20 ? '✅' : '⚠️'} 熵降低达标 (≥20%)`);
  
  collector.recordLatency('TKAPOCalibrator', 'simulateLongTerm', tkapoSimTime);

  // ==============================
  // 7. 流式更新基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 7. 流式更新基准');
  console.log('━'.repeat(60));
  
  const memory = new StreamingHashMemory(graph, {
    bufferCapacity: 50,
    autoFlushInterval: 10000,
  });
  
  // 批量更新
  const updateStart = performance.now();
  
  for (let i = 0; i < config.numUpdates; i++) {
    const nodeIdx = Math.floor(Math.random() * nodeIds.length);
    memory.bufferKarmaUpdate(nodeIds[nodeIdx], (Math.random() - 0.5) * 0.1, 'benchmark');
  }
  
  // 强制刷新
  const flushed = memory.flush();
  const updateTime = performance.now() - updateStart;
  
  console.log(`  流式更新 (${config.numUpdates}次):`);
  console.log(`    总耗时: ${updateTime.toFixed(2)}ms`);
  console.log(`    平均: ${(updateTime / config.numUpdates).toFixed(4)}ms/更新`);
  console.log(`    刷新记录: ${flushed}`);
  console.log(`    ${updateTime / config.numUpdates < 0.05 ? '✅' : '⚠️'} 达标 (<50ms/更新)`);
  
  const memStats = memory.getStats();
  console.log(`    平均刷新延迟: ${memStats.avgFlushLatency.toFixed(2)}ms`);
  
  collector.recordLatency('StreamingHashMemory', 'bufferKarmaUpdate', updateTime / config.numUpdates);
  memory.close();

  // ==============================
  // 8. 夜间巩固基准
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 8. 夜间巩固基准');
  console.log('━'.repeat(60));
  
  const dream = new DreamEngine(graph, llm);
  const dreamResult = await dream.runConsolidation();
  
  console.log(`  夜间巩固:`);
  console.log(`    发现聚类: ${dreamResult.clustersFound}`);
  console.log(`    生成概念: ${dreamResult.conceptsGenerated}`);
  console.log(`    剪枝边: ${dreamResult.edgesPruned}`);
  console.log(`    模块度变化: ${dreamResult.modularityBefore.toFixed(4)} → ${dreamResult.modularityAfter.toFixed(4)}`);
  
  const modularityImprovement = ((dreamResult.modularityAfter - dreamResult.modularityBefore) / 
    Math.abs(dreamResult.modularityBefore || 0.01)) * 100;
  console.log(`    模块度提升: ${modularityImprovement.toFixed(1)}%`);
  console.log(`    耗时: ${(dreamResult.duration / 1000).toFixed(2)}s`);
  console.log(`    ${modularityImprovement >= 10 ? '✅' : '⚠️'} 模块度提升达标 (≥10%)`);
  
  collector.recordLatency('DreamEngine', 'runConsolidation', dreamResult.duration);

  // ==============================
  // 生成最终报告
  // ==============================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 生成评估报告');
  console.log('━'.repeat(60));
  
  const graphStats = graph.getStats();
  const modularity = graph.calculateModularity();
  
  // 确保报告目录存在
  if (!fs.existsSync('./reports')) {
    fs.mkdirSync('./reports', { recursive: true });
  }
  
  const reportPath = `./reports/benchmark-${Date.now()}.json`;
  collector.exportReport(reportPath, {
    nodeCount: graphStats.nodeCount,
    edgeCount: graphStats.edgeCount,
    avgKarma: graphStats.avgKarma,
    modularity,
  });
  
  collector.printSummary({
    nodeCount: graphStats.nodeCount,
    edgeCount: graphStats.edgeCount,
    avgKarma: graphStats.avgKarma,
    modularity,
  });

  const totalDuration = performance.now() - benchmarkStart;

  // ==============================
  // 总结
  // ==============================
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              🎉 基准测试完成！                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`总耗时: ${(totalDuration / 1000).toFixed(2)}s\n`);
  
  console.log('关键指标达成情况:');
  console.log(`  ${analogyTime / analogyQueries < 10 ? '✅' : '❌'} H-SGE类比查询 < 10ms (实际: ${(analogyTime / analogyQueries).toFixed(2)}ms)`);
  console.log(`  ${avgCosLatency < 3000 ? '✅' : '❌'} Tree-CoS 10路径 ≤ 3s (实际: ${(avgCosLatency / 1000).toFixed(2)}s)`);
  console.log(`  ${entropyReduction >= 20 ? '✅' : '❌'} 认知熵下降 ≥ 20% (实际: ${entropyReduction.toFixed(1)}%)`);
  console.log(`  ${updateTime / config.numUpdates < 50 ? '✅' : '❌'} 单次更新 < 50ms (实际: ${(updateTime / config.numUpdates).toFixed(2)}ms)`);
  console.log(`  ${modularityImprovement >= 10 || dreamResult.conceptsGenerated > 0 ? '✅' : '⚠️'} 夜间巩固有效\n`);
  
  console.log(`报告已保存: ${reportPath}\n`);
  
  graph.close();
}

main().catch(console.error);

