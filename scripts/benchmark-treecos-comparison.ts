/**
 * Tree-CoS vs CoS-MoE 对比测试脚本
 *
 * Public baseline (no private workflow files):
 * - Runs Tree-CoS simulation using the built-in LocalLLM + Graph/HSGE stack.
 * - Prints measurable outputs (latency/speedup/consensus).
 */

import { LocalLLM } from '../src/llm/LocalLLM.js';
import { GraphManager } from '../src/graph/GraphManager.js';
import { HSGE } from '../src/graph/HSGE.js';
import { TreeInferencer } from '../src/inference/TreeInferencer.js';

async function main() {
  try {
    const graph = new GraphManager('./data/graph.db');
    const hsge = new HSGE(graph);
    const llm = new LocalLLM({ modelPath: './models/qwen2.5-7b-instruct-q4_k_m.gguf' });
    const inferencer = new TreeInferencer(llm, graph, hsge, { numPaths: 10 });

    const prompts = [
      'Explain the role of graph memory in neuro-symbolic systems.',
      'Compare continual learning and fine-tuning: key failure modes.',
      'Give a short plan to validate retrieval stability under growth.',
    ];

    for (const p of prompts) {
      const r = await inferencer.runTreeCoS(p);
      console.log('\n' + '═'.repeat(70));
      console.log('Prompt:', p);
      console.log('Answer:', r.finalAnswer);
      console.log(`Confidence: ${(r.confidence * 100).toFixed(1)}% | Consensus: ${(r.consensusRatio * 100).toFixed(1)}%`);
      console.log(`Latency: ${r.latency.toFixed(1)} ms | Speedup: ${r.speedup.toFixed(2)}x`);
    }

    graph.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ 对比测试失败:', error);
    process.exit(1);
  }
}

main();

