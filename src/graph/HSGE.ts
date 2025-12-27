/**
 * H-SGE: Holographic Sparse Graph Encoding
 * 全息稀疏图编码模块
 * 
 * 结合HDC超维计算实现O(1)时间复杂度的结构相似性匹配
 * 
 * 核心功能：
 * - 将图结构编码为超维向量
 * - 支持跨域类比查询
 * - 元概念层抽象
 */

import { performance } from 'perf_hooks';
import { HDCEngine, HyperVector, hdcEngine } from '../hdc/HDCEngine.js';
import { GraphManager, GraphNode, GraphEdge, SubgraphResult } from './GraphManager.js';

export interface StructuralSignature {
  id: string;
  vector: HyperVector;
  nodeCount: number;
  edgeCount: number;
  centerNodeId: string;
  metaConcepts: string[];
  encodingTime: number;
}

export interface AnalogyResult {
  queryId: string;
  matchId: string;
  similarity: number;
  sharedMetaConcepts: string[];
  mappings: Array<{sourceNode: string; targetNode: string; confidence: number}>;
  queryTime: number;
}

export interface MetaConcept {
  id: string;
  name: string;
  level: number;  // 抽象层级
  instances: string[];  // 实例节点ID列表
  signature: HyperVector;
}

export class HSGE {
  private hdc: HDCEngine;
  private graph: GraphManager;
  private signatureCache: Map<string, StructuralSignature> = new Map();
  private metaConcepts: Map<string, MetaConcept> = new Map();
  
  // 预定义的元关系模板
  private static readonly STRUCTURAL_PATTERNS = [
    'is_a_hierarchy',      // 层级结构
    'part_whole',          // 部分-整体
    'cause_effect',        // 因果链
    'temporal_sequence',   // 时序结构
    'similarity_cluster',  // 相似聚类
  ];

  constructor(graph: GraphManager, hdc: HDCEngine = hdcEngine) {
    this.graph = graph;
    this.hdc = hdc;
    this.initializePatternTemplates();
  }

  /**
   * 初始化结构模式模板
   */
  private initializePatternTemplates(): void {
    for (const pattern of HSGE.STRUCTURAL_PATTERNS) {
      this.metaConcepts.set(pattern, {
        id: pattern,
        name: pattern,
        level: 0,
        instances: [],
        signature: this.hdc.getSymbolVector(pattern),
      });
    }
  }

  /**
   * 编码节点的局部结构特征
   */
  encodeNodeStructure(nodeId: string, hops: number = 2): StructuralSignature {
    const startTime = performance.now();
    
    // 检查缓存
    const cacheKey = `${nodeId}:${hops}`;
    if (this.signatureCache.has(cacheKey)) {
      return this.signatureCache.get(cacheKey)!;
    }

    // 获取子图
    const subgraph = this.graph.getSubgraph([nodeId], hops);
    
    // 编码结构
    const tripleVectors: HyperVector[] = [];
    
    for (const edge of subgraph.edges) {
      const sourceNode = subgraph.nodes.find(n => n.id === edge.sourceId);
      const targetNode = subgraph.nodes.find(n => n.id === edge.targetId);
      
      if (sourceNode && targetNode) {
        // 使用节点类型和关系类型进行编码（抽象化具体标签）
        const result = this.hdc.encodeTriple(
          sourceNode.type,
          edge.relation,
          targetNode.type
        );
        tripleVectors.push(result.vector);
      }
    }

    // 叠加所有三元组向量
    const structureVector = tripleVectors.length > 0 
      ? this.hdc.bundle(tripleVectors)
      : this.hdc.generateRandomVector();

    // 识别元概念
    const metaConcepts = this.identifyMetaConcepts(subgraph);

    const signature: StructuralSignature = {
      id: cacheKey,
      vector: structureVector,
      nodeCount: subgraph.nodes.length,
      edgeCount: subgraph.edges.length,
      centerNodeId: nodeId,
      metaConcepts,
      encodingTime: performance.now() - startTime,
    };

    this.signatureCache.set(cacheKey, signature);
    return signature;
  }

  /**
   * 识别子图中的元概念
   */
  private identifyMetaConcepts(subgraph: SubgraphResult): string[] {
    const concepts: string[] = [];
    
    // 检测层级结构（is_a关系）
    const isAEdges = subgraph.edges.filter(e => e.relation === 'is_a');
    if (isAEdges.length > 2) {
      concepts.push('is_a_hierarchy');
    }

    // 检测部分-整体结构
    const partOfEdges = subgraph.edges.filter(e => 
      e.relation === 'part_of' || e.relation === 'has_a'
    );
    if (partOfEdges.length > 0) {
      concepts.push('part_whole');
    }

    // 检测因果链
    const causeEdges = subgraph.edges.filter(e => e.relation === 'causes');
    if (causeEdges.length > 0) {
      concepts.push('cause_effect');
    }

    // 检测时序结构
    const temporalEdges = subgraph.edges.filter(e => 
      e.relation.startsWith('temporal_')
    );
    if (temporalEdges.length > 0) {
      concepts.push('temporal_sequence');
    }

    // 检测相似聚类
    const similarEdges = subgraph.edges.filter(e => e.relation === 'similar_to');
    if (similarEdges.length > 2) {
      concepts.push('similarity_cluster');
    }

    return concepts;
  }

  /**
   * 查找结构相似的节点（类比查询）
   */
  findAnalogous(
    queryNodeId: string,
    topK: number = 5,
    minSimilarity: number = 0.3
  ): AnalogyResult[] {
    const startTime = performance.now();
    
    // 编码查询节点
    const querySignature = this.encodeNodeStructure(queryNodeId);
    
    // 获取所有节点的签名
    const allNodes = this.graph.getAllNodes(1000);
    const candidates: Array<{nodeId: string; signature: StructuralSignature}> = [];
    
    for (const node of allNodes) {
      if (node.id !== queryNodeId) {
        const sig = this.encodeNodeStructure(node.id);
        candidates.push({ nodeId: node.id, signature: sig });
      }
    }

    // 计算相似度
    const results: AnalogyResult[] = [];
    
    for (const candidate of candidates) {
      const simResult = this.hdc.similarity(querySignature.vector, candidate.signature.vector);
      
      if (simResult.similarity >= minSimilarity) {
        // 计算共享元概念
        const sharedMeta = querySignature.metaConcepts.filter(
          m => candidate.signature.metaConcepts.includes(m)
        );

        // 推断节点映射（简化版本）
        const mappings = this.inferMappings(queryNodeId, candidate.nodeId);

        results.push({
          queryId: queryNodeId,
          matchId: candidate.nodeId,
          similarity: simResult.similarity,
          sharedMetaConcepts: sharedMeta,
          mappings,
          queryTime: simResult.computeTime,
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    const finalResults = results.slice(0, topK);
    const totalTime = performance.now() - startTime;
    
    // 更新查询时间
    for (const r of finalResults) {
      r.queryTime = totalTime / finalResults.length;
    }

    return finalResults;
  }

  /**
   * 推断节点映射（用于类比迁移）
   */
  private inferMappings(
    sourceNodeId: string,
    targetNodeId: string
  ): Array<{sourceNode: string; targetNode: string; confidence: number}> {
    const mappings: Array<{sourceNode: string; targetNode: string; confidence: number}> = [];
    
    const sourceSubgraph = this.graph.getSubgraph([sourceNodeId], 1);
    const targetSubgraph = this.graph.getSubgraph([targetNodeId], 1);

    // 按类型匹配节点
    for (const sourceNode of sourceSubgraph.nodes) {
      const candidates = targetSubgraph.nodes.filter(n => n.type === sourceNode.type);
      
      if (candidates.length > 0) {
        // 选择Karma最高的候选
        candidates.sort((a, b) => b.karma - a.karma);
        mappings.push({
          sourceNode: sourceNode.id,
          targetNode: candidates[0].id,
          confidence: 0.5 + candidates[0].karma * 0.5,
        });
      }
    }

    return mappings;
  }

  /**
   * 批量编码图谱中的所有节点
   */
  encodeAllNodes(hops: number = 2): Map<string, StructuralSignature> {
    const startTime = performance.now();
    const nodes = this.graph.getAllNodes(10000);
    
    console.log(`⏳ 开始编码 ${nodes.length} 个节点...`);
    
    for (const node of nodes) {
      this.encodeNodeStructure(node.id, hops);
    }

    console.log(`[HSGE] Encoding complete (${(performance.now() - startTime).toFixed(2)}ms)`);
    
    return this.signatureCache;
  }

  /**
   * 基于HDC的快速相似性搜索
   */
  fastSearch(
    queryVector: HyperVector,
    topK: number = 10
  ): Array<{id: string; similarity: number}> {
    const results: Array<{id: string; similarity: number}> = [];
    
    for (const [id, signature] of this.signatureCache) {
      const sim = this.hdc.similarity(queryVector, signature.vector);
      results.push({ id, similarity: sim.similarity });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * 创建跨域类比查询
   * 给定源域和目标域，找到结构对应关系
   */
  crossDomainAnalogy(
    sourceDomainNodes: string[],
    targetDomainNodes: string[]
  ): Array<{source: string; target: string; similarity: number}> {
    const results: Array<{source: string; target: string; similarity: number}> = [];

    // 编码源域
    const sourceSignatures = sourceDomainNodes.map(id => ({
      id,
      sig: this.encodeNodeStructure(id),
    }));

    // 编码目标域
    const targetSignatures = targetDomainNodes.map(id => ({
      id,
      sig: this.encodeNodeStructure(id),
    }));

    // 寻找最佳映射
    for (const source of sourceSignatures) {
      let bestMatch = { target: '', similarity: 0 };
      
      for (const target of targetSignatures) {
        const sim = this.hdc.similarity(source.sig.vector, target.sig.vector);
        if (sim.similarity > bestMatch.similarity) {
          bestMatch = { target: target.id, similarity: sim.similarity };
        }
      }

      if (bestMatch.target) {
        results.push({
          source: source.id,
          target: bestMatch.target,
          similarity: bestMatch.similarity,
        });
      }
    }

    return results;
  }

  /**
   * 增量更新签名（当图发生变化时）
   */
  updateSignature(nodeId: string): void {
    // 清除相关缓存
    const keysToDelete: string[] = [];
    for (const key of this.signatureCache.keys()) {
      if (key.startsWith(`${nodeId}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.signatureCache.delete(key);
    }

    // 重新编码
    this.encodeNodeStructure(nodeId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    cachedSignatures: number;
    metaConceptCount: number;
    avgEncodingTime: number;
    avgNodeCount: number;
  } {
    let totalEncodingTime = 0;
    let totalNodeCount = 0;

    for (const sig of this.signatureCache.values()) {
      totalEncodingTime += sig.encodingTime;
      totalNodeCount += sig.nodeCount;
    }

    const count = this.signatureCache.size;

    return {
      cachedSignatures: count,
      metaConceptCount: this.metaConcepts.size,
      avgEncodingTime: count > 0 ? totalEncodingTime / count : 0,
      avgNodeCount: count > 0 ? totalNodeCount / count : 0,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.signatureCache.clear();
  }

  /**
   * 评估类比质量（用于验证）
   */
  evaluateAnalogyQuality(
    groundTruth: Array<{source: string; target: string}>,
    predictions: Array<{source: string; target: string}>
  ): { precision: number; recall: number; f1: number } {
    const truthSet = new Set(groundTruth.map(t => `${t.source}:${t.target}`));
    const predSet = new Set(predictions.map(p => `${p.source}:${p.target}`));

    let hits = 0;
    for (const pred of predSet) {
      if (truthSet.has(pred)) hits++;
    }

    const precision = predictions.length > 0 ? hits / predictions.length : 0;
    const recall = groundTruth.length > 0 ? hits / groundTruth.length : 0;
    const f1 = precision + recall > 0 
      ? 2 * precision * recall / (precision + recall) 
      : 0;

    return { precision, recall, f1 };
  }
}

export default HSGE;

