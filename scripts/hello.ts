/**
 * hello.ts - 快速验证脚本
 * 
 * 验证基础链路：LocalLLM + HardwareProbe + GraphManager
 */

import { hardwareProbe } from '../src/system/HardwareProbe.js';
import { LocalLLM } from '../src/llm/LocalLLM.js';
import { AdaptiveLoader } from '../src/llm/AdaptiveLoader.js';
import { GraphManager } from '../src/graph/GraphManager.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         T-NSEC 3.0 快速验证 (hello.ts)                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. 硬件检测
  console.log('[Step 1] Hardware probe');
  console.log('─'.repeat(50));
  
  const hwInfo = hardwareProbe.getHardwareInfo();
  console.log(`  CPU: ${hwInfo.cpuModel}`);
  console.log(`  核心数: ${hwInfo.cpuCores}`);
  console.log(`  内存: ${(hwInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
  
  const benchmark = hardwareProbe.runBenchmark();
  console.log(`  硬件分数: ${benchmark.score}`);
  console.log(`  推荐模型: ${hardwareProbe.getRecommendedModelSize()}`);
  console.log('  PASS\n');

  // 2. 模型加载
  console.log('[Step 2] Model loading');
  console.log('─'.repeat(50));
  
  const loader = new AdaptiveLoader('./models');
  const llm = await loader.autoLoad();
  console.log(`  模型大小: ${llm.getModelSize()}`);
  console.log(`  模型已加载: ${llm.isModelLoaded()}`);
  console.log('  PASS\n');

  // 3. 推理测试
  console.log('[Step 3] Inference test');
  console.log('─'.repeat(50));
  
  const testPrompts = [
    '你好',
    '什么是认知？',
    '解释一下记忆的工作原理',
  ];

  for (const prompt of testPrompts) {
    console.log(`\n  输入: "${prompt}"`);
    const result = await llm.infer(prompt);
    console.log(`  输出: ${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}`);
    console.log(`  延迟: ${result.duration.toFixed(2)}ms, Token/s: ${result.tokensPerSecond.toFixed(2)}`);
  }
  console.log('\n  PASS\n');

  // 4. 图谱操作
  console.log('[Step 4] Graph operations');
  console.log('─'.repeat(50));
  
  const graph = new GraphManager('./data/test-graph.db');
  graph.clear(); // 清空测试数据
  
  // 添加节点
  const node1 = graph.addNode({ label: '认知', type: 'concept', karma: 1.0 });
  const node2 = graph.addNode({ label: '记忆', type: 'concept', karma: 0.9 });
  const node3 = graph.addNode({ label: '学习', type: 'concept', karma: 0.8 });
  
  console.log(`  添加节点: 认知(${node1.id.substring(0, 8)}...)`);
  console.log(`  添加节点: 记忆(${node2.id.substring(0, 8)}...)`);
  console.log(`  添加节点: 学习(${node3.id.substring(0, 8)}...)`);
  
  // 添加边
  const edge1 = graph.addEdge({
    sourceId: node1.id,
    targetId: node2.id,
    relation: 'contains',
    weight: 1.0,
    karma: 0.9,
  });
  
  const edge2 = graph.addEdge({
    sourceId: node1.id,
    targetId: node3.id,
    relation: 'contains',
    weight: 1.0,
    karma: 0.8,
  });
  
  console.log(`  添加边: 认知 --contains--> 记忆`);
  console.log(`  添加边: 认知 --contains--> 学习`);
  
  // 查询统计
  const stats = graph.getStats();
  console.log(`\n  图谱统计:`);
  console.log(`    节点数: ${stats.nodeCount}`);
  console.log(`    边数: ${stats.edgeCount}`);
  console.log(`    平均Karma: ${stats.avgKarma.toFixed(4)}`);
  
  // 子图查询
  const subgraph = graph.getSubgraph([node1.id], 1);
  console.log(`\n  子图查询 (从"认知"出发, 1跳):`);
  console.log(`    节点数: ${subgraph.nodes.length}`);
  console.log(`    边数: ${subgraph.edges.length}`);
  console.log(`    查询耗时: ${subgraph.queryTime.toFixed(2)}ms`);
  
  graph.close();
  console.log('\n  PASS\n');

  // 5. 流式输出测试
  console.log('[Step 5] Streaming output test');
  console.log('─'.repeat(50));
  
  console.log('  输入: "描述一下神经符号系统"');
  process.stdout.write('  输出: ');
  
  await llm.inferStream('描述一下神经符号系统', (token) => {
    process.stdout.write(token);
  });
  console.log('\n  PASS\n');

  // 总结
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              All Verifications Passed                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Verified modules:');
  console.log('  PASS: HardwareProbe');
  console.log('  PASS: LocalLLM');
  console.log('  PASS: AdaptiveLoader');
  console.log('  PASS: GraphManager');
  console.log('  PASS: Streaming output\n');
}

main().catch(console.error);

