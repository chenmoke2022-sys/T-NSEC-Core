/**
 * HSpecScheduler - H-Spec 推测解码调度器
 * 
 * Thomas Zero 4.0 核心策略组件
 * 
 * 策略：
 * - L1/L2 任务：直接推理（关闭 H-Spec），最大化 TPS
 * - L3/PLANNING 任务：启用 H-Spec 推测解码，优化 TPW
 * 
 * H-Spec = Hierarchical Speculative Decoding
 * TPW = Tokens Per Watt（能效比）
 */

import { performance } from 'perf_hooks';
import { InferenceEngine, TaskLevel, TaskConfig, InferenceResult } from './InferenceEngine.js';

// 任务定义
export interface Task {
  id: string;
  level: TaskLevel;
  prompt: string;
  priority: number;        // 1-10，10最高
  deadline?: number;       // 毫秒时间戳
  metadata?: Record<string, unknown>;
}

// 调度结果
export interface ScheduleResult {
  task: Task;
  result: InferenceResult;
  strategy: 'DIRECT' | 'HSPEC';
  queueWaitTime: number;
  schedulingDecision: string;
}

// H-Spec 配置
export interface HSpecConfig {
  // 启用 H-Spec 的任务级别
  enabledLevels: TaskLevel[];
  
  // Draft 模型配置
  draftTokens: number;        // 每次 draft 生成的 token 数
  acceptanceThreshold: number; // 接受阈值
  
  // 性能目标
  targetTPS: {
    L1: number;
    L2: number;
    L3: number;
    PLANNING: number;
  };
  
  // 能效目标
  targetTPW: number;  // Tokens Per Watt
}

// 调度统计
export interface SchedulerStats {
  totalTasks: number;
  tasksByLevel: Record<TaskLevel, number>;
  avgTPSByLevel: Record<TaskLevel, number>;
  avgLatencyByLevel: Record<TaskLevel, number>;
  hspecUsageRate: number;
  overallTPW: number;
}

export class HSpecScheduler {
  private engine: InferenceEngine;
  private config: HSpecConfig;
  private taskQueue: Task[] = [];
  private processingTask: Task | null = null;
  
  // 统计
  private stats: {
    byLevel: Record<TaskLevel, { count: number; totalTokens: number; totalDuration: number }>;
    hspecTasks: number;
    directTasks: number;
  };

  constructor(engine: InferenceEngine, config?: Partial<HSpecConfig>) {
    this.engine = engine;
    
    // 默认配置：仅对 L3 和 PLANNING 启用 H-Spec
    this.config = {
      enabledLevels: config?.enabledLevels || ['L3', 'PLANNING'],
      draftTokens: config?.draftTokens || 8,
      acceptanceThreshold: config?.acceptanceThreshold || 0.7,
      targetTPS: config?.targetTPS || {
        L1: 50,    // 快速任务目标 50 TPS
        L2: 40,    // 中等任务目标 40 TPS
        L3: 30,    // 复杂任务目标 30 TPS
        PLANNING: 25,  // 规划任务目标 25 TPS
      },
      targetTPW: config?.targetTPW || 100,  // 目标能效
    };

    this.stats = {
      byLevel: {
        L1: { count: 0, totalTokens: 0, totalDuration: 0 },
        L2: { count: 0, totalTokens: 0, totalDuration: 0 },
        L3: { count: 0, totalTokens: 0, totalDuration: 0 },
        PLANNING: { count: 0, totalTokens: 0, totalDuration: 0 },
      },
      hspecTasks: 0,
      directTasks: 0,
    };
  }

  /**
   * 提交任务
   */
  submit(task: Task): void {
    this.taskQueue.push(task);
    this.sortQueue();
    console.log(`[HSpecScheduler] Task submitted: ${task.id} (${task.level})`);
  }

  /**
   * 批量提交任务
   */
  submitBatch(tasks: Task[]): void {
    this.taskQueue.push(...tasks);
    this.sortQueue();
    console.log(`[HSpecScheduler] Batch submitted: ${tasks.length} tasks`);
  }

  /**
   * 按优先级和截止时间排序队列
   */
  private sortQueue(): void {
    this.taskQueue.sort((a, b) => {
      // 首先按截止时间（如果有）
      if (a.deadline && b.deadline) {
        return a.deadline - b.deadline;
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      
      // 然后按优先级
      return b.priority - a.priority;
    });
  }

  /**
   * 处理下一个任务
   */
  async processNext(): Promise<ScheduleResult | null> {
    if (this.taskQueue.length === 0) {
      return null;
    }

    const task = this.taskQueue.shift()!;
    this.processingTask = task;
    
    const queueStartTime = performance.now();
    
    // 决定调度策略
    const strategy = this.decideStrategy(task);
    const schedulingDecision = this.explainDecision(task, strategy);
    
    console.log(`\n[HSpecScheduler] Dispatch: ${task.id}`);
    console.log(`  Level: ${task.level}`);
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Rationale: ${schedulingDecision}`);

    // 构建任务配置
    const taskConfig: Partial<TaskConfig> = {
      level: task.level,
      useHSpec: strategy === 'HSPEC',
      maxTokens: this.getMaxTokensForLevel(task.level),
      temperature: this.getTemperatureForLevel(task.level),
    };

    // 执行推理
    const result = await this.engine.infer(task.prompt, taskConfig);
    
    // 更新统计
    this.updateStats(task, result, strategy);
    
    const queueWaitTime = performance.now() - queueStartTime - result.duration;
    
    this.processingTask = null;

    // 验证性能
    this.validatePerformance(task.level, result);

    return {
      task,
      result,
      strategy,
      queueWaitTime: Math.max(0, queueWaitTime),
      schedulingDecision,
    };
  }

  /**
   * 处理所有任务
   */
  async processAll(): Promise<ScheduleResult[]> {
    const results: ScheduleResult[] = [];
    
    while (this.taskQueue.length > 0) {
      const result = await this.processNext();
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * 决定调度策略
   */
  private decideStrategy(task: Task): 'DIRECT' | 'HSPEC' {
    // 核心策略：仅对 L3 和 PLANNING 启用 H-Spec
    if (this.config.enabledLevels.includes(task.level)) {
      return 'HSPEC';
    }
    return 'DIRECT';
  }

  /**
   * 解释调度决策
   */
  private explainDecision(task: Task, strategy: 'DIRECT' | 'HSPEC'): string {
    if (strategy === 'HSPEC') {
      return `${task.level} 任务需要深度推理，启用 H-Spec 推测解码优化 TPW`;
    }
    return `${task.level} 任务追求速度，关闭 H-Spec 直接推理最大化 TPS`;
  }

  /**
   * 获取任务级别的最大 token 数
   */
  private getMaxTokensForLevel(level: TaskLevel): number {
    const tokenLimits: Record<TaskLevel, number> = {
      L1: 128,      // 快速响应
      L2: 256,      // 中等响应
      L3: 512,      // 深度分析
      PLANNING: 1024,  // 详细规划
    };
    return tokenLimits[level];
  }

  /**
   * 获取任务级别的温度
   */
  private getTemperatureForLevel(level: TaskLevel): number {
    const temperatures: Record<TaskLevel, number> = {
      L1: 0.3,      // 确定性高
      L2: 0.5,      // 中等创造性
      L3: 0.7,      // 需要推理
      PLANNING: 0.6,   // 平衡创造性和可靠性
    };
    return temperatures[level];
  }

  /**
   * 更新统计
   */
  private updateStats(
    task: Task,
    result: InferenceResult,
    strategy: 'DIRECT' | 'HSPEC'
  ): void {
    const levelStats = this.stats.byLevel[task.level];
    levelStats.count++;
    levelStats.totalTokens += result.tokens;
    levelStats.totalDuration += result.duration;

    if (strategy === 'HSPEC') {
      this.stats.hspecTasks++;
    } else {
      this.stats.directTasks++;
    }
  }

  /**
   * 验证性能是否达标
   */
  private validatePerformance(level: TaskLevel, result: InferenceResult): void {
    const targetTPS = this.config.targetTPS[level];
    const actualTPS = result.tokensPerSecond;
    
    const status = actualTPS >= targetTPS * 0.8 ? 'OK' : 'WARN';
    console.log(`   ${status} TPS: ${actualTPS.toFixed(1)} (目标: ${targetTPS})`);
  }

  /**
   * 获取调度统计
   */
  getStats(): SchedulerStats {
    const tasksByLevel: Record<TaskLevel, number> = {
      L1: this.stats.byLevel.L1.count,
      L2: this.stats.byLevel.L2.count,
      L3: this.stats.byLevel.L3.count,
      PLANNING: this.stats.byLevel.PLANNING.count,
    };

    const avgTPSByLevel: Record<TaskLevel, number> = {} as Record<TaskLevel, number>;
    const avgLatencyByLevel: Record<TaskLevel, number> = {} as Record<TaskLevel, number>;

    for (const level of ['L1', 'L2', 'L3', 'PLANNING'] as TaskLevel[]) {
      const stats = this.stats.byLevel[level];
      if (stats.count > 0) {
        avgTPSByLevel[level] = stats.totalTokens / (stats.totalDuration / 1000);
        avgLatencyByLevel[level] = stats.totalDuration / stats.count;
      } else {
        avgTPSByLevel[level] = 0;
        avgLatencyByLevel[level] = 0;
      }
    }

    const totalTasks = this.stats.hspecTasks + this.stats.directTasks;
    const hspecUsageRate = totalTasks > 0 ? this.stats.hspecTasks / totalTasks : 0;

    // 估算 TPW（假设 RTX 3080 功耗 320W）
    const gpuPower = 320;  // Watts
    let totalTokens = 0;
    let totalDuration = 0;
    for (const level of ['L1', 'L2', 'L3', 'PLANNING'] as TaskLevel[]) {
      totalTokens += this.stats.byLevel[level].totalTokens;
      totalDuration += this.stats.byLevel[level].totalDuration;
    }
    const overallTPW = totalDuration > 0 
      ? totalTokens / ((totalDuration / 1000 / 3600) * gpuPower)  // tokens per watt-hour
      : 0;

    return {
      totalTasks,
      tasksByLevel,
      avgTPSByLevel,
      avgLatencyByLevel,
      hspecUsageRate,
      overallTPW,
    };
  }

  /**
   * 打印统计报告
   */
  printStats(): void {
    const stats = this.getStats();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              H-Spec 调度器统计                              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 总任务数: ${stats.totalTasks}`.padEnd(61) + '║');
    console.log(`║ H-Spec 使用率: ${(stats.hspecUsageRate * 100).toFixed(1)}%`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 按级别统计:'.padEnd(61) + '║');
    
    for (const level of ['L1', 'L2', 'L3', 'PLANNING'] as TaskLevel[]) {
      const count = stats.tasksByLevel[level];
      const tps = stats.avgTPSByLevel[level];
      const latency = stats.avgLatencyByLevel[level];
      const target = this.config.targetTPS[level];
      const status = tps >= target * 0.8 ? 'OK' : (count > 0 ? 'WARN' : '--');
      
      console.log(`║   ${status} ${level.padEnd(8)}: ${count} 任务, ${tps.toFixed(1)} TPS, ${latency.toFixed(0)}ms`.padEnd(61) + '║');
    }
    
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 总体 TPW: ${stats.overallTPW.toFixed(2)} tokens/Wh`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.taskQueue = [];
  }

  /**
   * 获取当前配置
   */
  getConfig(): HSpecConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HSpecConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚙️ H-Spec 配置已更新');
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      byLevel: {
        L1: { count: 0, totalTokens: 0, totalDuration: 0 },
        L2: { count: 0, totalTokens: 0, totalDuration: 0 },
        L3: { count: 0, totalTokens: 0, totalDuration: 0 },
        PLANNING: { count: 0, totalTokens: 0, totalDuration: 0 },
      },
      hspecTasks: 0,
      directTasks: 0,
    };
  }
}

export default HSpecScheduler;

