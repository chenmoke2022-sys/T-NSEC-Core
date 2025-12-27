/**
 * HardwareProbe - 硬件检测模块
 * 
 * 功能：检测CPU、内存等硬件信息，计算硬件分数H，用于自适应选择模型大小
 * 
 * 硬件分数阈值（开源版主线，仅保留 0.5B/7B 两档）：
 * - H < 8000: 选择 0.5B 模型
 * - H >= 8000: 选择 7B 模型
 */

import os from 'os';
import { performance } from 'perf_hooks';

export interface HardwareInfo {
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  cpuSpeed: number; // MHz
  totalMemory: number; // bytes
  freeMemory: number; // bytes
  platform: string;
  arch: string;
}

export interface BenchmarkResult {
  score: number;
  cpuScore: number;
  memoryScore: number;
  duration: number; // ms
}

export type ModelSize = '0.5B' | '7B';

export class HardwareProbe {
  private cachedInfo: HardwareInfo | null = null;
  private cachedBenchmark: BenchmarkResult | null = null;

  /**
   * 获取硬件信息
   */
  getHardwareInfo(): HardwareInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown';
    const cpuSpeed = cpus[0]?.speed || 0;

    this.cachedInfo = {
      cpuModel,
      cpuCores: cpus.length,
      cpuThreads: cpus.length, // 在Node.js中线程数等于核心数
      cpuSpeed,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      platform: os.platform(),
      arch: os.arch(),
    };

    return this.cachedInfo;
  }

  /**
   * 执行CPU基准测试
   * 通过矩阵运算和素数计算来评估CPU性能
   */
  private benchmarkCPU(): number {
    const startTime = performance.now();
    
    // 测试1: 矩阵乘法运算
    const matrixSize = 100;
    const iterations = 50;
    
    for (let iter = 0; iter < iterations; iter++) {
      const a: number[][] = [];
      const b: number[][] = [];
      const c: number[][] = [];
      
      // 初始化矩阵
      for (let i = 0; i < matrixSize; i++) {
        a[i] = [];
        b[i] = [];
        c[i] = [];
        for (let j = 0; j < matrixSize; j++) {
          a[i][j] = Math.random();
          b[i][j] = Math.random();
          c[i][j] = 0;
        }
      }
      
      // 矩阵乘法
      for (let i = 0; i < matrixSize; i++) {
        for (let j = 0; j < matrixSize; j++) {
          for (let k = 0; k < matrixSize; k++) {
            c[i][j] += a[i][k] * b[k][j];
          }
        }
      }
    }
    
    // 测试2: 素数计算
    let primeCount = 0;
    const maxNum = 50000;
    for (let num = 2; num < maxNum; num++) {
      let isPrime = true;
      for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) primeCount++;
    }
    
    const duration = performance.now() - startTime;
    
    // 计算分数：越快分数越高（基于时间倒数，标准化到合理范围）
    // 基准：1000ms = 5000分
    const baseScore = 5000 * (1000 / duration);
    
    return Math.round(baseScore);
  }

  /**
   * 执行内存基准测试
   * 测试内存带宽和访问速度
   */
  private benchmarkMemory(): number {
    const startTime = performance.now();
    
    // 测试1: 大数组顺序访问
    const arraySize = 10_000_000;
    const arr = new Float64Array(arraySize);
    
    // 写入
    for (let i = 0; i < arraySize; i++) {
      arr[i] = i * 1.5;
    }
    
    // 读取并累加
    let sum = 0;
    for (let i = 0; i < arraySize; i++) {
      sum += arr[i];
    }
    
    // 测试2: 随机访问
    const randomIndices = new Uint32Array(100000);
    for (let i = 0; i < randomIndices.length; i++) {
      randomIndices[i] = Math.floor(Math.random() * arraySize);
    }
    
    let randomSum = 0;
    for (let i = 0; i < randomIndices.length; i++) {
      randomSum += arr[randomIndices[i]];
    }
    
    const duration = performance.now() - startTime;
    
    // 基准：500ms = 3000分
    const baseScore = 3000 * (500 / duration);
    
    // 考虑内存容量的加成（每16GB加500分）
    const memoryBonus = Math.floor(os.totalmem() / (16 * 1024 * 1024 * 1024)) * 500;
    
    // 防止编译器优化掉计算
    if (sum + randomSum < 0) console.log('Unexpected');
    
    return Math.round(baseScore + memoryBonus);
  }

  /**
   * 运行完整的硬件基准测试
   */
  runBenchmark(force: boolean = false): BenchmarkResult {
    if (this.cachedBenchmark && !force) {
      return this.cachedBenchmark;
    }

    console.log('⏳ 正在运行硬件基准测试...');
    const startTime = performance.now();

    const cpuScore = this.benchmarkCPU();
    console.log(`  CPU 分数: ${cpuScore}`);

    const memoryScore = this.benchmarkMemory();
    console.log(`  内存分数: ${memoryScore}`);

    const duration = performance.now() - startTime;
    
    // 综合分数：CPU权重60%，内存权重40%
    const score = Math.round(cpuScore * 0.6 + memoryScore * 0.4);

    this.cachedBenchmark = {
      score,
      cpuScore,
      memoryScore,
      duration,
    };

    console.log(`[HardwareProbe] Benchmark complete: score=${score}, duration=${duration.toFixed(0)}ms`);
    
    return this.cachedBenchmark;
  }

  /**
   * 根据硬件分数推荐模型大小
   */
  getRecommendedModelSize(): ModelSize {
    const benchmark = this.runBenchmark();
    
    if (benchmark.score < 8000) {
      return '0.5B';
    } else {
      return '7B';
    }
  }

  /**
   * 获取完整的硬件报告
   */
  getFullReport(): {
    hardware: HardwareInfo;
    benchmark: BenchmarkResult;
    recommendedModel: ModelSize;
  } {
    return {
      hardware: this.getHardwareInfo(),
      benchmark: this.runBenchmark(),
      recommendedModel: this.getRecommendedModelSize(),
    };
  }

  /**
   * 格式化内存大小
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 打印硬件信息摘要
   */
  printSummary(): void {
    const info = this.getHardwareInfo();
    const benchmark = this.runBenchmark();
    const model = this.getRecommendedModelSize();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              T-NSEC 3.0 硬件检测报告                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ CPU: ${info.cpuModel.substring(0, 50).padEnd(53)}║`);
    console.log(`║ 核心数: ${info.cpuCores} @ ${info.cpuSpeed} MHz`.padEnd(61) + '║');
    console.log(`║ 总内存: ${HardwareProbe.formatBytes(info.totalMemory)}`.padEnd(61) + '║');
    console.log(`║ 可用内存: ${HardwareProbe.formatBytes(info.freeMemory)}`.padEnd(61) + '║');
    console.log(`║ 平台: ${info.platform} (${info.arch})`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 硬件分数(H): ${benchmark.score}`.padEnd(61) + '║');
    console.log(`║ 推荐模型: ${model}`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }
}

// 单例导出
export const hardwareProbe = new HardwareProbe();

