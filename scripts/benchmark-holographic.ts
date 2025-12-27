/**
 * HolographicGraphEngine 性能基准测试脚本
 * 
 * 使用方法：
 *   npm run benchmark-holographic
 * 
 * 或直接运行：
 *   npx tsx scripts/benchmark-holographic.ts
 */

import { runBenchmark } from '../src/graph/HolographicGraphEngine.benchmark.js';

async function main() {
  console.log('🚀 启动 HolographicGraphEngine 性能基准测试\n');
  
  try {
    await runBenchmark();
    process.exit(0);
  } catch (error) {
    console.error('❌ 基准测试失败:', error);
    process.exit(1);
  }
}

main();

