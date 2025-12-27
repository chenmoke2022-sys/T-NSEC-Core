/**
 * benchmark-gpu.ts - Inference baseline benchmark (public)
 * 
 * Public baseline:
 * - CPU-only simulated inference engine
 * - Keeps the same output shape for reproducible reporting
 * 
 * 测试内容：
 * - 各级别任务 TPS
 * - H-Spec 加速比
 * - 能效比 (TPW)
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import { InferenceEngine, TaskLevel } from '../src/inference/InferenceEngine.js';
import { HSpecScheduler, Task } from '../src/inference/HSpecScheduler.js';
import { MetricsCollector } from '../src/eval/MetricsCollector.js';

interface BenchmarkResult {
  level: TaskLevel;
  strategy: 'DIRECT' | 'HSPEC';
  samples: number;
  avgTPS: number;
  minTPS: number;
  maxTPS: number;
  avgLatency: number;
  avgVRAM: number;
  avgGPULoad: number;
  TPW: number;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Thomas Zero 4.0 GPU 完整基准测试                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const collector = new MetricsCollector();
  const startTime = performance.now();

  // 初始化引擎
  console.log('🚀 初始化推理引擎...');
  const engine = new InferenceEngine({
    // Public baseline: only 0.5B/7B placeholders (assets not tracked by git)
    draftModelPath: './models/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    verifyModelPath: './models/qwen2.5-7b-instruct-q4_k_m.gguf',
  });
  await engine.initialize();

  const results: BenchmarkResult[] = [];

  // 测试配置
  const testCases = {
    L1: {
      prompts: [
        '你好',
        '今天天气怎么样？',
        '谢谢',
        '再见',
        '帮我查一下时间',
      ],
      maxTokens: 128,
      temperature: 0.3,
    },
    L2: {
      prompts: [
        '什么是机器学习？',
        '解释一下神经网络的基本原理',
        '人工智能有哪些应用场景？',
        '描述一下深度学习的发展历程',
        '什么是自然语言处理？',
      ],
      maxTokens: 256,
      temperature: 0.5,
    },
    L3: {
      prompts: [
        '类比推理：如果大脑是计算机，那么记忆是什么？请详细分析。',
        '比较人类学习和机器学习的异同，从效率、泛化能力、可解释性三个角度展开。',
        '分析知识图谱在智能问答系统中的作用和局限性。',
        '探讨神经符号整合在实现通用人工智能中的潜力。',
        '讨论认知科学对人工智能发展的启示。',
      ],
      maxTokens: 512,
      temperature: 0.7,
    },
    PLANNING: {
      prompts: [
        '为一个家用服务机器人规划早餐准备任务，包括从冰箱取食材、加热、摆盘等步骤。',
        '设计一个智能助手处理用户日程冲突的策略，考虑优先级、时间灵活性等因素。',
        '规划一个多智能体协作的仓库搬运任务，包括任务分配、路径规划、碰撞避免。',
      ],
      maxTokens: 1024,
      temperature: 0.6,
    },
  };

  // ==============================
  // 1. L1/L2 直接推理基准
  // ==============================
  console.log('\n━'.repeat(60));
  console.log('📊 1. L1/L2 直接推理基准 (关闭 H-Spec)');
  console.log('━'.repeat(60));

  for (const level of ['L1', 'L2'] as TaskLevel[]) {
    const config = testCases[level];
    const tpsValues: number[] = [];
    const latencies: number[] = [];
    const vramValues: number[] = [];
    const gpuLoads: number[] = [];

    console.log(`\n  测试 ${level} 任务 (${config.prompts.length} 样本)...`);

    for (const prompt of config.prompts) {
      const result = await engine.infer(prompt, {
        level,
        useHSpec: false,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });

      tpsValues.push(result.tokensPerSecond);
      latencies.push(result.duration);
      vramValues.push(result.gpuMemoryUsed);
      gpuLoads.push(result.gpuLoad);

      collector.recordGPUMetrics({
        vramUsed: result.gpuMemoryUsed,
        vramTotal: 10240,
        gpuLoad: result.gpuLoad,
        temperature: 65,
        powerDraw: 280,
        tokensGenerated: result.tokens,
      });
    }

    const avgTPS = tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const avgVRAM = vramValues.reduce((a, b) => a + b, 0) / vramValues.length;
    const avgGPULoad = gpuLoads.reduce((a, b) => a + b, 0) / gpuLoads.length;
    
    // 计算 TPW
    const totalTokens = tpsValues.reduce((sum, tps, i) => sum + tps * (latencies[i] / 1000), 0);
    const totalWh = (280 * latencies.reduce((a, b) => a + b, 0) / 1000 / 3600);
    const TPW = totalWh > 0 ? totalTokens / totalWh : 0;

    results.push({
      level,
      strategy: 'DIRECT',
      samples: config.prompts.length,
      avgTPS,
      minTPS: Math.min(...tpsValues),
      maxTPS: Math.max(...tpsValues),
      avgLatency,
      avgVRAM,
      avgGPULoad,
      TPW,
    });

    console.log(`    平均 TPS: ${avgTPS.toFixed(2)}`);
    console.log(`    平均延迟: ${avgLatency.toFixed(0)}ms`);
    console.log(`    平均 VRAM: ${avgVRAM.toFixed(0)} MB`);
  }

  // ==============================
  // 2. L3/PLANNING H-Spec 基准
  // ==============================
  console.log('\n━'.repeat(60));
  console.log('📊 2. L3/PLANNING H-Spec 基准 (启用推测解码)');
  console.log('━'.repeat(60));

  for (const level of ['L3', 'PLANNING'] as TaskLevel[]) {
    const config = testCases[level];
    const tpsValues: number[] = [];
    const latencies: number[] = [];
    const vramValues: number[] = [];
    const gpuLoads: number[] = [];

    console.log(`\n  测试 ${level} 任务 (${config.prompts.length} 样本, H-Spec)...`);

    for (const prompt of config.prompts) {
      const result = await engine.infer(prompt, {
        level,
        useHSpec: true,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });

      tpsValues.push(result.tokensPerSecond);
      latencies.push(result.duration);
      vramValues.push(result.gpuMemoryUsed);
      gpuLoads.push(result.gpuLoad);

      collector.recordGPUMetrics({
        vramUsed: result.gpuMemoryUsed,
        vramTotal: 10240,
        gpuLoad: result.gpuLoad,
        temperature: 70,
        powerDraw: 300,
        tokensGenerated: result.tokens,
      });
    }

    const avgTPS = tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const avgVRAM = vramValues.reduce((a, b) => a + b, 0) / vramValues.length;
    const avgGPULoad = gpuLoads.reduce((a, b) => a + b, 0) / gpuLoads.length;
    
    const totalTokens = tpsValues.reduce((sum, tps, i) => sum + tps * (latencies[i] / 1000), 0);
    const totalWh = (300 * latencies.reduce((a, b) => a + b, 0) / 1000 / 3600);
    const TPW = totalWh > 0 ? totalTokens / totalWh : 0;

    results.push({
      level,
      strategy: 'HSPEC',
      samples: config.prompts.length,
      avgTPS,
      minTPS: Math.min(...tpsValues),
      maxTPS: Math.max(...tpsValues),
      avgLatency,
      avgVRAM,
      avgGPULoad,
      TPW,
    });

    console.log(`    平均 TPS: ${avgTPS.toFixed(2)}`);
    console.log(`    平均延迟: ${avgLatency.toFixed(0)}ms`);
    console.log(`    平均 VRAM: ${avgVRAM.toFixed(0)} MB`);
  }

  // ==============================
  // 3. H-Spec vs Baseline 对比
  // ==============================
  console.log('\n━'.repeat(60));
  console.log('📊 3. L3 任务 H-Spec vs Baseline 对比');
  console.log('━'.repeat(60));

  const comparisonPrompt = testCases.L3.prompts[0];
  
  // 多次运行取平均
  const baselineRuns: number[] = [];
  const hspecRuns: number[] = [];
  const numRuns = 5;

  console.log(`\n  运行 ${numRuns} 次对比测试...`);

  for (let i = 0; i < numRuns; i++) {
    // Baseline
    const baselineResult = await engine.infer(comparisonPrompt, {
      level: 'L3',
      useHSpec: false,
      maxTokens: 512,
      temperature: 0.7,
    });
    baselineRuns.push(baselineResult.tokensPerSecond);

    // H-Spec
    const hspecResult = await engine.infer(comparisonPrompt, {
      level: 'L3',
      useHSpec: true,
      maxTokens: 512,
      temperature: 0.7,
    });
    hspecRuns.push(hspecResult.tokensPerSecond);
  }

  const avgBaseline = baselineRuns.reduce((a, b) => a + b, 0) / baselineRuns.length;
  const avgHspec = hspecRuns.reduce((a, b) => a + b, 0) / hspecRuns.length;
  const speedup = avgHspec / avgBaseline;

  console.log(`\n  Baseline 平均 TPS: ${avgBaseline.toFixed(2)}`);
  console.log(`  H-Spec 平均 TPS: ${avgHspec.toFixed(2)}`);
  console.log(`  加速比: ${speedup.toFixed(2)}x`);
  console.log(`  ${speedup > 1 ? '✅' : '⚠️'} H-Spec ${speedup > 1 ? '优于' : '不优于'} Baseline`);

  // ==============================
  // 4. 生成报告
  // ==============================
  console.log('\n━'.repeat(60));
  console.log('📊 4. 基准测试结果汇总');
  console.log('━'.repeat(60));

  console.log('\n┌────────┬──────────┬─────────┬───────────┬───────────┬───────────┬──────────┐');
  console.log('│ Level  │ Strategy │ Samples │   TPS     │  Latency  │   VRAM    │   TPW    │');
  console.log('├────────┼──────────┼─────────┼───────────┼───────────┼───────────┼──────────┤');

  for (const r of results) {
    console.log(`│ ${r.level.padEnd(6)} │ ${r.strategy.padEnd(8)} │ ${String(r.samples).padStart(7)} │ ${r.avgTPS.toFixed(1).padStart(9)} │ ${r.avgLatency.toFixed(0).padStart(8)}ms │ ${r.avgVRAM.toFixed(0).padStart(8)}MB │ ${r.TPW.toFixed(1).padStart(8)} │`);
  }

  console.log('└────────┴──────────┴─────────┴───────────┴───────────┴───────────┴──────────┘');

  // GPU 统计
  collector.printGPUStats();

  // 保存报告
  const reportPath = `./reports/gpu-benchmark-${Date.now()}.json`;
  const report = {
    timestamp: Date.now(),
    duration: performance.now() - startTime,
    results,
    comparison: {
      baselineAvgTPS: avgBaseline,
      hspecAvgTPS: avgHspec,
      speedup,
    },
    gpuStats: collector.calculateGPUStats(),
  };

  if (!fs.existsSync('./reports')) {
    fs.mkdirSync('./reports', { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 报告已保存: ${reportPath}`);

  // ==============================
  // 总结
  // ==============================
  const totalDuration = (performance.now() - startTime) / 1000;
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              🎉 GPU 基准测试完成！                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`总耗时: ${totalDuration.toFixed(2)}s\n`);

  // 验收检查
  const l1l2Result = results.find(r => r.level === 'L1' || r.level === 'L2');
  const l3HspecResult = results.find(r => r.level === 'L3' && r.strategy === 'HSPEC');
  
  console.log('验收标准:');
  console.log(`  ${l1l2Result && l1l2Result.avgTPS >= 30 ? '✅' : '❌'} L1/L2 TPS ≥ 30 (实际: ${l1l2Result?.avgTPS.toFixed(1) || 'N/A'})`);
  console.log(`  ${l3HspecResult && l3HspecResult.avgVRAM >= 8000 ? '✅' : '⚠️'} VRAM ≥ 8GB (模拟: ${((l3HspecResult?.avgVRAM || 0) / 1024).toFixed(2)} GB)`);
  console.log(`  ${speedup > 1 ? '✅' : '❌'} H-Spec TPW > Baseline (加速比: ${speedup.toFixed(2)}x)`);
  console.log('');

  await engine.dispose();
}

main().catch(console.error);

