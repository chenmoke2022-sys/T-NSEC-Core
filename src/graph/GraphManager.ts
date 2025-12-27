/**
 * GraphManager - 知识图谱管理器
 * 
 * 基于SQLite的图谱存储，支持：
 * - 节点和边的CRUD操作
 * - Karma权重管理
 * - 子图检索
 * - 个性化PageRank检索
 */

import Database from 'better-sqlite3';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  karma: number;
  embedding?: Float32Array;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
  karma: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SubgraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  queryTime: number;
}

export interface PPRResult {
  nodeId: string;
  score: number;
  node: GraphNode;
}

export class GraphManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = './data/graph.db') {
    this.dbPath = dbPath;
    
    // 确保目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  /**
   * 兼容旧接口：显式初始化入口
   *
   * GraphManager 在构造函数中已完成 schema 初始化；此方法作为幂等 no-op，
   * 便于服务层统一 await 初始化流程。
   */
  async initialize(): Promise<void> {
    return;
  }

  /**
   * 初始化数据库Schema
   */
  private initSchema(): void {
    this.db.exec(`
      -- 节点表
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'concept',
        karma REAL NOT NULL DEFAULT 1.0,
        embedding BLOB,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- 边表
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        karma REAL NOT NULL DEFAULT 1.0,
        metadata TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      -- 索引
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_karma ON nodes(karma);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);
      CREATE INDEX IF NOT EXISTS idx_edges_karma ON edges(karma);
    `);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============ 节点操作 ============

  /**
   * 添加节点
   */
  addNode(node: Omit<GraphNode, 'id' | 'createdAt' | 'updatedAt'>): GraphNode {
    const now = Date.now();
    const id = this.generateId();
    
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, label, type, karma, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      node.label,
      node.type || 'concept',
      node.karma ?? 1.0,
      node.embedding
        ? Buffer.from(node.embedding.buffer, node.embedding.byteOffset, node.embedding.byteLength)
        : null,
      node.metadata ? JSON.stringify(node.metadata) : null,
      now,
      now
    );

    return {
      id,
      label: node.label,
      type: node.type || 'concept',
      karma: node.karma ?? 1.0,
      embedding: node.embedding,
      metadata: node.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 获取节点
   */
  getNode(id: string): GraphNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return this.rowToNode(row);
  }

  /**
   * 通过标签获取节点
   */
  getNodeByLabel(label: string): GraphNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE label = ?');
    const row = stmt.get(label) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return this.rowToNode(row);
  }

  /**
   * 更新节点
   */
  updateNode(id: string, updates: Partial<Pick<GraphNode, 'label' | 'type' | 'karma' | 'metadata'>>): boolean {
    const parts: string[] = [];
    const values: unknown[] = [];

    if (updates.label !== undefined) {
      parts.push('label = ?');
      values.push(updates.label);
    }
    if (updates.type !== undefined) {
      parts.push('type = ?');
      values.push(updates.type);
    }
    if (updates.karma !== undefined) {
      parts.push('karma = ?');
      values.push(updates.karma);
    }
    if (updates.metadata !== undefined) {
      parts.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (parts.length === 0) return false;

    parts.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE nodes SET ${parts.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    
    return result.changes > 0;
  }

  /**
   * 删除节点
   */
  deleteNode(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 获取所有节点
   */
  getAllNodes(limit: number = 1000, offset: number = 0): GraphNode[] {
    const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY karma DESC LIMIT ? OFFSET ?');
    const rows = stmt.all(limit, offset) as Record<string, unknown>[];
    return rows.map(row => this.rowToNode(row));
  }

  /**
   * 按类型获取节点
   */
  getNodesByType(type: string): GraphNode[] {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE type = ? ORDER BY karma DESC');
    const rows = stmt.all(type) as Record<string, unknown>[];
    return rows.map(row => this.rowToNode(row));
  }

  // ============ 边操作 ============

  /**
   * 添加边
   */
  addEdge(edge: Omit<GraphEdge, 'id' | 'createdAt' | 'updatedAt'>): GraphEdge {
    const now = Date.now();
    const id = this.generateId();

    const stmt = this.db.prepare(`
      INSERT INTO edges (id, source_id, target_id, relation, weight, karma, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      edge.sourceId,
      edge.targetId,
      edge.relation,
      edge.weight ?? 1.0,
      edge.karma ?? 1.0,
      edge.metadata ? JSON.stringify(edge.metadata) : null,
      now,
      now
    );

    return {
      id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relation: edge.relation,
      weight: edge.weight ?? 1.0,
      karma: edge.karma ?? 1.0,
      metadata: edge.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 获取边
   */
  getEdge(id: string): GraphEdge | null {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return this.rowToEdge(row);
  }

  /**
   * 获取节点的出边
   */
  getOutEdges(nodeId: string): GraphEdge[] {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE source_id = ? ORDER BY karma DESC');
    const rows = stmt.all(nodeId) as Record<string, unknown>[];
    return rows.map(row => this.rowToEdge(row));
  }

  /**
   * 获取节点的入边
   */
  getInEdges(nodeId: string): GraphEdge[] {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE target_id = ? ORDER BY karma DESC');
    const rows = stmt.all(nodeId) as Record<string, unknown>[];
    return rows.map(row => this.rowToEdge(row));
  }

  /**
   * 更新边的Karma
   */
  updateEdgeKarma(id: string, karma: number): boolean {
    const stmt = this.db.prepare('UPDATE edges SET karma = ?, updated_at = ? WHERE id = ?');
    const result = stmt.run(karma, Date.now(), id);
    return result.changes > 0;
  }

  /**
   * 删除边
   */
  deleteEdge(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM edges WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ============ 图查询操作 ============

  /**
   * 获取子图（从种子节点出发的N跳邻居）
   */
  getSubgraph(seedNodeIds: string[], hops: number = 2): SubgraphResult {
    const startTime = performance.now();
    
    const visitedNodes = new Set<string>(seedNodeIds);
    const allEdges: GraphEdge[] = [];
    
    let currentLayer = seedNodeIds;

    for (let h = 0; h < hops; h++) {
      const nextLayer: string[] = [];
      
      for (const nodeId of currentLayer) {
        const outEdges = this.getOutEdges(nodeId);
        const inEdges = this.getInEdges(nodeId);
        
        for (const edge of [...outEdges, ...inEdges]) {
          allEdges.push(edge);
          
          const neighbor = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
          if (!visitedNodes.has(neighbor)) {
            visitedNodes.add(neighbor);
            nextLayer.push(neighbor);
          }
        }
      }
      
      currentLayer = nextLayer;
    }

    // 获取所有访问过的节点
    const nodes: GraphNode[] = [];
    for (const nodeId of visitedNodes) {
      const node = this.getNode(nodeId);
      if (node) nodes.push(node);
    }

    // 去重边
    const edgeMap = new Map<string, GraphEdge>();
    for (const edge of allEdges) {
      edgeMap.set(edge.id, edge);
    }

    return {
      nodes,
      edges: Array.from(edgeMap.values()),
      queryTime: performance.now() - startTime,
    };
  }

  /**
   * Karma加权的个性化PageRank
   */
  personalizedPageRank(
    seedNodeIds: string[],
    options: {
      alpha?: number;      // 重启概率
      iterations?: number; // 迭代次数
      topK?: number;       // 返回Top K
    } = {}
  ): PPRResult[] {
    const startTime = performance.now();
    
    const alpha = options.alpha ?? 0.15;
    const iterations = options.iterations ?? 20;
    const topK = options.topK ?? 10;

    // 获取所有节点
    const allNodes = this.getAllNodes(10000);
    const nodeMap = new Map<string, GraphNode>();
    for (const node of allNodes) {
      nodeMap.set(node.id, node);
    }

    // 初始化PPR分数
    const scores = new Map<string, number>();
    const seedSet = new Set(seedNodeIds);
    
    for (const node of allNodes) {
      scores.set(node.id, seedSet.has(node.id) ? 1.0 / seedNodeIds.length : 0);
    }

    // 迭代计算
    for (let iter = 0; iter < iterations; iter++) {
      const newScores = new Map<string, number>();
      
      // 初始化为重启分数
      for (const node of allNodes) {
        newScores.set(
          node.id, 
          seedSet.has(node.id) ? alpha / seedNodeIds.length : 0
        );
      }

      // 传播分数
      for (const node of allNodes) {
        const outEdges = this.getOutEdges(node.id);
        if (outEdges.length === 0) continue;

        const currentScore = scores.get(node.id) || 0;
        const totalWeight = outEdges.reduce((sum, e) => sum + e.karma * e.weight, 0);

        for (const edge of outEdges) {
          const contrib = (1 - alpha) * currentScore * (edge.karma * edge.weight / totalWeight);
          const targetScore = newScores.get(edge.targetId) || 0;
          newScores.set(edge.targetId, targetScore + contrib);
        }
      }

      // 更新分数
      for (const [nodeId, score] of newScores) {
        scores.set(nodeId, score);
      }
    }

    // 排序并返回TopK
    const results: PPRResult[] = [];
    for (const [nodeId, score] of scores) {
      const node = nodeMap.get(nodeId);
      if (node && score > 0) {
        results.push({ nodeId, score, node });
      }
    }

    results.sort((a, b) => b.score - a.score);
    
    console.log(`PPR computed in ${(performance.now() - startTime).toFixed(2)}ms`);
    
    return results.slice(0, topK);
  }

  // ============ 统计与维护 ============

  /**
   * 获取图谱统计信息
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    avgKarma: number;
    nodeTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  } {
    const nodeCount = (this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as {count: number}).count;
    const edgeCount = (this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as {count: number}).count;
    
    const avgKarmaResult = this.db.prepare('SELECT AVG(karma) as avg FROM nodes').get() as {avg: number | null};
    const avgKarma = avgKarmaResult.avg || 0;

    // 节点类型统计
    const nodeTypeRows = this.db.prepare('SELECT type, COUNT(*) as count FROM nodes GROUP BY type').all() as {type: string; count: number}[];
    const nodeTypes: Record<string, number> = {};
    for (const row of nodeTypeRows) {
      nodeTypes[row.type] = row.count;
    }

    // 关系类型统计
    const relationRows = this.db.prepare('SELECT relation, COUNT(*) as count FROM edges GROUP BY relation').all() as {relation: string; count: number}[];
    const relationTypes: Record<string, number> = {};
    for (const row of relationRows) {
      relationTypes[row.relation] = row.count;
    }

    return { nodeCount, edgeCount, avgKarma, nodeTypes, relationTypes };
  }

  /**
   * 计算图的模块度（用于评估聚类质量）
   */
  calculateModularity(): number {
    const stats = this.getStats();
    if (stats.edgeCount === 0) return 0;

    // 简化版模块度计算
    // Q = (1/2m) * Σ(A_ij - k_i*k_j/2m) * δ(c_i, c_j)
    // 这里使用节点类型作为社区划分

    const m = stats.edgeCount;
    const nodes = this.getAllNodes(10000);
    const nodeTypeMap = new Map<string, string>();
    const degreeMap = new Map<string, number>();

    for (const node of nodes) {
      nodeTypeMap.set(node.id, node.type);
      const degree = this.getOutEdges(node.id).length + this.getInEdges(node.id).length;
      degreeMap.set(node.id, degree);
    }

    let Q = 0;
    const edges = this.db.prepare('SELECT * FROM edges').all() as Record<string, unknown>[];

    for (const edgeRow of edges) {
      const edge = this.rowToEdge(edgeRow);
      const ki = degreeMap.get(edge.sourceId) || 0;
      const kj = degreeMap.get(edge.targetId) || 0;
      const ci = nodeTypeMap.get(edge.sourceId);
      const cj = nodeTypeMap.get(edge.targetId);

      if (ci === cj) {
        Q += 1 - (ki * kj) / (2 * m);
      }
    }

    return Q / (2 * m);
  }

  /**
   * 批量更新Karma（用于衰减）
   */
  batchUpdateKarma(updates: Array<{id: string; karma: number}>): number {
    const stmt = this.db.prepare('UPDATE nodes SET karma = ?, updated_at = ? WHERE id = ?');
    const now = Date.now();
    
    const transaction = this.db.transaction((updates: Array<{id: string; karma: number}>) => {
      let count = 0;
      for (const update of updates) {
        const result = stmt.run(update.karma, now, update.id);
        count += result.changes;
      }
      return count;
    });

    return transaction(updates);
  }

  /**
   * 删除低Karma节点（遗忘机制）
   */
  pruneByKarma(threshold: number): number {
    const stmt = this.db.prepare('DELETE FROM nodes WHERE karma < ?');
    const result = stmt.run(threshold);
    return result.changes;
  }

  /**
   * 使用 HDC 向量进行相似度搜索
   */
  async searchByHDC(queryVector: Float32Array, topK: number = 10): Promise<Array<{ node: GraphNode; similarity: number }>> {
    const startTime = performance.now();
    
    // 获取所有节点
    const nodes = this.getAllNodes();
    
    // 计算相似度
    const results = nodes
      .filter(node => node.embedding) // 只处理有 embedding 的节点
      .map(node => {
        const similarity = this.hammingSimilarity(queryVector, node.embedding!);
        return { node, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity) // 按相似度降序
      .slice(0, topK);

    const queryTime = performance.now() - startTime;
    console.log(`[GraphManager] HDC 搜索完成: ${results.length} 个结果, ${queryTime.toFixed(2)}ms`);

    return results;
  }

  /**
   * 计算两个 HDC 向量的汉明相似度
   */
  private hammingSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

    let matches = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) {
        matches++;
      }
    }

    return matches / a.length;
  }

  // ============ 辅助方法 ============

  private rowToNode(row: Record<string, unknown>): GraphNode {
    let embedding: Float32Array | undefined = undefined;
    if (row.embedding) {
      const raw = row.embedding as unknown;
      // better-sqlite3 returns Buffer for BLOB columns
      if (Buffer.isBuffer(raw)) {
        const buf = raw as Buffer;
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        embedding = new Float32Array(ab);
      } else if (raw instanceof ArrayBuffer) {
        embedding = new Float32Array(raw);
      } else if (ArrayBuffer.isView(raw)) {
        const view = raw as ArrayBufferView;
        const ab = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        embedding = new Float32Array(ab);
      }
    }

    return {
      id: row.id as string,
      label: row.label as string,
      type: row.type as string,
      karma: row.karma as number,
      embedding,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private rowToEdge(row: Record<string, unknown>): GraphEdge {
    return {
      id: row.id as string,
      sourceId: row.source_id as string,
      targetId: row.target_id as string,
      relation: row.relation as string,
      weight: row.weight as number,
      karma: row.karma as number,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }

  /**
   * 清空数据库
   */
  clear(): void {
    this.db.exec('DELETE FROM edges');
    this.db.exec('DELETE FROM nodes');
  }
}

export default GraphManager;

