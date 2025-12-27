/**
 * TKAPOCalibrator - 时间业力优化器
 * Temporal Karma with Adaptive Preference Optimization
 * 
 * 基于艾宾浩斯遗忘曲线的记忆衰减与巩固机制
 * 
 * 核心公式：
 * κ(t) = κ₀ × e^(-λt) + R × (1 - e^(-αt))
 * 
 * 其中：
 * - κ₀: 初始Karma值
 * - λ: 遗忘速率（基于访问频率调整）
 * - R: 强化项（由成功使用驱动）
 * - α: 强化速率
 * - t: 时间（天）
 */

import { performance } from 'perf_hooks';
import { GraphManager, GraphNode, GraphEdge } from '../graph/GraphManager.js';

export interface KarmaUpdate {
  nodeId: string;
  oldKarma: number;
  newKarma: number;
  reason: 'decay' | 'reinforce' | 'prune' | 'consolidate';
}

export interface CalibrationResult {
  updatedNodes: number;
  prunedNodes: number;
  consolidatedNodes: number;
  avgKarmaBefore: number;
  avgKarmaAfter: number;
  entropyBefore: number;
  entropyAfter: number;
  duration: number;
}

export interface AccessEvent {
  nodeId: string;
  timestamp: number;
  success: boolean;
  context?: string;
}

export class TKAPOCalibrator {
  private graph: GraphManager;
  
  // 遗忘曲线参数
  private forgetRate: number;      // λ - 基础遗忘率
  private reinforceRate: number;   // α - 强化速率
  private reinforceBonus: number;  // R - 强化加成
  
  // 阈值参数
  private pruneThreshold: number;  // 低于此Karma的节点将被剪枝
  private consolidateThreshold: number; // 高于此Karma的节点将被巩固
  
  // 访问历史
  private accessHistory: Map<string, AccessEvent[]> = new Map();
  
  // 时间单位（毫秒转天）
  private readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  constructor(
    graph: GraphManager,
    options: {
      forgetRate?: number;
      reinforceRate?: number;
      reinforceBonus?: number;
      pruneThreshold?: number;
      consolidateThreshold?: number;
    } = {}
  ) {
    this.graph = graph;
    
    // 默认参数（基于认知科学研究）
    this.forgetRate = options.forgetRate ?? 0.1;         // 每天衰减约10%
    this.reinforceRate = options.reinforceRate ?? 0.5;   // 强化较快
    this.reinforceBonus = options.reinforceBonus ?? 0.3; // 最大30%加成
    this.pruneThreshold = options.pruneThreshold ?? 0.1; // 低于10%的将被遗忘
    this.consolidateThreshold = options.consolidateThreshold ?? 0.9; // 高于90%将被巩固
  }

  /**
   * 记录访问事件
   */
  recordAccess(event: AccessEvent): void {
    const history = this.accessHistory.get(event.nodeId) || [];
    history.push(event);
    
    // 保留最近100次访问
    if (history.length > 100) {
      history.shift();
    }
    
    this.accessHistory.set(event.nodeId, history);
    
    // 立即更新Karma
    this.updateNodeKarma(event.nodeId, event.success);
  }

  /**
   * 更新单个节点的Karma
   */
  private updateNodeKarma(nodeId: string, success: boolean): KarmaUpdate | null {
    const node = this.graph.getNode(nodeId);
    if (!node) return null;

    const oldKarma = node.karma;
    let newKarma: number;

    if (success) {
      // 成功访问：应用强化
      newKarma = Math.min(1.0, oldKarma + this.reinforceBonus * (1 - oldKarma));
    } else {
      // 失败访问：轻微衰减
      newKarma = oldKarma * 0.95;
    }

    this.graph.updateNode(nodeId, { karma: newKarma });

    return {
      nodeId,
      oldKarma,
      newKarma,
      reason: success ? 'reinforce' : 'decay',
    };
  }

  /**
   * 计算基于时间的Karma衰减
   */
  private calculateDecayedKarma(
    node: GraphNode,
    nowMs: number
  ): number {
    const daysSinceUpdate = (nowMs - node.updatedAt) / this.MS_PER_DAY;
    
    // 获取访问历史
    const history = this.accessHistory.get(node.id) || [];
    const successCount = history.filter(e => e.success).length;
    const accessCount = history.length;
    
    // 调整遗忘率：访问越频繁，遗忘越慢
    const adjustedForgetRate = this.forgetRate / (1 + accessCount * 0.1);
    
    // 计算遗忘项
    const forgetTerm = node.karma * Math.exp(-adjustedForgetRate * daysSinceUpdate);
    
    // 计算强化项（基于成功率）
    const successRate = accessCount > 0 ? successCount / accessCount : 0;
    const reinforceTerm = this.reinforceBonus * successRate * 
      (1 - Math.exp(-this.reinforceRate * accessCount));
    
    // 合并
    const newKarma = forgetTerm + reinforceTerm;
    
    return Math.max(0, Math.min(1, newKarma));
  }

  /**
   * 执行完整的校准周期
   */
  runCalibration(): CalibrationResult {
    const startTime = performance.now();
    const nowMs = Date.now();
    
    // 获取所有节点
    const nodes = this.graph.getAllNodes(100000);
    
    // 计算初始统计
    const avgKarmaBefore = nodes.reduce((sum, n) => sum + n.karma, 0) / nodes.length;
    const entropyBefore = this.calculateCognitiveEntropy();
    
    const updates: KarmaUpdate[] = [];
    const toPrune: string[] = [];
    const toConsolidate: string[] = [];

    // 遍历所有节点
    for (const node of nodes) {
      const newKarma = this.calculateDecayedKarma(node, nowMs);
      
      if (newKarma < this.pruneThreshold) {
        // 标记为剪枝
        toPrune.push(node.id);
        updates.push({
          nodeId: node.id,
          oldKarma: node.karma,
          newKarma: 0,
          reason: 'prune',
        });
      } else if (newKarma > this.consolidateThreshold) {
        // 标记为巩固（设为最大值）
        toConsolidate.push(node.id);
        updates.push({
          nodeId: node.id,
          oldKarma: node.karma,
          newKarma: 1.0,
          reason: 'consolidate',
        });
      } else if (Math.abs(newKarma - node.karma) > 0.01) {
        // 普通衰减
        updates.push({
          nodeId: node.id,
          oldKarma: node.karma,
          newKarma,
          reason: 'decay',
        });
      }
    }

    // 批量更新Karma
    const karmaUpdates = updates
      .filter(u => u.reason !== 'prune')
      .map(u => ({ id: u.nodeId, karma: u.newKarma }));
    
    this.graph.batchUpdateKarma(karmaUpdates);

    // 执行剪枝
    for (const nodeId of toPrune) {
      this.graph.deleteNode(nodeId);
    }

    // 计算最终统计
    const nodesAfter = this.graph.getAllNodes(100000);
    const avgKarmaAfter = nodesAfter.length > 0 
      ? nodesAfter.reduce((sum, n) => sum + n.karma, 0) / nodesAfter.length 
      : 0;
    const entropyAfter = this.calculateCognitiveEntropy();

    return {
      updatedNodes: updates.length,
      prunedNodes: toPrune.length,
      consolidatedNodes: toConsolidate.length,
      avgKarmaBefore,
      avgKarmaAfter,
      entropyBefore,
      entropyAfter,
      duration: performance.now() - startTime,
    };
  }

  /**
   * 计算认知熵（图结构的不确定性度量）
   * 使用模块度的倒数作为熵的近似
   */
  calculateCognitiveEntropy(): number {
    const modularity = this.graph.calculateModularity();
    
    // 模块度范围通常是[-0.5, 1]
    // 转换为熵值：模块度越高，熵越低
    const entropy = 1 - (modularity + 0.5) / 1.5;
    
    return Math.max(0, Math.min(1, entropy));
  }

  /**
   * 模拟长期运行
   */
  simulateLongTerm(days: number, eventsPerDay: number): {
    day: number;
    nodeCount: number;
    avgKarma: number;
    entropy: number;
  }[] {
    const results: {
      day: number;
      nodeCount: number;
      avgKarma: number;
      entropy: number;
    }[] = [];

    for (let day = 1; day <= days; day++) {
      // 模拟每天的访问事件
      const nodes = this.graph.getAllNodes(1000);
      
      for (let e = 0; e < eventsPerDay && nodes.length > 0; e++) {
        // 随机选择节点
        const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
        
        // 随机成功/失败（成功率与Karma相关）
        const success = Math.random() < randomNode.karma;
        
        this.recordAccess({
          nodeId: randomNode.id,
          timestamp: Date.now(),
          success,
        });
      }

      // 每天结束时运行校准
      const calibResult = this.runCalibration();
      
      results.push({
        day,
        nodeCount: this.graph.getStats().nodeCount,
        avgKarma: calibResult.avgKarmaAfter,
        entropy: calibResult.entropyAfter,
      });
    }

    return results;
  }

  /**
   * 获取节点的遗忘预测
   */
  predictForgetting(nodeId: string, daysAhead: number): number[] {
    const node = this.graph.getNode(nodeId);
    if (!node) return [];

    const predictions: number[] = [];
    const nowMs = Date.now();
    const history = this.accessHistory.get(nodeId) || [];
    const accessCount = history.length;
    
    // 调整遗忘率
    const adjustedForgetRate = this.forgetRate / (1 + accessCount * 0.1);

    for (let day = 0; day <= daysAhead; day++) {
      const predictedKarma = node.karma * Math.exp(-adjustedForgetRate * day);
      predictions.push(Math.max(0, predictedKarma));
    }

    return predictions;
  }

  /**
   * 获取最佳复习时机
   */
  getOptimalReviewTime(nodeId: string): number {
    const node = this.graph.getNode(nodeId);
    if (!node) return 0;

    // 当Karma下降到70%时是最佳复习时机（基于间隔重复学习理论）
    const targetKarma = node.karma * 0.7;
    const history = this.accessHistory.get(nodeId) || [];
    const adjustedForgetRate = this.forgetRate / (1 + history.length * 0.1);
    
    // 求解 t: karma * e^(-λt) = targetKarma
    const daysUntilReview = -Math.log(targetKarma / node.karma) / adjustedForgetRate;
    
    return Math.max(1, Math.round(daysUntilReview));
  }

  /**
   * 获取需要复习的节点（按紧迫程度排序）
   */
  getNodesNeedingReview(topK: number = 10): Array<{
    nodeId: string;
    urgency: number;
    daysUntilForget: number;
  }> {
    const nodes = this.graph.getAllNodes(1000);
    const results: Array<{
      nodeId: string;
      urgency: number;
      daysUntilForget: number;
    }> = [];

    for (const node of nodes) {
      // 计算距离遗忘阈值的天数
      const history = this.accessHistory.get(node.id) || [];
      const adjustedForgetRate = this.forgetRate / (1 + history.length * 0.1);
      
      if (node.karma > this.pruneThreshold) {
        const daysUntilForget = -Math.log(this.pruneThreshold / node.karma) / adjustedForgetRate;
        const urgency = 1 / (1 + daysUntilForget);
        
        results.push({
          nodeId: node.id,
          urgency,
          daysUntilForget: Math.max(0, daysUntilForget),
        });
      }
    }

    // 按紧迫程度排序
    results.sort((a, b) => b.urgency - a.urgency);
    
    return results.slice(0, topK);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalNodes: number;
    avgKarma: number;
    nodesAtRisk: number;
    consolidatedNodes: number;
    cognitiveEntropy: number;
    accessHistorySize: number;
  } {
    const nodes = this.graph.getAllNodes(100000);
    const avgKarma = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.karma, 0) / nodes.length 
      : 0;
    
    const nodesAtRisk = nodes.filter(n => n.karma < this.pruneThreshold * 2).length;
    const consolidatedNodes = nodes.filter(n => n.karma > this.consolidateThreshold).length;
    
    return {
      totalNodes: nodes.length,
      avgKarma,
      nodesAtRisk,
      consolidatedNodes,
      cognitiveEntropy: this.calculateCognitiveEntropy(),
      accessHistorySize: this.accessHistory.size,
    };
  }

  /**
   * 清除访问历史
   */
  clearHistory(): void {
    this.accessHistory.clear();
  }

  /**
   * 导出访问历史
   */
  exportHistory(): Map<string, AccessEvent[]> {
    return new Map(this.accessHistory);
  }

  /**
   * 导入访问历史
   */
  importHistory(history: Map<string, AccessEvent[]>): void {
    this.accessHistory = new Map(history);
  }
}

export default TKAPOCalibrator;

