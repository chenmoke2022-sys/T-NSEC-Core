/**
 * DreamEngine - 夜间抽象引擎 (GGA: Graph-based Generative Abstraction)
 * 
 * 模拟睡眠期间的记忆巩固过程：
 * - 聚类相似概念
 * - 生成抽象概念节点
 * - 优化图结构（提升模块度）
 * - 清理噪声边
 */

import { performance } from 'perf_hooks';
import { GraphManager, GraphNode, GraphEdge } from '../graph/GraphManager.js';
import { HDCEngine, hdcEngine } from '../hdc/HDCEngine.js';
import { LocalLLM } from '../llm/LocalLLM.js';

export interface Cluster {
  id: string;
  centroid: string; // 中心节点ID
  members: string[];
  coherence: number; // 聚类内聚度
  label?: string;
}

export interface AbstractConcept {
  id: string;
  name: string;
  level: number;
  instances: string[];
  generatedAt: number;
}

export interface DreamResult {
  clustersFound: number;
  conceptsGenerated: number;
  edgesPruned: number;
  modularityBefore: number;
  modularityAfter: number;
  duration: number;
  newConcepts: AbstractConcept[];
}

export interface ConsolidationConfig {
  minClusterSize: number;
  maxClusters: number;
  coherenceThreshold: number;
  pruneEdgeThreshold: number;
  generateAbstractions: boolean;
}

export class DreamEngine {
  private graph: GraphManager;
  private hdc: HDCEngine;
  private llm: LocalLLM | null;
  
  private config: ConsolidationConfig;
  private generatedConcepts: AbstractConcept[] = [];

  constructor(
    graph: GraphManager,
    llm: LocalLLM | null = null,
    options: Partial<ConsolidationConfig> = {},
    hdc: HDCEngine = hdcEngine
  ) {
    this.graph = graph;
    this.hdc = hdc;
    this.llm = llm;
    
    this.config = {
      minClusterSize: options.minClusterSize ?? 3,
      maxClusters: options.maxClusters ?? 20,
      coherenceThreshold: options.coherenceThreshold ?? 0.5,
      pruneEdgeThreshold: options.pruneEdgeThreshold ?? 0.1,
      generateAbstractions: options.generateAbstractions ?? true,
    };
  }

  /**
   * 运行夜间巩固过程
   */
  async runConsolidation(): Promise<DreamResult> {
    const startTime = performance.now();
    console.log('\n[DreamEngine] Starting consolidation\n');

    // 记录初始状态
    const modularityBefore = this.graph.calculateModularity();
    console.log(`[DreamEngine] Initial modularity: ${modularityBefore.toFixed(4)}`);

    // 1. 聚类分析
    console.log('\n[DreamEngine] Running clustering analysis');
    const clusters = this.performClustering();
    console.log(`   发现 ${clusters.length} 个有效聚类`);

    // 2. 生成抽象概念
    let conceptsGenerated = 0;
    const newConcepts: AbstractConcept[] = [];
    
    if (this.config.generateAbstractions) {
      console.log('\n💡 生成抽象概念...');
      for (const cluster of clusters) {
        if (cluster.coherence >= this.config.coherenceThreshold) {
          const concept = await this.generateAbstractConcept(cluster);
          if (concept) {
            newConcepts.push(concept);
            conceptsGenerated++;
            console.log(`   ✨ 创建概念: ${concept.name}`);
          }
        }
      }
    }

    // 3. 剪枝低质量边
    console.log('\n✂️ 剪枝低质量边...');
    const edgesPruned = this.pruneWeakEdges();
    console.log(`   移除 ${edgesPruned} 条弱边`);

    // 4. 优化图结构
    console.log('\n🔧 优化图结构...');
    this.optimizeGraphStructure(clusters);

    // 记录最终状态
    const modularityAfter = this.graph.calculateModularity();
    console.log(`\n[DreamEngine] Final modularity: ${modularityAfter.toFixed(4)}`);
    console.log(`   模块度提升: ${((modularityAfter - modularityBefore) * 100).toFixed(2)}%`);

    const duration = performance.now() - startTime;
    console.log(`\n[DreamEngine] Consolidation complete (${(duration / 1000).toFixed(2)}s)\n`);

    return {
      clustersFound: clusters.length,
      conceptsGenerated,
      edgesPruned,
      modularityBefore,
      modularityAfter,
      duration,
      newConcepts,
    };
  }

  /**
   * 基于HDC相似度的聚类
   */
  private performClustering(): Cluster[] {
    const nodes = this.graph.getAllNodes(10000);
    if (nodes.length < this.config.minClusterSize) {
      return [];
    }

    // 计算节点间相似度矩阵（基于标签的HDC相似度）
    const nodeVectors = new Map<string, Float32Array>();
    for (const node of nodes) {
      const vec = this.hdc.getSymbolVector(node.label);
      // 转换为Float32Array用于计算
      const floatVec = new Float32Array(vec.length * 8);
      for (let i = 0; i < vec.length; i++) {
        for (let b = 0; b < 8; b++) {
          floatVec[i * 8 + b] = (vec[i] & (1 << b)) ? 1 : 0;
        }
      }
      nodeVectors.set(node.id, floatVec);
    }

    // 使用简单的贪婪聚类算法
    const clusters: Cluster[] = [];
    const assigned = new Set<string>();

    for (const node of nodes) {
      if (assigned.has(node.id)) continue;
      if (clusters.length >= this.config.maxClusters) break;

      // 创建新聚类
      const cluster: Cluster = {
        id: `cluster-${clusters.length}`,
        centroid: node.id,
        members: [node.id],
        coherence: 1.0,
      };
      assigned.add(node.id);

      // 寻找相似节点加入聚类
      const centroidVec = this.hdc.getSymbolVector(node.label);
      
      for (const other of nodes) {
        if (assigned.has(other.id)) continue;
        
        const otherVec = this.hdc.getSymbolVector(other.label);
        const sim = this.hdc.similarity(centroidVec, otherVec);
        
        if (sim.similarity > this.config.coherenceThreshold) {
          cluster.members.push(other.id);
          assigned.add(other.id);
        }
      }

      // 只保留足够大的聚类
      if (cluster.members.length >= this.config.minClusterSize) {
        cluster.coherence = this.calculateClusterCoherence(cluster);
        clusters.push(cluster);
      } else {
        // 取消分配
        for (const memberId of cluster.members) {
          assigned.delete(memberId);
        }
      }
    }

    return clusters;
  }

  /**
   * 计算聚类内聚度
   */
  private calculateClusterCoherence(cluster: Cluster): number {
    if (cluster.members.length < 2) return 1.0;

    let totalSim = 0;
    let pairs = 0;

    for (let i = 0; i < cluster.members.length; i++) {
      const nodeI = this.graph.getNode(cluster.members[i]);
      if (!nodeI) continue;
      
      const vecI = this.hdc.getSymbolVector(nodeI.label);

      for (let j = i + 1; j < cluster.members.length; j++) {
        const nodeJ = this.graph.getNode(cluster.members[j]);
        if (!nodeJ) continue;
        
        const vecJ = this.hdc.getSymbolVector(nodeJ.label);
        const sim = this.hdc.similarity(vecI, vecJ);
        
        totalSim += sim.similarity;
        pairs++;
      }
    }

    return pairs > 0 ? totalSim / pairs : 0;
  }

  /**
   * 生成抽象概念节点
   */
  private async generateAbstractConcept(cluster: Cluster): Promise<AbstractConcept | null> {
    // 收集成员标签
    const memberLabels: string[] = [];
    for (const memberId of cluster.members) {
      const node = this.graph.getNode(memberId);
      if (node) {
        memberLabels.push(node.label);
      }
    }

    if (memberLabels.length === 0) return null;

    // 生成抽象名称
    let conceptName: string;
    
    if (this.llm) {
      // 使用LLM生成抽象名称
      const prompt = `以下是一组相关概念：${memberLabels.join('、')}。
请用一个简洁的词或短语来概括这些概念的共同主题。只输出概括词，不要其他内容。`;
      
      const result = await this.llm.infer(prompt);
      conceptName = result.text.trim().split(/[\n。，]/)[0];
    } else {
      // 简单启发式：使用最短的共同前缀或最高频词
      conceptName = this.findCommonPattern(memberLabels);
    }

    // 创建抽象概念节点
    const conceptNode = this.graph.addNode({
      label: conceptName,
      type: 'abstract_concept',
      karma: 0.8, // 新概念初始Karma较高
      metadata: {
        level: 1,
        instances: cluster.members,
        generatedAt: Date.now(),
        coherence: cluster.coherence,
      },
    });

    // 创建到成员的边
    for (const memberId of cluster.members) {
      this.graph.addEdge({
        sourceId: memberId,
        targetId: conceptNode.id,
        relation: 'is_a',
        weight: cluster.coherence,
        karma: 0.7,
      });
    }

    const concept: AbstractConcept = {
      id: conceptNode.id,
      name: conceptName,
      level: 1,
      instances: cluster.members,
      generatedAt: Date.now(),
    };

    this.generatedConcepts.push(concept);
    
    return concept;
  }

  /**
   * 查找共同模式
   */
  private findCommonPattern(labels: string[]): string {
    if (labels.length === 0) return 'Unknown';
    if (labels.length === 1) return labels[0];

    // 尝试找共同前缀
    let prefix = labels[0];
    for (const label of labels.slice(1)) {
      while (!label.startsWith(prefix) && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
    }

    if (prefix.length >= 2) {
      return prefix + '类';
    }

    // 使用最短标签
    labels.sort((a, b) => a.length - b.length);
    return labels[0] + '等';
  }

  /**
   * 剪枝弱边
   */
  private pruneWeakEdges(): number {
    const stats = this.graph.getStats();
    let prunedCount = 0;

    // 获取所有边
    const nodes = this.graph.getAllNodes(10000);
    const edgesToDelete: string[] = [];

    for (const node of nodes) {
      const edges = this.graph.getOutEdges(node.id);
      
      for (const edge of edges) {
        // 低Karma边标记删除
        if (edge.karma < this.config.pruneEdgeThreshold) {
          edgesToDelete.push(edge.id);
        }
      }
    }

    // 删除标记的边
    for (const edgeId of edgesToDelete) {
      if (this.graph.deleteEdge(edgeId)) {
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * 优化图结构
   */
  private optimizeGraphStructure(clusters: Cluster[]): void {
    // 为同聚类内的节点增加similar_to边
    for (const cluster of clusters) {
      if (cluster.members.length < 2) continue;

      // 只为中心节点连接
      const centroid = cluster.centroid;
      
      for (const memberId of cluster.members) {
        if (memberId === centroid) continue;

        // 检查是否已存在边
        const existingEdges = this.graph.getOutEdges(centroid);
        const hasEdge = existingEdges.some(e => 
          e.targetId === memberId && e.relation === 'similar_to'
        );

        if (!hasEdge) {
          this.graph.addEdge({
            sourceId: centroid,
            targetId: memberId,
            relation: 'similar_to',
            weight: cluster.coherence,
            karma: 0.6,
          });
        }
      }
    }
  }

  /**
   * 获取生成的概念列表
   */
  getGeneratedConcepts(): AbstractConcept[] {
    return [...this.generatedConcepts];
  }

  /**
   * 获取概念层级统计
   */
  getConceptHierarchyStats(): {
    level: number;
    count: number;
    avgInstances: number;
  }[] {
    const levelMap = new Map<number, { count: number; totalInstances: number }>();

    for (const concept of this.generatedConcepts) {
      const existing = levelMap.get(concept.level) || { count: 0, totalInstances: 0 };
      existing.count++;
      existing.totalInstances += concept.instances.length;
      levelMap.set(concept.level, existing);
    }

    const result: { level: number; count: number; avgInstances: number }[] = [];
    for (const [level, stats] of levelMap) {
      result.push({
        level,
        count: stats.count,
        avgInstances: stats.totalInstances / stats.count,
      });
    }

    return result.sort((a, b) => a.level - b.level);
  }

  /**
   * 清除生成的概念记录
   */
  clearGeneratedConcepts(): void {
    this.generatedConcepts = [];
  }

  /**
   * 更新配置
   */
  updateConfig(options: Partial<ConsolidationConfig>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ConsolidationConfig {
    return { ...this.config };
  }
}

export default DreamEngine;

