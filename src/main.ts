/**
 * T-NSEC 3.0 - 主入口
 * 
 * 边缘端神经符号认知内核CLI
 */

import { Command } from 'commander';
import { HardwareProbe, hardwareProbe } from './system/HardwareProbe.js';
import { LocalLLM } from './llm/LocalLLM.js';
import { AdaptiveLoader } from './llm/AdaptiveLoader.js';
import { HDCEngine, hdcEngine } from './hdc/HDCEngine.js';
import { GraphManager } from './graph/GraphManager.js';
import { HSGE } from './graph/HSGE.js';
import { TreeInferencer } from './inference/TreeInferencer.js';
import { TKAPOCalibrator } from './evolution/TKAPOCalibrator.js';
import { StreamingHashMemory } from './memory/StreamingHashMemory.js';
import { DreamEngine } from './evolution/DreamEngine.js';
import { MetricsCollector } from './eval/MetricsCollector.js';

const program = new Command();

program
  .name('t-nsec')
  .description('T-NSEC 3.0: Bio-Inspired Neuro-Symbolic Cognitive Architecture')
  .version('3.0.0');

// 硬件检测命令
program
  .command('hardware')
  .description('检测硬件并显示推荐配置')
  .action(() => {
    console.log('\n[T-NSEC] Hardware probe\n');
    hardwareProbe.printSummary();
  });

// 初始化图谱命令
program
  .command('init')
  .description('初始化知识图谱')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .option('--seed', '填充示例数据')
  .action(async (options) => {
    console.log('\n[T-NSEC] Initializing knowledge graph\n');
    
    const graph = new GraphManager(options.db);
    console.log(`[T-NSEC] Database created: ${options.db}`);

    if (options.seed) {
      console.log('\n[T-NSEC] Seeding example data');
      seedExampleData(graph);
      console.log('[T-NSEC] Example data loaded');
    }

    const stats = graph.getStats();
    console.log(`\n[T-NSEC] Graph status:`);
    console.log(`   节点数: ${stats.nodeCount}`);
    console.log(`   边数: ${stats.edgeCount}`);
    
    graph.close();
  });

// 推理命令
program
  .command('infer <prompt>')
  .description('执行认知推理')
  .option('-n, --paths <number>', '模拟路径数', '10')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .action(async (prompt, options) => {
    console.log('\n[T-NSEC] Inference mode\n');
    
    const graph = new GraphManager(options.db);
    const hsge = new HSGE(graph);
    const loader = new AdaptiveLoader('./models');
    const llm = await loader.autoLoad();
    
    const inferencer = new TreeInferencer(llm, graph, hsge, {
      numPaths: parseInt(options.paths),
    });

    console.log(`📝 输入: ${prompt}\n`);
    
    const result = await inferencer.runTreeCoS(prompt);
    const state = inferencer.getMetacognitiveState(result);

    console.log('═'.repeat(60));
    console.log(`\n📤 输出: ${result.finalAnswer}\n`);
    console.log('═'.repeat(60));
    console.log(`\n[T-NSEC] Metacognitive state:`);
    console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   不确定性: ${(state.uncertainty * 100).toFixed(1)}%`);
    console.log(`   建议动作: ${state.suggestedAction}`);
    console.log(`   延迟: ${result.latency.toFixed(2)}ms`);
    console.log(`   加速比: ${result.speedup.toFixed(2)}x\n`);

    graph.close();
  });

// 记忆巩固命令
program
  .command('dream')
  .description('运行夜间记忆巩固')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .action(async (options) => {
    console.log('\n[T-NSEC] Consolidation mode\n');
    
    const graph = new GraphManager(options.db);
    const loader = new AdaptiveLoader('./models');
    const llm = await loader.autoLoad();
    
    const dream = new DreamEngine(graph, llm);
    const result = await dream.runConsolidation();

    console.log('═'.repeat(60));
    console.log('\n[T-NSEC] Consolidation results:');
    console.log(`   发现聚类: ${result.clustersFound}`);
    console.log(`   生成概念: ${result.conceptsGenerated}`);
    console.log(`   剪枝边数: ${result.edgesPruned}`);
    console.log(`   模块度变化: ${result.modularityBefore.toFixed(4)} → ${result.modularityAfter.toFixed(4)}`);
    console.log(`   耗时: ${(result.duration / 1000).toFixed(2)}s\n`);

    graph.close();
  });

// 校准命令
program
  .command('calibrate')
  .description('运行Karma校准')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .option('--days <number>', '模拟天数', '10')
  .action(async (options) => {
    console.log('\n⚡ T-NSEC Karma校准\n');
    
    const graph = new GraphManager(options.db);
    const calibrator = new TKAPOCalibrator(graph);
    
    const days = parseInt(options.days);
    console.log(`模拟 ${days} 天的访问...\n`);
    
    const results = calibrator.simulateLongTerm(days, 50);
    
    console.log('日期\t节点数\t平均Karma\t熵');
    console.log('─'.repeat(40));
    
    for (const r of results) {
      console.log(`${r.day}\t${r.nodeCount}\t${r.avgKarma.toFixed(4)}\t${r.entropy.toFixed(4)}`);
    }

    const stats = calibrator.getStats();
    console.log('\n📊 最终状态:');
    console.log(`   总节点数: ${stats.totalNodes}`);
    console.log(`   平均Karma: ${stats.avgKarma.toFixed(4)}`);
    console.log(`   风险节点: ${stats.nodesAtRisk}`);
    console.log(`   巩固节点: ${stats.consolidatedNodes}\n`);

    graph.close();
  });

// 评估命令
program
  .command('eval')
  .description('运行完整评估')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .option('-o, --output <path>', '报告输出路径', './reports/eval.json')
  .option('-n, --tasks <number>', '测试任务数', '100')
  .action(async (options) => {
    console.log('\n[T-NSEC] Full evaluation\n');
    
    const graph = new GraphManager(options.db);
    const hsge = new HSGE(graph);
    const loader = new AdaptiveLoader('./models');
    const llm = await loader.autoLoad();
    const inferencer = new TreeInferencer(llm, graph, hsge);
    
    const collector = new MetricsCollector();
    const numTasks = parseInt(options.tasks);
    
    console.log(`运行 ${numTasks} 个测试任务...\n`);
    
    // 模拟测试任务
    const domains = ['认知', '记忆', '推理', '学习', '类比'];
    const prompts = [
      '什么是认知？',
      '记忆如何工作？',
      '如何进行推理？',
      '学习的本质是什么？',
      '什么是类比？',
    ];
    
    for (let i = 0; i < numTasks; i++) {
      const domainIdx = i % domains.length;
      const domain = domains[domainIdx];
      const prompt = prompts[domainIdx];
      
      const startTime = Date.now();
      const result = await inferencer.runTreeCoS(prompt);
      const latency = Date.now() - startTime;
      
      // 记录结果
      collector.recordTaskResult({
        taskId: `task-${i}`,
        domain,
        predicted: result.finalAnswer,
        actual: result.finalAnswer, // 模拟
        confidence: result.confidence,
        correct: result.confidence > 0.5, // 简化判定
        latency,
      });
      
      collector.recordLatency('TreeInferencer', 'runTreeCoS', latency);
      
      if ((i + 1) % 20 === 0) {
        console.log(`  完成 ${i + 1}/${numTasks} 个任务`);
      }
    }

    const graphStats = graph.getStats();
    const modularity = graph.calculateModularity();
    
    collector.exportReport(options.output, {
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

    graph.close();
  });

// HDC测试命令
program
  .command('test-hdc')
  .description('测试HDC引擎')
  .action(() => {
    console.log('\n🔬 HDC引擎测试\n');
    
    const hdc = new HDCEngine(10000, 42);
    
    // 测试编码
    console.log('1. 符号编码测试:');
    const vec1 = hdc.getSymbolVector('认知');
    const vec2 = hdc.getSymbolVector('记忆');
    const vec3 = hdc.getSymbolVector('认知');
    
    console.log(`   '认知' 与 '认知' 相似度: ${hdc.similarity(vec1, vec3).similarity.toFixed(4)}`);
    console.log(`   '认知' 与 '记忆' 相似度: ${hdc.similarity(vec1, vec2).similarity.toFixed(4)}`);
    
    // 测试绑定
    console.log('\n2. 绑定操作测试:');
    const bound = hdc.bind(vec1, vec2);
    const unbound = hdc.unbind(bound, vec1);
    console.log(`   bind(认知, 记忆) unbind 认知 → 与记忆相似度: ${hdc.similarity(unbound, vec2).similarity.toFixed(4)}`);
    
    // 测试三元组编码
    console.log('\n3. 三元组编码测试:');
    const triple = hdc.encodeTriple('人', 'has_a', '记忆');
    console.log(`   编码 (人, has_a, 记忆) 耗时: ${triple.encodingTime.toFixed(2)}ms`);
    
    // 测试图编码
    console.log('\n4. 图编码测试:');
    const graph = hdc.encodeGraph([
      { source: '人', relation: 'has_a', target: '大脑' },
      { source: '大脑', relation: 'contains', target: '神经元' },
      { source: '神经元', relation: 'transmits', target: '信号' },
    ]);
    console.log(`   编码3个三元组耗时: ${graph.encodingTime.toFixed(2)}ms`);
    
    const stats = hdc.getStats();
    console.log(`\n[T-NSEC] HDC statistics:`);
    console.log(`   维度: ${stats.dimensions}`);
    console.log(`   符号数: ${stats.symbolCount}`);
    console.log(`   关系数: ${stats.relationCount}\n`);
  });

// 交互模式
program
  .command('interactive')
  .description('进入交互模式')
  .option('-d, --db <path>', '数据库路径', './data/graph.db')
  .action(async (options) => {
    console.log('\n🤖 T-NSEC 3.0 交互模式\n');
    console.log('输入 "exit" 退出\n');
    
    const graph = new GraphManager(options.db);
    const hsge = new HSGE(graph);
    const loader = new AdaptiveLoader('./models');
    const llm = await loader.autoLoad();
    const inferencer = new TreeInferencer(llm, graph, hsge);
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question('\n> ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('\n👋 再见!\n');
          rl.close();
          graph.close();
          return;
        }

        if (input.trim()) {
          const result = await inferencer.runTreeCoS(input);
          console.log(`\n📤 ${result.finalAnswer}`);
          console.log(`   [置信度: ${(result.confidence * 100).toFixed(1)}%, 延迟: ${result.latency.toFixed(0)}ms]`);
        }
        
        prompt();
      });
    };

    prompt();
  });

/**
 * 填充示例数据
 */
function seedExampleData(graph: GraphManager): void {
  // 认知科学领域的示例节点
  const nodes = [
    { label: '认知', type: 'concept', karma: 1.0 },
    { label: '记忆', type: 'concept', karma: 0.9 },
    { label: '工作记忆', type: 'concept', karma: 0.85 },
    { label: '长期记忆', type: 'concept', karma: 0.85 },
    { label: '学习', type: 'concept', karma: 0.9 },
    { label: '神经网络', type: 'concept', karma: 0.8 },
    { label: '符号推理', type: 'concept', karma: 0.8 },
    { label: '类比', type: 'concept', karma: 0.75 },
    { label: '抽象', type: 'concept', karma: 0.7 },
    { label: '概念', type: 'concept', karma: 0.9 },
    { label: '艾宾浩斯', type: 'entity', karma: 0.6 },
    { label: '遗忘曲线', type: 'concept', karma: 0.7 },
    { label: '强化', type: 'concept', karma: 0.65 },
    { label: '衰减', type: 'concept', karma: 0.65 },
    { label: '图谱', type: 'concept', karma: 0.8 },
  ];

  const nodeMap = new Map<string, string>();
  
  for (const n of nodes) {
    const node = graph.addNode(n);
    nodeMap.set(n.label, node.id);
  }

  // 添加关系
  const edges = [
    { source: '认知', target: '记忆', relation: 'contains' },
    { source: '认知', target: '学习', relation: 'contains' },
    { source: '记忆', target: '工作记忆', relation: 'has_a' },
    { source: '记忆', target: '长期记忆', relation: 'has_a' },
    { source: '学习', target: '神经网络', relation: 'uses' },
    { source: '学习', target: '符号推理', relation: 'uses' },
    { source: '类比', target: '抽象', relation: 'related_to' },
    { source: '抽象', target: '概念', relation: 'produces' },
    { source: '艾宾浩斯', target: '遗忘曲线', relation: 'discovered' },
    { source: '记忆', target: '遗忘曲线', relation: 'follows' },
    { source: '记忆', target: '强化', relation: 'improved_by' },
    { source: '记忆', target: '衰减', relation: 'subject_to' },
    { source: '概念', target: '图谱', relation: 'stored_in' },
    { source: '神经网络', target: '符号推理', relation: 'complemented_by' },
  ];

  for (const e of edges) {
    const sourceId = nodeMap.get(e.source);
    const targetId = nodeMap.get(e.target);
    if (sourceId && targetId) {
      graph.addEdge({
        sourceId,
        targetId,
        relation: e.relation,
        weight: 1.0,
        karma: 0.8,
      });
    }
  }
}

// 解析命令行参数
program.parse();

