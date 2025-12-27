/**
 * MetricsCollector - 评估指标收集器
 * 
 * Thomas Zero 4.0 增强版
 * 
 * 收集和计算系统的关键评估指标：
 * - BWT (Backward Transfer): 后向迁移
 * - 认知熵: 图结构复杂度
 * - 类比迁移率: 跨域知识应用能力
 * - 置信度校准: 预测置信度与实际准确率的一致性
 * - 延迟统计: 各模块的响应时间
 * - GPU指标: VRAM使用、GPU负载、能效比
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

export interface LatencyRecord {
  module: string;
  operation: string;
  latency: number; // ms
  timestamp: number;
}

// GPU 指标记录
export interface GPUMetricRecord {
  timestamp: number;
  vramUsed: number;      // MB
  vramTotal: number;     // MB
  gpuLoad: number;       // %
  temperature: number;   // °C
  powerDraw: number;     // W
  tokensGenerated: number;
}

export interface TaskResult {
  taskId: string;
  domain: string;
  predicted: string;
  actual: string;
  confidence: number;
  correct: boolean;
  latency: number;
}

export interface CalibrationBin {
  confidenceRange: [number, number];
  predictedConfidence: number;
  actualAccuracy: number;
  count: number;
}

export interface MetricsReport {
  timestamp: number;
  duration: number;
  
  // 核心指标
  bwt: number;                    // Backward Transfer
  cognitiveEntropy: number;       // 认知熵
  analogyTransferRate: number;    // 类比迁移率
  calibrationError: number;       // ECE (Expected Calibration Error)
  
  // 效率指标
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  
  // 图谱指标
  nodeCount: number;
  edgeCount: number;
  avgKarma: number;
  modularity: number;
  
  // GPU 指标 (Thomas Zero 4.0)
  gpuMetrics?: {
    avgVramUsed: number;      // MB
    peakVramUsed: number;     // MB
    avgGpuLoad: number;       // %
    peakGpuLoad: number;      // %
    avgTemperature: number;   // °C
    avgPowerDraw: number;     // W
    totalTokens: number;
    avgTPS: number;           // Tokens Per Second
    TPW: number;              // Tokens Per Watt
  };
  
  // 详细统计
  tasksByDomain: Record<string, { count: number; accuracy: number }>;
  calibrationBins: CalibrationBin[];
  latencyByModule: Record<string, { avg: number; p95: number }>;
}

export class MetricsCollector {
  private latencyRecords: LatencyRecord[] = [];
  private taskResults: TaskResult[] = [];
  private domainPerformance: Map<string, number[]> = new Map();
  private gpuMetrics: GPUMetricRecord[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 记录 GPU 指标
   */
  recordGPUMetrics(metrics: Omit<GPUMetricRecord, 'timestamp'>): void {
    this.gpuMetrics.push({
      ...metrics,
      timestamp: Date.now(),
    });
  }

  /**
   * 从 nvidia-smi 采集 GPU 指标
   */
  async captureGPUMetrics(tokensGenerated: number = 0): Promise<GPUMetricRecord | null> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync(
        'nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits',
        { encoding: 'utf8' }
      );
      
      const parts = output.trim().split(',').map(s => parseFloat(s.trim()));
      
      const record: GPUMetricRecord = {
        timestamp: Date.now(),
        vramUsed: parts[0],
        vramTotal: parts[1],
        gpuLoad: parts[2],
        temperature: parts[3],
        powerDraw: parts[4] || 320,  // 默认 320W
        tokensGenerated,
      };
      
      this.gpuMetrics.push(record);
      return record;
    } catch {
      return null;
    }
  }

  /**
   * 计算 GPU 统计指标
   */
  calculateGPUStats(): {
    avgVramUsed: number;
    peakVramUsed: number;
    avgGpuLoad: number;
    peakGpuLoad: number;
    avgTemperature: number;
    avgPowerDraw: number;
    totalTokens: number;
    avgTPS: number;
    TPW: number;
  } | null {
    if (this.gpuMetrics.length === 0) {
      return null;
    }

    const avgVramUsed = this.gpuMetrics.reduce((sum, m) => sum + m.vramUsed, 0) / this.gpuMetrics.length;
    const peakVramUsed = Math.max(...this.gpuMetrics.map(m => m.vramUsed));
    const avgGpuLoad = this.gpuMetrics.reduce((sum, m) => sum + m.gpuLoad, 0) / this.gpuMetrics.length;
    const peakGpuLoad = Math.max(...this.gpuMetrics.map(m => m.gpuLoad));
    const avgTemperature = this.gpuMetrics.reduce((sum, m) => sum + m.temperature, 0) / this.gpuMetrics.length;
    const avgPowerDraw = this.gpuMetrics.reduce((sum, m) => sum + m.powerDraw, 0) / this.gpuMetrics.length;
    const totalTokens = this.gpuMetrics.reduce((sum, m) => sum + m.tokensGenerated, 0);
    
    // 计算总时间（秒）
    const duration = this.gpuMetrics.length > 1 
      ? (this.gpuMetrics[this.gpuMetrics.length - 1].timestamp - this.gpuMetrics[0].timestamp) / 1000
      : 1;
    
    const avgTPS = totalTokens / duration;
    
    // TPW = Tokens Per Watt-hour
    const wattHours = (avgPowerDraw * duration) / 3600;
    const TPW = wattHours > 0 ? totalTokens / wattHours : 0;

    return {
      avgVramUsed,
      peakVramUsed,
      avgGpuLoad,
      peakGpuLoad,
      avgTemperature,
      avgPowerDraw,
      totalTokens,
      avgTPS,
      TPW,
    };
  }

  /**
   * 打印 GPU 统计
   */
  printGPUStats(): void {
    const stats = this.calculateGPUStats();
    if (!stats) {
      console.log('⚠️ 无 GPU 指标数据');
      return;
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    GPU 性能统计                             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ VRAM 使用: ${stats.avgVramUsed.toFixed(0)} MB (峰值: ${stats.peakVramUsed.toFixed(0)} MB)`.padEnd(61) + '║');
    console.log(`║ GPU 负载: ${stats.avgGpuLoad.toFixed(1)}% (峰值: ${stats.peakGpuLoad.toFixed(1)}%)`.padEnd(61) + '║');
    console.log(`║ 温度: ${stats.avgTemperature.toFixed(1)}°C`.padEnd(61) + '║');
    console.log(`║ 功耗: ${stats.avgPowerDraw.toFixed(1)} W`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 总 Token 数: ${stats.totalTokens}`.padEnd(61) + '║');
    console.log(`║ 平均 TPS: ${stats.avgTPS.toFixed(2)} tokens/s`.padEnd(61) + '║');
    console.log(`║ 能效比 (TPW): ${stats.TPW.toFixed(2)} tokens/Wh`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 记录延迟
   */
  recordLatency(module: string, operation: string, latency: number): void {
    this.latencyRecords.push({
      module,
      operation,
      latency,
      timestamp: Date.now(),
    });
  }

  /**
   * 记录任务结果
   */
  recordTaskResult(result: TaskResult): void {
    this.taskResults.push(result);
    
    // 更新域性能历史
    const history = this.domainPerformance.get(result.domain) || [];
    history.push(result.correct ? 1 : 0);
    this.domainPerformance.set(result.domain, history);
  }

  /**
   * 计算BWT (Backward Transfer)
   * 衡量学习新任务对旧任务的影响
   */
  calculateBWT(): number {
    const domains = Array.from(this.domainPerformance.keys());
    if (domains.length < 2) return 0;

    let totalBWT = 0;
    let count = 0;

    for (const domain of domains) {
      const history = this.domainPerformance.get(domain)!;
      if (history.length < 10) continue;

      // 比较前半段和后半段的准确率
      const midPoint = Math.floor(history.length / 2);
      const earlyAccuracy = history.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
      const lateAccuracy = history.slice(midPoint).reduce((a, b) => a + b, 0) / (history.length - midPoint);

      totalBWT += lateAccuracy - earlyAccuracy;
      count++;
    }

    return count > 0 ? totalBWT / count : 0;
  }

  /**
   * 计算认知熵
   * 基于任务结果的不确定性
   */
  calculateCognitiveEntropy(): number {
    if (this.taskResults.length === 0) return 1;

    // 按置信度区间统计
    const bins = new Array(10).fill(0);
    const binCounts = new Array(10).fill(0);

    for (const result of this.taskResults) {
      const binIndex = Math.min(9, Math.floor(result.confidence * 10));
      bins[binIndex] += result.correct ? 1 : 0;
      binCounts[binIndex]++;
    }

    // 计算熵
    let entropy = 0;
    const total = this.taskResults.length;

    for (let i = 0; i < 10; i++) {
      if (binCounts[i] === 0) continue;
      
      const p = binCounts[i] / total;
      const accuracy = bins[i] / binCounts[i];
      
      // 理想情况：高置信度 = 高准确率，低置信度 = 低准确率
      // 熵 = 偏离理想情况的程度
      const expectedAccuracy = (i + 0.5) / 10;
      entropy += p * Math.abs(accuracy - expectedAccuracy);
    }

    return entropy;
  }

  /**
   * 计算类比迁移率
   * 衡量跨域知识应用能力
   */
  calculateAnalogyTransferRate(): number {
    const domainPairs = new Map<string, { attempts: number; successes: number }>();

    // 分析连续任务是否在不同域间成功迁移
    for (let i = 1; i < this.taskResults.length; i++) {
      const prev = this.taskResults[i - 1];
      const curr = this.taskResults[i];

      if (prev.domain !== curr.domain) {
        const pairKey = `${prev.domain}->${curr.domain}`;
        const stats = domainPairs.get(pairKey) || { attempts: 0, successes: 0 };
        
        stats.attempts++;
        if (curr.correct && prev.correct) {
          stats.successes++;
        }
        
        domainPairs.set(pairKey, stats);
      }
    }

    // 计算平均迁移成功率
    let totalRate = 0;
    let pairCount = 0;

    for (const stats of domainPairs.values()) {
      if (stats.attempts >= 3) { // 至少3次尝试
        totalRate += stats.successes / stats.attempts;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalRate / pairCount : 0.5; // 默认50%
  }

  /**
   * 计算ECE (Expected Calibration Error)
   */
  calculateCalibrationError(): { ece: number; bins: CalibrationBin[] } {
    const numBins = 10;
    const bins: CalibrationBin[] = [];

    for (let i = 0; i < numBins; i++) {
      const low = i / numBins;
      const high = (i + 1) / numBins;
      
      const binResults = this.taskResults.filter(r => 
        r.confidence >= low && r.confidence < high
      );

      if (binResults.length > 0) {
        const avgConfidence = binResults.reduce((sum, r) => sum + r.confidence, 0) / binResults.length;
        const accuracy = binResults.filter(r => r.correct).length / binResults.length;

        bins.push({
          confidenceRange: [low, high],
          predictedConfidence: avgConfidence,
          actualAccuracy: accuracy,
          count: binResults.length,
        });
      }
    }

    // 计算ECE
    let ece = 0;
    const total = this.taskResults.length;

    for (const bin of bins) {
      ece += (bin.count / total) * Math.abs(bin.actualAccuracy - bin.predictedConfidence);
    }

    return { ece, bins };
  }

  /**
   * 计算延迟统计
   */
  calculateLatencyStats(): {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    byModule: Record<string, { avg: number; p95: number }>;
  } {
    if (this.latencyRecords.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, byModule: {} };
    }

    const latencies = this.latencyRecords.map(r => r.latency).sort((a, b) => a - b);
    
    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, index)];
    };

    // 按模块分组
    const byModule: Record<string, number[]> = {};
    for (const record of this.latencyRecords) {
      if (!byModule[record.module]) {
        byModule[record.module] = [];
      }
      byModule[record.module].push(record.latency);
    }

    const moduleStats: Record<string, { avg: number; p95: number }> = {};
    for (const [module, lats] of Object.entries(byModule)) {
      lats.sort((a, b) => a - b);
      moduleStats[module] = {
        avg: lats.reduce((a, b) => a + b, 0) / lats.length,
        p95: percentile(lats, 0.95),
      };
    }

    return {
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: percentile(latencies, 0.50),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      byModule: moduleStats,
    };
  }

  /**
   * 生成完整报告
   */
  generateReport(graphStats?: {
    nodeCount: number;
    edgeCount: number;
    avgKarma: number;
    modularity: number;
  }): MetricsReport {
    const duration = Date.now() - this.startTime;
    const latencyStats = this.calculateLatencyStats();
    const calibration = this.calculateCalibrationError();

    // 按域统计
    const tasksByDomain: Record<string, { count: number; accuracy: number }> = {};
    for (const [domain, history] of this.domainPerformance) {
      tasksByDomain[domain] = {
        count: history.length,
        accuracy: history.reduce((a, b) => a + b, 0) / history.length,
      };
    }

    // GPU 指标
    const gpuMetrics = this.calculateGPUStats();

    return {
      timestamp: Date.now(),
      duration,
      
      bwt: this.calculateBWT(),
      cognitiveEntropy: this.calculateCognitiveEntropy(),
      analogyTransferRate: this.calculateAnalogyTransferRate(),
      calibrationError: calibration.ece,
      
      avgLatency: latencyStats.avg,
      p50Latency: latencyStats.p50,
      p95Latency: latencyStats.p95,
      p99Latency: latencyStats.p99,
      
      nodeCount: graphStats?.nodeCount ?? 0,
      edgeCount: graphStats?.edgeCount ?? 0,
      avgKarma: graphStats?.avgKarma ?? 0,
      modularity: graphStats?.modularity ?? 0,

      gpuMetrics: gpuMetrics ?? undefined,
      
      tasksByDomain,
      calibrationBins: calibration.bins,
      latencyByModule: latencyStats.byModule,
    };
  }

  /**
   * 导出报告为JSON
   */
  exportReport(outputPath: string, graphStats?: {
    nodeCount: number;
    edgeCount: number;
    avgKarma: number;
    modularity: number;
  }): string {
    const report = this.generateReport(graphStats);
    
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const json = JSON.stringify(report, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');
    
    console.log(`[MetricsCollector] Report exported: ${outputPath}`);
    return json;
  }

  /**
   * 打印报告摘要
   */
  printSummary(graphStats?: {
    nodeCount: number;
    edgeCount: number;
    avgKarma: number;
    modularity: number;
  }): void {
    const report = this.generateReport(graphStats);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              Thomas Zero 4.0 评估报告                       ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 运行时长: ${(report.duration / 1000).toFixed(2)}s`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 核心指标:'.padEnd(61) + '║');
    console.log(`║   BWT (后向迁移): ${report.bwt.toFixed(4)}`.padEnd(61) + '║');
    console.log(`║   认知熵: ${report.cognitiveEntropy.toFixed(4)}`.padEnd(61) + '║');
    console.log(`║   类比迁移率: ${(report.analogyTransferRate * 100).toFixed(2)}%`.padEnd(61) + '║');
    console.log(`║   校准误差(ECE): ${report.calibrationError.toFixed(4)}`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 效率指标:'.padEnd(61) + '║');
    console.log(`║   平均延迟: ${report.avgLatency.toFixed(2)}ms`.padEnd(61) + '║');
    console.log(`║   P50延迟: ${report.p50Latency.toFixed(2)}ms`.padEnd(61) + '║');
    console.log(`║   P95延迟: ${report.p95Latency.toFixed(2)}ms`.padEnd(61) + '║');
    console.log(`║   P99延迟: ${report.p99Latency.toFixed(2)}ms`.padEnd(61) + '║');
    
    // GPU 指标 (Thomas Zero 4.0)
    if (report.gpuMetrics) {
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║ GPU 指标 (RTX 3080):'.padEnd(61) + '║');
      console.log(`║   VRAM: ${report.gpuMetrics.avgVramUsed.toFixed(0)}/${report.gpuMetrics.peakVramUsed.toFixed(0)} MB (avg/peak)`.padEnd(61) + '║');
      console.log(`║   GPU 负载: ${report.gpuMetrics.avgGpuLoad.toFixed(1)}% (峰值: ${report.gpuMetrics.peakGpuLoad.toFixed(1)}%)`.padEnd(61) + '║');
      console.log(`║   温度: ${report.gpuMetrics.avgTemperature.toFixed(1)}°C`.padEnd(61) + '║');
      console.log(`║   功耗: ${report.gpuMetrics.avgPowerDraw.toFixed(1)} W`.padEnd(61) + '║');
      console.log(`║   平均 TPS: ${report.gpuMetrics.avgTPS.toFixed(2)} tokens/s`.padEnd(61) + '║');
      console.log(`║   能效比 (TPW): ${report.gpuMetrics.TPW.toFixed(2)} tokens/Wh`.padEnd(61) + '║');
    }
    
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 图谱指标:'.padEnd(61) + '║');
    console.log(`║   节点数: ${report.nodeCount}`.padEnd(61) + '║');
    console.log(`║   边数: ${report.edgeCount}`.padEnd(61) + '║');
    console.log(`║   平均Karma: ${report.avgKarma.toFixed(4)}`.padEnd(61) + '║');
    console.log(`║   模块度: ${report.modularity.toFixed(4)}`.padEnd(61) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 重置收集器
   */
  reset(): void {
    this.latencyRecords = [];
    this.taskResults = [];
    this.domainPerformance.clear();
    this.gpuMetrics = [];
    this.startTime = Date.now();
  }

  /**
   * 获取原始数据
   */
  getRawData(): {
    latencyRecords: LatencyRecord[];
    taskResults: TaskResult[];
  } {
    return {
      latencyRecords: [...this.latencyRecords],
      taskResults: [...this.taskResults],
    };
  }

  /**
   * 计算多轮实验的统计
   */
  static aggregateReports(reports: MetricsReport[]): {
    mean: Partial<MetricsReport>;
    std: Partial<MetricsReport>;
  } {
    if (reports.length === 0) {
      return { mean: {}, std: {} };
    }

    const keys: (keyof MetricsReport)[] = [
      'bwt', 'cognitiveEntropy', 'analogyTransferRate', 'calibrationError',
      'avgLatency', 'p50Latency', 'p95Latency', 'p99Latency',
      'nodeCount', 'edgeCount', 'avgKarma', 'modularity'
    ];

    const mean: Partial<MetricsReport> = {};
    const std: Partial<MetricsReport> = {};

    for (const key of keys) {
      const values = reports.map(r => r[key] as number);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
      
      (mean as Record<string, number>)[key] = avg;
      (std as Record<string, number>)[key] = Math.sqrt(variance);
    }

    return { mean, std };
  }
}

export default MetricsCollector;

