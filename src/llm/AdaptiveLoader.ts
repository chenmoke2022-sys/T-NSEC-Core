/**
 * AdaptiveLoader - 自适应模型加载器
 * 
 * 功能：根据硬件能力自动选择最优模型配置
 */

import { HardwareProbe, hardwareProbe, ModelSize } from '../system/HardwareProbe.js';
import { LocalLLM, LLMConfig } from './LocalLLM.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ModelConfig {
  size: ModelSize;
  filename: string;
  contextSize: number;
  description: string;
}

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    size: '0.5B',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    contextSize: 1024,
    description: 'Qwen2.5 0.5B - 轻量级模型，适合低端硬件',
  },
  {
    size: '7B',
    filename: 'qwen2.5-7b-instruct-q4_k_m.gguf',
    contextSize: 4096,
    description: 'Qwen2.5 7B - 高容量模型，用于高质量推理',
  },
];

export class AdaptiveLoader {
  private modelsDir: string;
  private probe: HardwareProbe;
  private currentModel: LocalLLM | null = null;
  private draftModel: LocalLLM | null = null;

  constructor(modelsDir: string = './models') {
    this.modelsDir = modelsDir;
    this.probe = hardwareProbe;
  }

  /**
   * 获取可用的模型列表
   */
  getAvailableModels(): ModelConfig[] {
    const available: ModelConfig[] = [];
    
    for (const config of MODEL_CONFIGS) {
      const modelPath = path.join(this.modelsDir, config.filename);
      if (fs.existsSync(modelPath)) {
        available.push(config);
      }
    }
    
    return available;
  }

  /**
   * 获取推荐的模型配置
   */
  getRecommendedConfig(): ModelConfig {
    const recommendedSize = this.probe.getRecommendedModelSize();
    const config = MODEL_CONFIGS.find(c => c.size === recommendedSize);
    return config || MODEL_CONFIGS[0];
  }

  /**
   * 自动加载推荐模型
   */
  async autoLoad(): Promise<LocalLLM> {
    const recommended = this.getRecommendedConfig();
    const available = this.getAvailableModels();
    
    // 如果推荐模型可用，使用推荐模型
    let configToUse = available.find(c => c.size === recommended.size);
    
    // 如果推荐模型不可用，选择最大可用模型
    if (!configToUse && available.length > 0) {
      configToUse = available[available.length - 1];
    }
    
    // 如果没有可用模型，使用虚拟配置
    if (!configToUse) {
      console.log('⚠️ 未找到本地模型文件，使用模拟模式');
      configToUse = recommended;
    }

    console.log(`[AdaptiveLoader] Selected model: ${configToUse.size} - ${configToUse.description}`);
    
    const llmConfig: LLMConfig = {
      modelPath: path.join(this.modelsDir, configToUse.filename),
      contextSize: configToUse.contextSize,
    };

    this.currentModel = new LocalLLM(llmConfig);
    await this.currentModel.load();
    
    return this.currentModel;
  }

  /**
   * 加载指定大小的模型
   */
  async loadModel(size: ModelSize): Promise<LocalLLM> {
    const config = MODEL_CONFIGS.find(c => c.size === size);
    if (!config) {
      throw new Error(`不支持的模型大小: ${size}`);
    }

    const llmConfig: LLMConfig = {
      modelPath: path.join(this.modelsDir, config.filename),
      contextSize: config.contextSize,
    };

    // 卸载当前模型
    if (this.currentModel) {
      await this.currentModel.unload();
    }

    this.currentModel = new LocalLLM(llmConfig);
    await this.currentModel.load();
    
    return this.currentModel;
  }

  /**
   * 加载草稿模型（用于推测解码）
   */
  async loadDraftModel(): Promise<LocalLLM> {
    // 草稿模型使用最小的模型
    const draftConfig = MODEL_CONFIGS[0];
    
    const llmConfig: LLMConfig = {
      modelPath: path.join(this.modelsDir, draftConfig.filename),
      contextSize: draftConfig.contextSize,
    };

    this.draftModel = new LocalLLM(llmConfig);
    await this.draftModel.load();
    
    return this.draftModel;
  }

  /**
   * 获取当前加载的模型
   */
  getCurrentModel(): LocalLLM | null {
    return this.currentModel;
  }

  /**
   * 获取草稿模型
   */
  getDraftModel(): LocalLLM | null {
    return this.draftModel;
  }

  /**
   * 卸载所有模型
   */
  async unloadAll(): Promise<void> {
    if (this.currentModel) {
      await this.currentModel.unload();
      this.currentModel = null;
    }
    if (this.draftModel) {
      await this.draftModel.unload();
      this.draftModel = null;
    }
  }

  /**
   * 打印模型状态
   */
  printStatus(): void {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              T-NSEC 3.0 模型状态                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    
    const available = this.getAvailableModels();
    console.log(`║ 可用模型数量: ${available.length}`.padEnd(61) + '║');
    
    for (const config of MODEL_CONFIGS) {
      const isAvailable = available.some(c => c.size === config.size);
      const status = isAvailable ? 'OK' : '--';
      console.log(`║   [${status}] ${config.size}: ${config.description}`.substring(0, 60).padEnd(61) + '║');
    }
    
    const recommended = this.getRecommendedConfig();
    console.log(`║ 推荐模型: ${recommended.size}`.padEnd(61) + '║');
    
    if (this.currentModel) {
      console.log(`║ 当前加载: ${this.currentModel.getModelSize()}`.padEnd(61) + '║');
    } else {
      console.log('║ 当前加载: 无'.padEnd(61) + '║');
    }
    
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }
}

export default AdaptiveLoader;

