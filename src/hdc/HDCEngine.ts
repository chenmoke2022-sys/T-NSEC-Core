/**
 * HDCEngine - 超维计算引擎
 * 
 * 基于超维计算（Hyperdimensional Computing / Vector Symbolic Architecture）的核心实现
 * 
 * 核心操作：
 * - Binding (绑定): 使用XOR操作关联两个概念
 * - Bundling (叠加): 使用多数投票合并多个向量
 * - Similarity (相似度): 使用Hamming距离计算相似度
 * 
 * 特点：
 * - 固定维度（10000维）的二进制超向量
 * - O(1)时间复杂度的相似度计算
 * - 支持可复现的随机种子
 */

import { performance } from 'perf_hooks';
import * as crypto from 'crypto';

export type HyperVector = Uint8Array;

export interface EncodingResult {
  vector: HyperVector;
  encodingTime: number;
}

export interface SimilarityResult {
  similarity: number;
  hammingDistance: number;
  computeTime: number;
}

export interface BindingSpec {
  relation: string;
  source: string;
  target: string;
}

export class HDCEngine {
  readonly dimensions: number;
  private seed: number;
  private symbolCodebook: Map<string, HyperVector> = new Map();
  private relationCodebook: Map<string, HyperVector> = new Map();
  
  // 预定义的元关系类型
  private static readonly META_RELATIONS = [
    'is_a', 'has_a', 'part_of', 'related_to', 'causes',
    'depends_on', 'similar_to', 'opposite_of', 'instance_of', 'type_of',
    'temporal_before', 'temporal_after', 'spatial_near', 'contains', 'belongs_to'
  ];

  constructor(dimensions: number = 10000, seed: number = 42) {
    this.dimensions = dimensions;
    this.seed = seed;
    this.initializeMetaRelations();
  }

  /**
   * 兼容/便捷接口：将任意文本编码为一个符号向量
   *
   * 说明：这里的“编码”指把字符串映射到确定性的超向量（codebook），
   * 并返回耗时，方便在服务层/脚本中统一调用。
   */
  encode(text: string): EncodingResult {
    const startTime = performance.now();
    const vector = this.getSymbolVector(text);
    return {
      vector,
      encodingTime: performance.now() - startTime,
    };
  }

  /**
   * 初始化预定义的元关系超向量
   */
  private initializeMetaRelations(): void {
    for (const relation of HDCEngine.META_RELATIONS) {
      this.relationCodebook.set(relation, this.generateDeterministicVector(relation));
    }
  }

  /**
   * 生成确定性随机向量（基于种子和名称）
   */
  private generateDeterministicVector(name: string): HyperVector {
    const hash = crypto.createHash('sha256')
      .update(`${this.seed}:${name}`)
      .digest();
    
    const vector = new Uint8Array(Math.ceil(this.dimensions / 8));
    
    // 使用hash扩展生成足够的随机位
    let hashIndex = 0;
    for (let i = 0; i < vector.length; i++) {
      if (hashIndex >= hash.length) {
        // 重新生成hash
        const newHash = crypto.createHash('sha256')
          .update(hash)
          .update(Buffer.from([i]))
          .digest();
        for (let j = 0; j < newHash.length && i + j < vector.length; j++) {
          vector[i + j] = newHash[j];
        }
        hashIndex = 0;
      } else {
        vector[i] = hash[hashIndex++];
      }
    }
    
    return vector;
  }

  /**
   * 生成随机超向量
   */
  generateRandomVector(): HyperVector {
    const vector = new Uint8Array(Math.ceil(this.dimensions / 8));
    crypto.randomFillSync(vector);
    return vector;
  }

  /**
   * 获取或创建符号的超向量表示
   */
  getSymbolVector(symbol: string): HyperVector {
    if (!this.symbolCodebook.has(symbol)) {
      this.symbolCodebook.set(symbol, this.generateDeterministicVector(symbol));
    }
    return this.symbolCodebook.get(symbol)!;
  }

  /**
   * 获取关系超向量
   */
  getRelationVector(relation: string): HyperVector {
    if (!this.relationCodebook.has(relation)) {
      this.relationCodebook.set(relation, this.generateDeterministicVector(`rel:${relation}`));
    }
    return this.relationCodebook.get(relation)!;
  }

  /**
   * 绑定操作（XOR）- 将两个向量关联
   * 用于创建"关系(A,B)"的组合表示
   */
  bind(a: HyperVector, b: HyperVector): HyperVector {
    const result = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  }

  /**
   * 叠加操作（多数投票）- 合并多个向量
   * 用于创建集合或概念的复合表示
   */
  bundle(vectors: HyperVector[]): HyperVector {
    if (vectors.length === 0) {
      return new Uint8Array(Math.ceil(this.dimensions / 8));
    }
    
    if (vectors.length === 1) {
      return new Uint8Array(vectors[0]);
    }

    const bitCounts = new Uint16Array(this.dimensions);
    
    // 统计每个位置的1的数量
    for (const vector of vectors) {
      for (let byteIdx = 0; byteIdx < vector.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const dimIdx = byteIdx * 8 + bitIdx;
          if (dimIdx < this.dimensions) {
            if ((vector[byteIdx] & (1 << bitIdx)) !== 0) {
              bitCounts[dimIdx]++;
            }
          }
        }
      }
    }

    // 多数投票
    const threshold = vectors.length / 2;
    const result = new Uint8Array(Math.ceil(this.dimensions / 8));
    
    for (let dimIdx = 0; dimIdx < this.dimensions; dimIdx++) {
      if (bitCounts[dimIdx] > threshold || 
          (bitCounts[dimIdx] === threshold && Math.random() > 0.5)) {
        const byteIdx = Math.floor(dimIdx / 8);
        const bitIdx = dimIdx % 8;
        result[byteIdx] |= (1 << bitIdx);
      }
    }
    
    return result;
  }

  /**
   * 置换操作 - 用于表示顺序/位置信息
   */
  permute(vector: HyperVector, shift: number = 1): HyperVector {
    const result = new Uint8Array(vector.length);
    const totalBits = this.dimensions;
    
    for (let i = 0; i < totalBits; i++) {
      const sourceIdx = (i + shift + totalBits) % totalBits;
      const sourceByte = Math.floor(sourceIdx / 8);
      const sourceBit = sourceIdx % 8;
      const destByte = Math.floor(i / 8);
      const destBit = i % 8;
      
      if ((vector[sourceByte] & (1 << sourceBit)) !== 0) {
        result[destByte] |= (1 << destBit);
      }
    }
    
    return result;
  }

  /**
   * 计算Hamming距离
   */
  hammingDistance(a: HyperVector, b: HyperVector): number {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      let xor = a[i] ^ b[i];
      // 计算popcount
      while (xor) {
        distance += xor & 1;
        xor >>>= 1;
      }
    }
    return distance;
  }

  /**
   * 计算余弦相似度（基于Hamming距离）
   * 返回值范围：[0, 1]，1表示完全相同
   */
  similarity(a: HyperVector, b: HyperVector): SimilarityResult {
    const startTime = performance.now();
    const distance = this.hammingDistance(a, b);
    const similarity = 1 - (distance / this.dimensions);
    const computeTime = performance.now() - startTime;
    
    return {
      similarity,
      hammingDistance: distance,
      computeTime,
    };
  }

  /**
   * 编码三元组关系 (source, relation, target)
   */
  encodeTriple(source: string, relation: string, target: string): EncodingResult {
    const startTime = performance.now();
    
    const sourceVec = this.getSymbolVector(source);
    const relationVec = this.getRelationVector(relation);
    const targetVec = this.getSymbolVector(target);
    
    // 编码方案: bind(relation, bind(source, target))
    const pairVec = this.bind(sourceVec, targetVec);
    const vector = this.bind(relationVec, pairVec);
    
    return {
      vector,
      encodingTime: performance.now() - startTime,
    };
  }

  /**
   * 编码图结构为超向量
   * 将多个三元组叠加成单一向量
   */
  encodeGraph(triples: BindingSpec[]): EncodingResult {
    const startTime = performance.now();
    
    const tripleVectors = triples.map(t => 
      this.encodeTriple(t.source, t.relation, t.target).vector
    );
    
    const vector = this.bundle(tripleVectors);
    
    return {
      vector,
      encodingTime: performance.now() - startTime,
    };
  }

  /**
   * 解绑操作 - 从组合向量中恢复成分
   * 由于XOR的自反性：a XOR a = 0，所以 bind(a, bind(a, b)) = b
   */
  unbind(combined: HyperVector, key: HyperVector): HyperVector {
    return this.bind(combined, key);
  }

  /**
   * 查询：给定关系和目标，查找可能的源
   */
  querySource(
    graphVector: HyperVector,
    relation: string,
    target: string
  ): HyperVector {
    const relationVec = this.getRelationVector(relation);
    const targetVec = this.getSymbolVector(target);
    
    // 反向解绑
    const pairVec = this.unbind(graphVector, relationVec);
    const sourceVec = this.unbind(pairVec, targetVec);
    
    return sourceVec;
  }

  /**
   * 在码本中查找最相似的符号
   */
  findMostSimilar(queryVector: HyperVector, topK: number = 5): Array<{symbol: string; similarity: number}> {
    const results: Array<{symbol: string; similarity: number}> = [];
    
    for (const [symbol, vector] of this.symbolCodebook) {
      const sim = this.similarity(queryVector, vector);
      results.push({ symbol, similarity: sim.similarity });
    }
    
    // 按相似度降序排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, topK);
  }

  /**
   * 批量计算相似度
   */
  batchSimilarity(query: HyperVector, candidates: HyperVector[]): SimilarityResult[] {
    return candidates.map(c => this.similarity(query, c));
  }

  /**
   * 向量归一化（用于叠加后的清理）
   */
  normalize(vector: HyperVector): HyperVector {
    // 对于二进制向量，归一化就是保持原样
    return new Uint8Array(vector);
  }

  /**
   * 获取向量的稀疏度（1的比例）
   */
  getSparsity(vector: HyperVector): number {
    let ones = 0;
    for (let i = 0; i < vector.length; i++) {
      let byte = vector[i];
      while (byte) {
        ones += byte & 1;
        byte >>>= 1;
      }
    }
    return ones / this.dimensions;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    dimensions: number;
    symbolCount: number;
    relationCount: number;
    seed: number;
  } {
    return {
      dimensions: this.dimensions,
      symbolCount: this.symbolCodebook.size,
      relationCount: this.relationCodebook.size,
      seed: this.seed,
    };
  }

  /**
   * 重置码本（保留元关系）
   */
  reset(): void {
    this.symbolCodebook.clear();
    this.relationCodebook.clear();
    this.initializeMetaRelations();
  }

  /**
   * 导出符号码本
   */
  exportCodebook(): Map<string, HyperVector> {
    return new Map(this.symbolCodebook);
  }

  /**
   * 导入符号码本
   */
  importCodebook(codebook: Map<string, HyperVector>): void {
    for (const [symbol, vector] of codebook) {
      this.symbolCodebook.set(symbol, vector);
    }
  }

  /**
   * 类比映射 (Analogical Mapping)
   * 
   * 给定 source -> target 的映射，将 query 映射到新的向量
   * 公式: result = target + (query - source)
   * 在 HDC 中，使用 XOR 和叠加操作实现
   */
  analogicalMapping(
    sourceVector: HyperVector | Float32Array,
    targetVector: HyperVector | Float32Array,
    queryVector: HyperVector | Float32Array
  ): Float32Array {
    // 转换为 Float32Array 以便进行数值运算
    const source = sourceVector instanceof Float32Array 
      ? sourceVector 
      : new Float32Array(Array.from(sourceVector).map(b => b ? 1 : -1));
    
    const target = targetVector instanceof Float32Array 
      ? targetVector 
      : new Float32Array(Array.from(targetVector).map(b => b ? 1 : -1));
    
    const query = queryVector instanceof Float32Array 
      ? queryVector 
      : new Float32Array(Array.from(queryVector).map(b => b ? 1 : -1));

    // 计算差异向量: diff = query - source
    const diff = new Float32Array(source.length);
    for (let i = 0; i < source.length; i++) {
      diff[i] = query[i] - source[i];
    }

    // 应用映射: result = target + diff
    const result = new Float32Array(target.length);
    for (let i = 0; i < target.length; i++) {
      result[i] = target[i] + diff[i];
    }

    // 归一化到 [-1, 1] 范围
    const max = Math.max(...Array.from(result.map(Math.abs)));
    if (max > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] = result[i] / max;
      }
    }

    return result;
  }
}

// 默认实例
export const hdcEngine = new HDCEngine();

export default HDCEngine;

