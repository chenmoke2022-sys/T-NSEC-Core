/**
 * HSpecScheduler 单元测试（纯逻辑，不依赖模型/GPU）
 *
 * 核心验收：
 * - L1/L2 默认走 DIRECT
 * - L3/PLANNING 默认走 HSPEC
 * - 队列排序：deadline 优先，其次 priority
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { HSpecScheduler } from '../src/inference/HSpecScheduler.js';
import type { InferenceEngine, InferenceResult, TaskConfig, TaskLevel } from '../src/inference/InferenceEngine.js';

class FakeEngine {
  public calls: Array<{ prompt: string; config: Partial<TaskConfig> }> = [];

  async infer(prompt: string, config: Partial<TaskConfig>): Promise<InferenceResult> {
    this.calls.push({ prompt, config });
    const useHSpec = Boolean(config.useHSpec);
    const tokens = useHSpec ? 200 : 80;
    const duration = useHSpec ? 200 : 50;
    const tps = useHSpec ? 30 : 60;
    return {
      text: useHSpec ? '[HSPEC]' : '[DIRECT]',
      tokens,
      promptTokens: 10,
      completionTokens: tokens,
      duration,
      tokensPerSecond: tps,
      gpuMemoryUsed: 0,
      gpuLoad: 0,
      usedHSpec: useHSpec,
    };
  }
}

function task(id: string, level: TaskLevel, priority: number, deadline?: number) {
  return { id, level, prompt: `P:${id}`, priority, deadline };
}

describe('HSpecScheduler', () => {
  it('L1/L2 应走 DIRECT；L3/PLANNING 应走 HSPEC', async () => {
    const engine = new FakeEngine();
    const scheduler = new HSpecScheduler(engine as unknown as InferenceEngine);

    scheduler.submitBatch([
      task('t1', 'L1', 5),
      task('t2', 'L2', 5),
      task('t3', 'L3', 5),
      task('t4', 'PLANNING', 5),
    ]);

    const r1 = await scheduler.processNext();
    const r2 = await scheduler.processNext();
    const r3 = await scheduler.processNext();
    const r4 = await scheduler.processNext();

    assert.ok(r1 && r2 && r3 && r4, '应处理四个任务');

    // 队列按 priority 排序（都一样时保持提交顺序不保证），所以这里只断言每个 level 的策略正确
    const byId = new Map([r1, r2, r3, r4].map(r => [r.task.id, r]));
    assert.strictEqual(byId.get('t1')!.strategy, 'DIRECT');
    assert.strictEqual(byId.get('t2')!.strategy, 'DIRECT');
    assert.strictEqual(byId.get('t3')!.strategy, 'HSPEC');
    assert.strictEqual(byId.get('t4')!.strategy, 'HSPEC');

    assert.ok(byId.get('t3')!.schedulingDecision.includes('启用 H-Spec'));
    assert.ok(byId.get('t1')!.schedulingDecision.includes('关闭 H-Spec'));
  });

  it('队列排序：deadline 优先，其次 priority', async () => {
    const engine = new FakeEngine();
    const scheduler = new HSpecScheduler(engine as unknown as InferenceEngine);
    const now = Date.now();

    scheduler.submitBatch([
      task('late-deadline', 'L1', 10, now + 10_000),
      task('early-deadline', 'L1', 1, now + 100),
      task('no-deadline-high-priority', 'L1', 9),
    ]);

    const r1 = await scheduler.processNext();
    const r2 = await scheduler.processNext();
    const r3 = await scheduler.processNext();

    assert.ok(r1 && r2 && r3);
    assert.strictEqual(r1.task.id, 'early-deadline', '最早 deadline 应先执行');
    assert.strictEqual(r2.task.id, 'late-deadline', '有 deadline 的任务优先于无 deadline');
    assert.strictEqual(r3.task.id, 'no-deadline-high-priority');
  });
});


