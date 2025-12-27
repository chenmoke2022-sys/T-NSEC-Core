/**
 * SystemSupervisor - 系统监督器
 * 
 * T-NSEC 3.0 核心组件
 * 
 * 功能：
 * - 动态检测硬件环境（GPU内存、CPU核心数）
 * - 为 H-Spec 调度器配置阈值
 * - 根据预估内存需求智能选择模型（开源版主线：0.5B/7B）
 */

import os from 'os';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { HardwareProbe, HardwareInfo } from '../system/HardwareProbe.js';
import { HSpecScheduler, HSpecConfig } from '../inference/HSpecScheduler.js';
export interface GPUStatus {
  name: string;
  vramTotal: number;     // MB
  vramUsed: number;      // MB
  vramFree: number;      // MB
  gpuLoad: number;       // %
  temperature: number;   // °C
  cudaAvailable: boolean;
}

/**
 * 硬件配置接口
 */
export interface HardwareConfig {
  // 环境标识
  environment: string;  // 例如: "env1", "env2"
  
  // GPU 配置
  gpuMemoryGB: number;   // GPU 显存（GB）
  gpuAvailable: boolean;
  
  // CPU 配置
  cpuCores: number;     // CPU 核心数
  cpuThreads: number;   // CPU 线程数
  
  // 系统内存
  totalMemoryGB: number;
  freeMemoryGB: number;
  
  // H-Spec 调度器阈值
  hspecThresholds: {
    memoryThresholdGB: number;  // 内存需求阈值（用于在两档模型间选择）
    cpuThreshold: number;        // CPU 核心数阈值
  };
  
  // 模型选择策略
  modelSelection: {
    use7BWhenMemoryGB: number;   // 当预估内存需求超过此值时使用 7B 模型
    preferSmallModels: boolean;   // 是否优先使用小模型
  };
}

/**
 * 模型大小类型
 */
export type ModelSize = '0.5B' | '7B';

/**
 * 模型内存需求估算（GB）
 */
const MODEL_MEMORY_REQUIREMENTS: Record<ModelSize, number> = {
  '0.5B': 0.5,
  '7B': 5.0,
};

/**
 * 系统监督器类
 */
export class SystemSupervisor {
  private hardwareProbe: HardwareProbe;
  private hardwareConfig: HardwareConfig | null = null;
  private cachedGPUInfo: { memoryGB: number; available: boolean } | null = null;
  private resourceMonitor: ResourceMonitor | null = null;

  constructor() {
    this.hardwareProbe = new HardwareProbe();
  }

  /**
   * 初始化系统监督器
   * 检测当前环境并生成硬件配置
   */
  async initialize(environment: string = 'env1'): Promise<HardwareConfig> {
    console.log('\n[SystemSupervisor] Initializing');
    console.log('━'.repeat(60));

    // 检测硬件信息
    const hardwareInfo = this.hardwareProbe.getHardwareInfo();
    const gpuInfo = await this.detectGPU();

    // 根据环境配置阈值
    const thresholds = this.getThresholdsForEnvironment(environment, gpuInfo.memoryGB);

    // 构建硬件配置
    this.hardwareConfig = {
      environment,
      gpuMemoryGB: gpuInfo.memoryGB,
      gpuAvailable: gpuInfo.available,
      cpuCores: hardwareInfo.cpuCores,
      cpuThreads: hardwareInfo.cpuThreads,
      totalMemoryGB: hardwareInfo.totalMemory / (1024 * 1024 * 1024),
      freeMemoryGB: hardwareInfo.freeMemory / (1024 * 1024 * 1024),
      hspecThresholds: thresholds,
      modelSelection: {
        use7BWhenMemoryGB: 3.0,
        preferSmallModels: true,
      },
    };

    console.log(`[SystemSupervisor] Environment detected: ${environment}`);
    console.log(`  GPU memory: ${gpuInfo.memoryGB} GB`);
    console.log(`  CPU cores: ${hardwareInfo.cpuCores}`);
    console.log(`  Memory threshold: ${thresholds.memoryThresholdGB} GB\n`);

    return this.hardwareConfig;
  }

  /**
   * 检测 GPU 信息
   */
  private async detectGPU(): Promise<{ memoryGB: number; available: boolean }> {
    if (this.cachedGPUInfo) {
      return this.cachedGPUInfo;
    }

    // 尝试从环境变量读取（环境1：16GB GPU）
    const envGpuMemory = process.env.GPU_MEMORY_GB 
      ? parseInt(process.env.GPU_MEMORY_GB, 10) 
      : null;

    if (envGpuMemory) {
      this.cachedGPUInfo = {
        memoryGB: envGpuMemory,
        available: true,
      };
      return this.cachedGPUInfo;
    }

    // 尝试通过 node-llama-cpp 检测（如果可用）
    try {
      const { getLlama } = await import('node-llama-cpp');
      const llama = await getLlama();
      
      // 尝试获取 GPU 信息
      // 注意：node-llama-cpp 可能不直接提供 GPU 内存信息
      // 这里使用默认值或尝试检测
      this.cachedGPUInfo = {
        memoryGB: 16,  // 默认假设16GB（环境1）
        available: true,
      };
    } catch (error) {
      // 如果无法检测，使用默认值
      console.log('⚠️ 无法检测 GPU，使用默认配置');
      this.cachedGPUInfo = {
        memoryGB: 16,  // 环境1默认16GB
        available: false,
      };
    }

    return this.cachedGPUInfo;
  }

  /**
   * 根据环境获取阈值配置
   */
  private getThresholdsForEnvironment(
    environment: string,
    gpuMemoryGB: number
  ): { memoryThresholdGB: number; cpuThreshold: number } {
    // 环境1：16GB GPU（默认配置）
    if (environment === 'env1') {
      return {
        memoryThresholdGB: 3.0,
        cpuThreshold: 4,           // CPU核心数阈值
      };
    }

    // 其他环境可以根据需要扩展
    // 默认配置
    return {
      memoryThresholdGB: gpuMemoryGB * 0.6,  // 使用60%的GPU内存作为阈值
      cpuThreshold: Math.floor(os.cpus().length / 2),
    };
  }

  /**
   * 根据预估内存需求选择模型
   */
  selectModel(estimatedMemoryGB: number): ModelSize {
    if (!this.hardwareConfig) {
      throw new Error('SystemSupervisor 未初始化，请先调用 initialize()');
    }

    const { use7BWhenMemoryGB, preferSmallModels } = this.hardwareConfig.modelSelection;

    // 开源版主线：仅两档模型
    // - 默认偏向小模型
    // - 当预估内存需求较高时升级到 7B
    if (preferSmallModels && estimatedMemoryGB <= use7BWhenMemoryGB) {
      return '0.5B';
    }
    return '7B';
  }

  /**
   * 为 H-Spec 调度器生成配置
   */
  generateHSpecConfig(): Partial<HSpecConfig> {
    if (!this.hardwareConfig) {
      throw new Error('SystemSupervisor 未初始化，请先调用 initialize()');
    }

    const { hspecThresholds, gpuMemoryGB, cpuCores } = this.hardwareConfig;

    // 根据硬件配置调整 H-Spec 参数
    const config: Partial<HSpecConfig> = {
      enabledLevels: ['L3', 'PLANNING'],  // 默认对L3和PLANNING启用
      draftTokens: 8,
      acceptanceThreshold: 0.7,
      targetTPS: {
        L1: 50,
        L2: 40,
        L3: 30,
        PLANNING: 25,
      },
      targetTPW: 100,
    };

    // 根据GPU内存调整
    if (gpuMemoryGB >= 16) {
      // 16GB+ GPU，可以更激进
      config.draftTokens = 12;
      config.targetTPS = {
        L1: 60,
        L2: 50,
        L3: 40,
        PLANNING: 35,
      };
    } else if (gpuMemoryGB < 8) {
      // 小于8GB，保守配置
      config.draftTokens = 4;
      config.targetTPS = {
        L1: 40,
        L2: 30,
        L3: 20,
        PLANNING: 15,
      };
    }

    // 根据CPU核心数调整
    if (cpuCores >= 8) {
      config.targetTPS = {
        L1: (config.targetTPS?.L1 || 50) + 10,
        L2: (config.targetTPS?.L2 || 40) + 10,
        L3: config.targetTPS?.L3 || 30,
        PLANNING: config.targetTPS?.PLANNING || 25,
      };
    }

    return config;
  }

  /**
   * 估算任务的内存需求（GB）
   */
  estimateMemoryRequirement(
    taskLevel: 'L1' | 'L2' | 'L3' | 'PLANNING',
    contextSize: number = 4096
  ): number {
    // 基础内存需求（模型加载）
    let baseMemory = 1.0;  // 基础开销

    // 根据任务级别估算
    const levelMultiplier: Record<string, number> = {
      L1: 0.5,
      L2: 1.0,
      L3: 2.0,
      PLANNING: 3.0,
    };

    const multiplier = levelMultiplier[taskLevel] || 1.0;

    // 根据上下文大小估算
    const contextMemory = (contextSize / 4096) * 0.5;  // 每4K tokens约0.5GB

    return baseMemory + (multiplier * 1.5) + contextMemory;
  }

  /**
   * 获取当前硬件配置
   */
  getHardwareConfig(): HardwareConfig {
    if (!this.hardwareConfig) {
      throw new Error('SystemSupervisor 未初始化，请先调用 initialize()');
    }
    return { ...this.hardwareConfig };
  }

  /**
   * 更新硬件配置
   */
  updateHardwareConfig(updates: Partial<HardwareConfig>): void {
    if (!this.hardwareConfig) {
      throw new Error('SystemSupervisor 未初始化，请先调用 initialize()');
    }
    this.hardwareConfig = { ...this.hardwareConfig, ...updates };
    console.log('⚙️ 硬件配置已更新');
  }

  /**
   * 创建资源监控器
   */
  createResourceMonitor(inferenceEngine?: any): ResourceMonitor {
    this.resourceMonitor = new ResourceMonitor(inferenceEngine);
    return this.resourceMonitor;
  }

  /**
   * 获取资源监控器
   */
  getResourceMonitor(): ResourceMonitor | null {
    return this.resourceMonitor;
  }

  /**
   * 打印系统配置摘要
   */
  printSummary(): void {
    if (!this.hardwareConfig) {
      console.log('⚠️ 系统监督器未初始化');
      return;
    }

    const config = this.hardwareConfig;
    const hspecConfig = this.generateHSpecConfig();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              T-NSEC 3.0 系统配置                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 环境: ${config.environment}`.padEnd(61) + '║');
    console.log(`║ GPU 显存: ${config.gpuMemoryGB} GB (${config.gpuAvailable ? '可用' : '不可用'})`.padEnd(61) + '║');
    console.log(`║ CPU 核心: ${config.cpuCores} 核心 / ${config.cpuThreads} 线程`.padEnd(61) + '║');
    console.log(`║ 系统内存: ${config.totalMemoryGB.toFixed(1)} GB (可用: ${config.freeMemoryGB.toFixed(1)} GB)`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ H-Spec 内存阈值: ${config.hspecThresholds.memoryThresholdGB} GB`.padEnd(61) + '║');
    console.log(`║ H-Spec CPU 阈值: ${config.hspecThresholds.cpuThreshold} 核心`.padEnd(61) + '║');
    console.log(`║ 7B 模型触发阈值: ${config.modelSelection.use7BWhenMemoryGB} GB`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ H-Spec 配置:'.padEnd(61) + '║');
    console.log(`║   Draft Tokens: ${hspecConfig.draftTokens}`.padEnd(61) + '║');
    console.log(`║   目标 TPW: ${hspecConfig.targetTPW}`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }
}

/**
 * 资源监控采样数据
 */
export interface ResourceSample {
  timestamp: number;          // 时间戳（毫秒）
  systemMemoryUsedMB: number;  // 系统内存使用量（MB）
  systemMemoryTotalMB: number; // 系统内存总量（MB）
  systemMemoryPercent: number; // 系统内存使用百分比
  gpuMemoryUsedMB: number;     // GPU显存使用量（MB）
  gpuMemoryTotalMB: number;    // GPU显存总量（MB）
  gpuMemoryPercent: number;    // GPU显存使用百分比
  gpuUtilization: number;      // GPU利用率（%）
  cpuUtilization: number;      // CPU整体利用率（%）
  gpuTemperature?: number;     // GPU温度（°C）
}

/**
 * 资源监控统计
 */
export interface ResourceStats {
  samples: ResourceSample[];
  duration: number;            // 监控总时长（毫秒）
  avgSystemMemoryMB: number;
  peakSystemMemoryMB: number;
  avgGPUMemoryMB: number;
  peakGPUMemoryMB: number;
  avgGPUUtilization: number;
  peakGPUUtilization: number;
  avgCPUUtilization: number;
  peakCPUUtilization: number;
  avgGPUTemperature?: number;
  peakGPUTemperature?: number;
}

/**
 * 资源监控器类
 */
export class ResourceMonitor {
  private samples: ResourceSample[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private startTime: number = 0;
  private inferenceEngine: any; // InferenceEngine 实例（可选）
  private cpuUsageHistory: Array<{ timestamp: number; idle: number; total: number }> = [];

  constructor(inferenceEngine?: any) {
    this.inferenceEngine = inferenceEngine;
  }

  /**
   * 开始监控
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      console.log('⚠️ 资源监控已在运行');
      return;
    }

    this.samples = [];
    this.cpuUsageHistory = [];
    this.isMonitoring = true;
    this.startTime = performance.now();

    console.log(`[SystemSupervisor] Resource monitoring started (interval: ${intervalMs}ms)`);

    // 立即采样一次
    this.takeSample();

    // 定时采样
    this.intervalId = setInterval(() => {
      this.takeSample();
    }, intervalMs);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): ResourceStats {
    if (!this.isMonitoring) {
      console.log('⚠️ 资源监控未运行');
      return this.getStats();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isMonitoring = false;
    const duration = performance.now() - this.startTime;

    console.log(`[SystemSupervisor] Resource monitoring stopped (duration: ${(duration / 1000).toFixed(2)}s, samples: ${this.samples.length})`);

    return this.getStats();
  }

  /**
   * 采集一次样本
   */
  private async takeSample(): Promise<void> {
    const timestamp = Date.now();

    // 1. 系统内存
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const systemMemoryPercent = (usedMemory / totalMemory) * 100;

    // 2. GPU 状态
    let gpuStatus: GPUStatus | null = null;
    if (this.inferenceEngine) {
      try {
        gpuStatus = await this.inferenceEngine.getGPUStatus();
      } catch (error) {
        // 忽略错误
      }
    }

    // 如果 InferenceEngine 不可用，尝试直接调用 nvidia-smi
    if (!gpuStatus) {
      gpuStatus = await this.getGPUStatusDirect();
    }

    // 3. CPU 利用率
    const cpuUtilization = await this.calculateCPUUsage();

    // 构建采样数据
    const sample: ResourceSample = {
      timestamp,
      systemMemoryUsedMB: usedMemory / (1024 * 1024),
      systemMemoryTotalMB: totalMemory / (1024 * 1024),
      systemMemoryPercent,
      gpuMemoryUsedMB: gpuStatus?.vramUsed || 0,
      gpuMemoryTotalMB: gpuStatus?.vramTotal || 0,
      gpuMemoryPercent: gpuStatus ? (gpuStatus.vramUsed / gpuStatus.vramTotal) * 100 : 0,
      gpuUtilization: gpuStatus?.gpuLoad || 0,
      cpuUtilization,
      gpuTemperature: gpuStatus?.temperature,
    };

    this.samples.push(sample);
  }

  /**
   * 直接获取 GPU 状态（通过 nvidia-smi）
   */
  private async getGPUStatusDirect(): Promise<GPUStatus | null> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync(
        'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu --format=csv,noheader,nounits',
        { encoding: 'utf8', timeout: 1000 }
      );

      const parts = output.trim().split(',').map(s => s.trim());

      return {
        name: parts[0],
        vramTotal: parseFloat(parts[1]),
        vramUsed: parseFloat(parts[2]),
        vramFree: parseFloat(parts[3]),
        gpuLoad: parseFloat(parts[4]),
        temperature: parseFloat(parts[5]),
        cudaAvailable: true,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 计算 CPU 利用率
   */
  private async calculateCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const now = Date.now();
    this.cpuUsageHistory.push({
      timestamp: now,
      idle: totalIdle,
      total: totalTick,
    });

    // 保留最近10次记录
    if (this.cpuUsageHistory.length > 10) {
      this.cpuUsageHistory.shift();
    }

    // 如果有历史记录，计算利用率
    if (this.cpuUsageHistory.length >= 2) {
      const prev = this.cpuUsageHistory[this.cpuUsageHistory.length - 2];
      const curr = this.cpuUsageHistory[this.cpuUsageHistory.length - 1];

      const idleDiff = curr.idle - prev.idle;
      const totalDiff = curr.total - prev.total;
      const usage = 100 - (idleDiff / totalDiff) * 100;

      return Math.max(0, Math.min(100, usage));
    }

    return 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): ResourceStats {
    if (this.samples.length === 0) {
      return {
        samples: [],
        duration: 0,
        avgSystemMemoryMB: 0,
        peakSystemMemoryMB: 0,
        avgGPUMemoryMB: 0,
        peakGPUMemoryMB: 0,
        avgGPUUtilization: 0,
        peakGPUUtilization: 0,
        avgCPUUtilization: 0,
        peakCPUUtilization: 0,
      };
    }

    const duration = this.isMonitoring
      ? performance.now() - this.startTime
      : (this.samples[this.samples.length - 1]?.timestamp || 0) - (this.samples[0]?.timestamp || 0);

    const avgSystemMemoryMB = this.samples.reduce((sum, s) => sum + s.systemMemoryUsedMB, 0) / this.samples.length;
    const peakSystemMemoryMB = Math.max(...this.samples.map(s => s.systemMemoryUsedMB));

    const avgGPUMemoryMB = this.samples.reduce((sum, s) => sum + s.gpuMemoryUsedMB, 0) / this.samples.length;
    const peakGPUMemoryMB = Math.max(...this.samples.map(s => s.gpuMemoryUsedMB));

    const avgGPUUtilization = this.samples.reduce((sum, s) => sum + s.gpuUtilization, 0) / this.samples.length;
    const peakGPUUtilization = Math.max(...this.samples.map(s => s.gpuUtilization));

    const avgCPUUtilization = this.samples.reduce((sum, s) => sum + s.cpuUtilization, 0) / this.samples.length;
    const peakCPUUtilization = Math.max(...this.samples.map(s => s.cpuUtilization));

    const tempSamples = this.samples.filter(s => s.gpuTemperature !== undefined);
    const avgGPUTemperature = tempSamples.length > 0
      ? tempSamples.reduce((sum, s) => sum + (s.gpuTemperature || 0), 0) / tempSamples.length
      : undefined;
    const peakGPUTemperature = tempSamples.length > 0
      ? Math.max(...tempSamples.map(s => s.gpuTemperature || 0))
      : undefined;

    return {
      samples: [...this.samples],
      duration,
      avgSystemMemoryMB,
      peakSystemMemoryMB,
      avgGPUMemoryMB,
      peakGPUMemoryMB,
      avgGPUUtilization,
      peakGPUUtilization,
      avgCPUUtilization,
      peakCPUUtilization,
      avgGPUTemperature,
      peakGPUTemperature,
    };
  }

  /**
   * 导出数据为 JSON
   */
  exportJSON(outputPath: string): void {
    const stats = this.getStats();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf-8');
    console.log(`[SystemSupervisor] Data exported to JSON: ${outputPath}`);
  }

  /**
   * 导出数据为 CSV
   */
  exportCSV(outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const lines: string[] = [];
    lines.push('时间戳,系统内存使用(MB),系统内存总量(MB),系统内存使用率(%),GPU显存使用(MB),GPU显存总量(MB),GPU显存使用率(%),GPU利用率(%),CPU利用率(%),GPU温度(°C)');

    for (const sample of this.samples) {
      lines.push([
        sample.timestamp,
        sample.systemMemoryUsedMB.toFixed(2),
        sample.systemMemoryTotalMB.toFixed(2),
        sample.systemMemoryPercent.toFixed(2),
        sample.gpuMemoryUsedMB.toFixed(2),
        sample.gpuMemoryTotalMB.toFixed(2),
        sample.gpuMemoryPercent.toFixed(2),
        sample.gpuUtilization.toFixed(2),
        sample.cpuUtilization.toFixed(2),
        sample.gpuTemperature?.toFixed(1) || '',
      ].join(','));
    }

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(`[SystemSupervisor] Data exported to CSV: ${outputPath}`);
  }

  /**
   * 生成 ASCII 图表
   */
  generateASCIIChart(metric: 'systemMemory' | 'gpuMemory' | 'gpuUtilization' | 'cpuUtilization', width: number = 60, height: number = 10): string {
    if (this.samples.length === 0) {
      return '无数据';
    }

    const values = this.samples.map(s => {
      switch (metric) {
        case 'systemMemory':
          return s.systemMemoryPercent;
        case 'gpuMemory':
          return s.gpuMemoryPercent;
        case 'gpuUtilization':
          return s.gpuUtilization;
        case 'cpuUtilization':
          return s.cpuUtilization;
      }
    });

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // 下采样到指定宽度
    const step = Math.max(1, Math.floor(this.samples.length / width));
    const sampledValues: number[] = [];
    for (let i = 0; i < this.samples.length; i += step) {
      sampledValues.push(values[i]);
    }

    // 生成图表
    const chart: string[] = [];
    const metricName = {
      systemMemory: '系统内存使用率',
      gpuMemory: 'GPU显存使用率',
      gpuUtilization: 'GPU利用率',
      cpuUtilization: 'CPU利用率',
    }[metric];

    chart.push(`\n${metricName} 趋势图 (${min.toFixed(1)}% - ${max.toFixed(1)}%)`);
    chart.push('─'.repeat(width + 10));

    // 从顶部到底部绘制
    for (let row = height - 1; row >= 0; row--) {
      const threshold = min + (range * row) / height;
      let line = `${(threshold).toFixed(0).padStart(4)}% │`;

      for (const value of sampledValues) {
        line += value >= threshold ? '█' : ' ';
      }

      chart.push(line);
    }

    chart.push('     └' + '─'.repeat(sampledValues.length));
    chart.push(`     时间 → (${sampledValues.length} 个采样点)`);

    return chart.join('\n');
  }

  /**
   * 打印统计报告
   */
  printStats(): void {
    const stats = this.getStats();

    if (stats.samples.length === 0) {
      console.log('⚠️ 无资源监控数据');
      return;
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              资源监控统计报告                              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 监控时长: ${(stats.duration / 1000).toFixed(2)}s`.padEnd(61) + '║');
    console.log(`║ 采样数量: ${stats.samples.length}`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 系统内存:'.padEnd(61) + '║');
    console.log(`║   平均使用: ${(stats.avgSystemMemoryMB / 1024).toFixed(2)} GB`.padEnd(61) + '║');
    console.log(`║   峰值使用: ${(stats.peakSystemMemoryMB / 1024).toFixed(2)} GB`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ GPU 显存:'.padEnd(61) + '║');
    console.log(`║   平均使用: ${(stats.avgGPUMemoryMB / 1024).toFixed(2)} GB`.padEnd(61) + '║');
    console.log(`║   峰值使用: ${(stats.peakGPUMemoryMB / 1024).toFixed(2)} GB`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ GPU 利用率:'.padEnd(61) + '║');
    console.log(`║   平均: ${stats.avgGPUUtilization.toFixed(1)}%`.padEnd(61) + '║');
    console.log(`║   峰值: ${stats.peakGPUUtilization.toFixed(1)}%`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ CPU 利用率:'.padEnd(61) + '║');
    console.log(`║   平均: ${stats.avgCPUUtilization.toFixed(1)}%`.padEnd(61) + '║');
    console.log(`║   峰值: ${stats.peakCPUUtilization.toFixed(1)}%`.padEnd(61) + '║');
    if (stats.avgGPUTemperature !== undefined) {
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║ GPU 温度:'.padEnd(61) + '║');
      console.log(`║   平均: ${stats.avgGPUTemperature.toFixed(1)}°C`.padEnd(61) + '║');
      console.log(`║   峰值: ${stats.peakGPUTemperature?.toFixed(1)}°C`.padEnd(61) + '║');
    }
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.samples = [];
    this.cpuUsageHistory = [];
  }
}

// 单例导出
export const systemSupervisor = new SystemSupervisor();

