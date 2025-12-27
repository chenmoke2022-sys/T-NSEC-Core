/**
 * StreamingHashMemory - 流式哈希内存系统
 * 
 * 实现增量/流式Karma更新机制，支持：
 * - 缓冲写入（减少IO）
 * - 增量索引更新
 * - 近实时查询
 * - 内存友好的LSH索引
 */

import { performance } from 'perf_hooks';
import { GraphManager } from '../graph/GraphManager.js';
import { HDCEngine, HyperVector, hdcEngine } from '../hdc/HDCEngine.js';

export interface KarmaBufferEntry {
  nodeId: string;
  delta: number;
  timestamp: number;
  source: string;
}

export interface LSHBucket {
  id: string;
  members: Set<string>;
  hyperplane: HyperVector;
}

export interface UpdateStats {
  bufferedUpdates: number;
  flushedUpdates: number;
  avgFlushLatency: number;
  indexRebuildCount: number;
}

export interface QueryResult {
  nodeId: string;
  similarity: number;
  karma: number;
}

export class StreamingHashMemory {
  private graph: GraphManager;
  private hdc: HDCEngine;
  
  // 更新缓冲
  private karmaBuffer: KarmaBufferEntry[] = [];
  private bufferCapacity: number;
  private autoFlushInterval: number; // ms
  
  // LSH索引
  private lshTables: Map<number, Map<string, LSHBucket>> = new Map();
  private numHashTables: number;
  private numHashFunctions: number;
  private hyperplanes: HyperVector[][] = [];
  
  // 统计
  private flushCount: number = 0;
  private totalFlushLatency: number = 0;
  private indexRebuildCount: number = 0;
  
  // 自动刷新定时器
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    graph: GraphManager,
    options: {
      bufferCapacity?: number;
      autoFlushInterval?: number;
      numHashTables?: number;
      numHashFunctions?: number;
    } = {},
    hdc: HDCEngine = hdcEngine
  ) {
    this.graph = graph;
    this.hdc = hdc;
    
    this.bufferCapacity = options.bufferCapacity ?? 100;
    this.autoFlushInterval = options.autoFlushInterval ?? 5000;
    this.numHashTables = options.numHashTables ?? 4;
    this.numHashFunctions = options.numHashFunctions ?? 8;
    
    this.initializeLSH();
    this.startAutoFlush();
  }

  /**
   * 初始化LSH索引
   */
  private initializeLSH(): void {
    // 生成随机超平面
    for (let t = 0; t < this.numHashTables; t++) {
      this.hyperplanes[t] = [];
      for (let h = 0; h < this.numHashFunctions; h++) {
        this.hyperplanes[t][h] = this.hdc.generateRandomVector();
      }
      this.lshTables.set(t, new Map());
    }
  }

  /**
   * 启动自动刷新
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.karmaBuffer.length > 0) {
        this.flush();
      }
    }, this.autoFlushInterval);
  }

  /**
   * 停止自动刷新
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 缓冲Karma更新
   */
  bufferKarmaUpdate(nodeId: string, delta: number, source: string = 'user'): void {
    this.karmaBuffer.push({
      nodeId,
      delta,
      timestamp: Date.now(),
      source,
    });

    // 检查是否需要刷新
    if (this.karmaBuffer.length >= this.bufferCapacity) {
      this.flush();
    }
  }

  /**
   * 批量缓冲更新
   */
  bufferBatchUpdates(updates: Array<{nodeId: string; delta: number; source?: string}>): void {
    for (const update of updates) {
      this.karmaBuffer.push({
        nodeId: update.nodeId,
        delta: update.delta,
        timestamp: Date.now(),
        source: update.source ?? 'batch',
      });
    }

    if (this.karmaBuffer.length >= this.bufferCapacity) {
      this.flush();
    }
  }

  /**
   * 刷新缓冲区到数据库
   */
  flush(): number {
    if (this.karmaBuffer.length === 0) return 0;
    
    const startTime = performance.now();
    
    // 合并相同节点的更新
    const mergedUpdates = new Map<string, number>();
    
    for (const entry of this.karmaBuffer) {
      const current = mergedUpdates.get(entry.nodeId) ?? 0;
      mergedUpdates.set(entry.nodeId, current + entry.delta);
    }

    // 应用更新
    const updates: Array<{id: string; karma: number}> = [];
    
    for (const [nodeId, delta] of mergedUpdates) {
      const node = this.graph.getNode(nodeId);
      if (node) {
        const newKarma = Math.max(0, Math.min(1, node.karma + delta));
        updates.push({ id: nodeId, karma: newKarma });
      }
    }

    // 批量写入数据库
    const updatedCount = this.graph.batchUpdateKarma(updates);
    
    // 增量更新LSH索引
    for (const update of updates) {
      this.updateLSHIndex(update.id);
    }

    // 清空缓冲
    const flushedCount = this.karmaBuffer.length;
    this.karmaBuffer = [];
    
    // 更新统计
    const flushLatency = performance.now() - startTime;
    this.flushCount++;
    this.totalFlushLatency += flushLatency;
    
    console.log(`💾 刷新 ${flushedCount} 条更新，耗时 ${flushLatency.toFixed(2)}ms`);
    
    return updatedCount;
  }

  /**
   * 计算LSH哈希值
   */
  private computeLSHHash(vector: HyperVector, tableIndex: number): string {
    const bits: number[] = [];
    
    for (let h = 0; h < this.numHashFunctions; h++) {
      const hyperplane = this.hyperplanes[tableIndex][h];
      const sim = this.hdc.similarity(vector, hyperplane);
      bits.push(sim.similarity > 0.5 ? 1 : 0);
    }
    
    return bits.join('');
  }

  /**
   * 更新LSH索引
   */
  private updateLSHIndex(nodeId: string): void {
    const node = this.graph.getNode(nodeId);
    if (!node) return;

    // 获取节点的超向量表示
    const vector = this.hdc.getSymbolVector(node.label);

    // 更新每个哈希表
    for (let t = 0; t < this.numHashTables; t++) {
      const table = this.lshTables.get(t)!;
      const hash = this.computeLSHHash(vector, t);
      
      // 先从所有桶中移除
      for (const bucket of table.values()) {
        bucket.members.delete(nodeId);
      }
      
      // 添加到新桶
      if (!table.has(hash)) {
        table.set(hash, {
          id: hash,
          members: new Set(),
          hyperplane: this.hyperplanes[t][0], // 使用第一个超平面作为代表
        });
      }
      table.get(hash)!.members.add(nodeId);
    }
  }

  /**
   * 重建完整LSH索引
   */
  rebuildIndex(): void {
    const startTime = performance.now();
    
    // 清空现有索引
    for (const table of this.lshTables.values()) {
      table.clear();
    }

    // 遍历所有节点
    const nodes = this.graph.getAllNodes(100000);
    
    for (const node of nodes) {
      this.updateLSHIndex(node.id);
    }

    this.indexRebuildCount++;
    console.log(`🔄 LSH索引重建完成，${nodes.length} 节点，耗时 ${(performance.now() - startTime).toFixed(2)}ms`);
  }

  /**
   * LSH近似最近邻搜索
   */
  approximateNearestNeighbors(
    queryVector: HyperVector,
    topK: number = 10
  ): QueryResult[] {
    const candidates = new Set<string>();
    
    // 从每个哈希表收集候选
    for (let t = 0; t < this.numHashTables; t++) {
      const table = this.lshTables.get(t)!;
      const hash = this.computeLSHHash(queryVector, t);
      
      const bucket = table.get(hash);
      if (bucket) {
        for (const nodeId of bucket.members) {
          candidates.add(nodeId);
        }
      }
    }

    // 精确计算候选的相似度
    const results: QueryResult[] = [];
    
    for (const nodeId of candidates) {
      const node = this.graph.getNode(nodeId);
      if (node) {
        const nodeVector = this.hdc.getSymbolVector(node.label);
        const sim = this.hdc.similarity(queryVector, nodeVector);
        
        results.push({
          nodeId,
          similarity: sim.similarity,
          karma: node.karma,
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, topK);
  }

  /**
   * 按标签搜索（结合LSH加速）
   */
  searchByLabel(queryLabel: string, topK: number = 10): QueryResult[] {
    const queryVector = this.hdc.getSymbolVector(queryLabel);
    return this.approximateNearestNeighbors(queryVector, topK);
  }

  /**
   * 获取缓冲区状态
   */
  getBufferStatus(): {
    currentSize: number;
    capacity: number;
    utilizationPercent: number;
    oldestEntryAge: number; // ms
  } {
    const oldestAge = this.karmaBuffer.length > 0 
      ? Date.now() - this.karmaBuffer[0].timestamp 
      : 0;

    return {
      currentSize: this.karmaBuffer.length,
      capacity: this.bufferCapacity,
      utilizationPercent: (this.karmaBuffer.length / this.bufferCapacity) * 100,
      oldestEntryAge: oldestAge,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): UpdateStats {
    return {
      bufferedUpdates: this.karmaBuffer.length,
      flushedUpdates: this.flushCount,
      avgFlushLatency: this.flushCount > 0 ? this.totalFlushLatency / this.flushCount : 0,
      indexRebuildCount: this.indexRebuildCount,
    };
  }

  /**
   * 获取LSH索引统计
   */
  getLSHStats(): {
    numTables: number;
    totalBuckets: number;
    avgBucketSize: number;
    maxBucketSize: number;
  } {
    let totalBuckets = 0;
    let totalMembers = 0;
    let maxBucketSize = 0;

    for (const table of this.lshTables.values()) {
      totalBuckets += table.size;
      
      for (const bucket of table.values()) {
        totalMembers += bucket.members.size;
        maxBucketSize = Math.max(maxBucketSize, bucket.members.size);
      }
    }

    return {
      numTables: this.numHashTables,
      totalBuckets,
      avgBucketSize: totalBuckets > 0 ? totalMembers / totalBuckets : 0,
      maxBucketSize,
    };
  }

  /**
   * 清空缓冲区（不刷新）
   */
  clearBuffer(): void {
    this.karmaBuffer = [];
  }

  /**
   * 强制刷新并关闭
   */
  close(): void {
    this.flush();
    this.stopAutoFlush();
  }

  /**
   * 导出缓冲内容（用于调试）
   */
  exportBuffer(): KarmaBufferEntry[] {
    return [...this.karmaBuffer];
  }
}

export default StreamingHashMemory;

