/**
 * test-cuda-support.ts - 测试 CUDA 支持
 */

import { getLlama } from 'node-llama-cpp';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           测试 node-llama-cpp CUDA 支持                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    console.log('📌 初始化 Llama...');
    const llama = await getLlama();
    
    console.log('✅ Llama 初始化成功');
    
    // 检查 GPU 支持
    if (llama.gpu) {
      console.log('\n✅ GPU 支持: 已启用');
      console.log(`   GPU 类型: ${llama.gpu}`);
    } else {
      console.log('\n⚠️  GPU 支持: 未启用');
      console.log('   可能原因:');
      console.log('   1. node-llama-cpp 未使用 CUDA 编译');
      console.log('   2. CUDA Toolkit 未正确安装');
      console.log('   3. 需要重新编译 node-llama-cpp');
    }

    // 尝试加载模型测试
    const modelPath = './models/qwen2.5-14b-instruct-q4_k_m.gguf';
    const fs = await import('fs');
    
    if (fs.existsSync(modelPath)) {
      console.log('\n📌 测试加载模型...');
      try {
        const model = await llama.loadModel({
          modelPath,
          gpuLayers: 999,  // 尝试所有层放 GPU
        });
        
        console.log('✅ 模型加载成功');
        console.log(`   GPU 层数: ${model.gpuLayers || '未知'}`);
        
        await model.dispose();
      } catch (error) {
        console.log('⚠️  模型加载失败:');
        console.log(`   ${error}`);
      }
    } else {
      console.log('\n⚠️  模型文件不存在，跳过加载测试');
    }

  } catch (error) {
    console.log('\n❌ 错误:');
    console.log(`   ${error}`);
    console.log('\n可能的原因:');
    console.log('   1. node-llama-cpp 未正确安装');
    console.log('   2. 需要重新编译以支持 CUDA');
    console.log('   3. Python 版本不兼容');
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    测试完成                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch(console.error);

