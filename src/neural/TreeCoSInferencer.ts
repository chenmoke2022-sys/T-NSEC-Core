/**
 * TreeCoSInferencer - 树状一致性模拟推理器
 * 
 * 这是 TreeInferencer 的别名/包装，用于神经模块目录
 * 提供统一的接口用于对比测试
 */

import { TreeInferencer, CoSResult, MetacognitiveState } from '../inference/TreeInferencer.js';
import { LocalLLM } from '../llm/LocalLLM.js';
import { GraphManager } from '../graph/GraphManager.js';
import { HSGE } from '../graph/HSGE.js';

export { CoSResult, MetacognitiveState };

export interface TreeCoSConfig {
  numPaths?: number;
  maxDepth?: number;
  branchFactor?: number;
  confidenceThresholdHigh?: number;
  confidenceThresholdLow?: number;
}

/**
 * Tree-CoS 推理器包装类
 */
export class TreeCoSInferencer {
  private inferencer: TreeInferencer;

  constructor(
    llm: LocalLLM,
    graph: GraphManager,
    hsge: HSGE,
    config?: TreeCoSConfig
  ) {
    this.inferencer = new TreeInferencer(llm, graph, hsge, config);
  }

  /**
   * 执行树状一致性模拟推理
   */
  async infer(prompt: string): Promise<CoSResult> {
    return this.inferencer.runTreeCoS(prompt);
  }

  /**
   * 获取元认知状态
   */
  getMetacognitiveState(result: CoSResult): MetacognitiveState {
    return this.inferencer.getMetacognitiveState(result);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.inferencer.getStats();
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.inferencer.reset();
  }
}

export default TreeCoSInferencer;

