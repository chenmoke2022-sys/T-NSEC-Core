/**
 * HSpecScheduler 模拟任务流测试脚本
 *
 * Public baseline (no private workflow files):
 * - Submits a mixed workload and prints scheduling decisions + basic stats.
 */

import { InferenceEngine } from '../src/inference/InferenceEngine.js';
import { HSpecScheduler } from '../src/inference/HSpecScheduler.js';

async function main() {
  try {
    const engine = new InferenceEngine();
    await engine.initialize();

    const scheduler = new HSpecScheduler(engine);
    scheduler.submitBatch([
      { id: 'l1-hello', level: 'L1', prompt: '你好', priority: 5 },
      { id: 'l2-explain', level: 'L2', prompt: 'Explain what a knowledge graph is.', priority: 6 },
      { id: 'l3-analogy', level: 'L3', prompt: 'Analogy: if memory is a database, what is forgetting?', priority: 7 },
      { id: 'plan-1', level: 'PLANNING', prompt: 'Plan a reproducible benchmark suite for a research runtime.', priority: 8 },
    ]);

    const results = await scheduler.processAll();
    console.log('\n' + '═'.repeat(70));
    console.log('Processed:', results.length);
    for (const r of results) {
      console.log(`${r.task.id} | level=${r.task.level} | strategy=${r.strategy} | tps=${r.result.tokensPerSecond.toFixed(1)}`);
    }

    const stats = scheduler.getStats();
    console.log('\nScheduler Stats:', JSON.stringify(stats, null, 2));

    await engine.dispose();
    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

main();

