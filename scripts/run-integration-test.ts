/**
 * T-NSEC 3.0 完整集成测试
 * 
 * 模拟完整的任务处理循环：
 * 1. 感知（D-VSR）- 解析自然语言指令
 * 2. 图谱检索（H-SGE）- 从知识图谱检索相关信息
 * 3. 推理决策（H-Spec调度与Tree-CoS）- 执行推理并生成决策
 * 4. 执行验证（APO）- 验证执行结果并更新Karma
 * 
 * 使用方法：
 *   npm run integration-test
 * 
 * 或直接运行：
 *   npx tsx scripts/run-integration-test.ts "整理我桌面上的所有截图文件，并按日期重命名"
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { GraphManager } from '../src/graph/GraphManager.js';
import { HSGE } from '../src/graph/HSGE.js';
import { HDCEngine } from '../src/hdc/HDCEngine.js';
import { InferenceEngine } from '../src/inference/InferenceEngine.js';
import { HSpecScheduler, Task } from '../src/inference/HSpecScheduler.js';
import { TreeInferencer, CoSResult } from '../src/inference/TreeInferencer.js';
import { TKAPOCalibrator, AccessEvent } from '../src/evolution/TKAPOCalibrator.js';
import { AdaptiveLoader } from '../src/llm/AdaptiveLoader.js';
import { LocalLLM } from '../src/llm/LocalLLM.js';
import { SystemSupervisor, ResourceMonitor } from '../src/core/SystemSupervisor.js';

/**
 * 执行阶段
 */
type ExecutionStage = 'PERCEPTION' | 'GRAPH_RETRIEVAL' | 'REASONING' | 'EXECUTION' | 'VERIFICATION';

/**
 * 阶段执行结果
 */
interface StageResult {
  stage: ExecutionStage;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result: any;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 完整执行跟踪
 */
interface ExecutionTrace {
  taskId: string;
  instruction: string;
  stages: StageResult[];
  totalDuration: number;
  finalResult: string;
  success: boolean;
  timestamp: number;
}

/**
 * 简化的感知模块（D-VSR）
 * 解析自然语言指令，提取关键信息
 */
class PerceptionModule {
  private hdc: HDCEngine;

  constructor(hdc: HDCEngine) {
    this.hdc = hdc;
  }

  /**
   * 解析自然语言指令
   */
  async parseInstruction(instruction: string): Promise<{
    action: string;
    target: string;
    constraints: string[];
    complexity: 'L1' | 'L2' | 'L3' | 'PLANNING';
    keywords: string[];
  }> {
    const startTime = performance.now();

    // 提取关键词
    const keywords = this.extractKeywords(instruction);
    
    // 识别动作
    const action = this.identifyAction(instruction);
    
    // 识别目标
    const target = this.identifyTarget(instruction);
    
    // 提取约束条件
    const constraints = this.extractConstraints(instruction);
    
    // 评估复杂度
    const complexity = this.assessComplexity(instruction, keywords);

    const duration = performance.now() - startTime;

    return {
      action,
      target,
      constraints,
      complexity,
      keywords,
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 常见动作词
    const actionWords = ['整理', '重命名', '移动', '删除', '创建', '查找', '分析', '设计', '生成'];
    // 常见目标词
    const targetWords = ['文件', '文件夹', '截图', '图片', '文档', '数据', '系统', '界面'];
    // 常见约束词
    const constraintWords = ['按日期', '按名称', '按大小', '按类型', '所有', '部分', '特定'];

    const keywords: string[] = [];
    const lowerText = text.toLowerCase();

    for (const word of [...actionWords, ...targetWords, ...constraintWords]) {
      if (lowerText.includes(word.toLowerCase())) {
        keywords.push(word);
      }
    }

    return keywords;
  }

  /**
   * 识别动作
   */
  private identifyAction(text: string): string {
    const actions: Record<string, string> = {
      '整理': 'organize',
      '重命名': 'rename',
      '移动': 'move',
      '删除': 'delete',
      '创建': 'create',
      '查找': 'search',
      '分析': 'analyze',
      '设计': 'design',
      '生成': 'generate',
    };

    for (const [key, value] of Object.entries(actions)) {
      if (text.includes(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  /**
   * 识别目标
   */
  private identifyTarget(text: string): string {
    const targets: Record<string, string> = {
      '文件': 'files',
      '文件夹': 'folders',
      '截图': 'screenshots',
      '图片': 'images',
      '文档': 'documents',
      '数据': 'data',
      '系统': 'system',
      '界面': 'interface',
    };

    for (const [key, value] of Object.entries(targets)) {
      if (text.includes(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  /**
   * 提取约束条件
   */
  private extractConstraints(text: string): string[] {
    const constraints: string[] = [];

    if (text.includes('按日期')) constraints.push('sort_by_date');
    if (text.includes('按名称')) constraints.push('sort_by_name');
    if (text.includes('按大小')) constraints.push('sort_by_size');
    if (text.includes('按类型')) constraints.push('sort_by_type');
    if (text.includes('所有')) constraints.push('all_items');
    if (text.includes('部分')) constraints.push('partial_items');

    return constraints;
  }

  /**
   * 评估复杂度
   */
  private assessComplexity(text: string, keywords: string[]): 'L1' | 'L2' | 'L3' | 'PLANNING' {
    const length = text.length;
    const keywordCount = keywords.length;
    const hasMultipleActions = (text.match(/[，,]/g) || []).length > 0;

    // 简单任务：短文本，少量关键词，单一动作
    if (length < 30 && keywordCount <= 3 && !hasMultipleActions) {
      return 'L1';
    }

    // 中等任务：中等长度，多个关键词，可能有多个步骤
    if (length < 100 && keywordCount <= 6) {
      return 'L2';
    }

    // 复杂任务：长文本，多个关键词，多个步骤
    if (length < 200 && keywordCount <= 10) {
      return 'L3';
    }

    // 规划任务：很长文本，大量关键词，复杂多步骤
    return 'PLANNING';
  }
}

/**
 * 执行引擎（模拟实际执行）
 */
class ExecutionEngine {
  /**
   * 执行动作
   */
  async execute(action: string, target: string, constraints: string[]): Promise<{
    success: boolean;
    result: string;
    affectedItems: number;
  }> {
    // 模拟执行延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // 模拟执行结果
    const affectedItems = Math.floor(Math.random() * 10) + 1;
    
    let result = '';
    switch (action) {
      case 'organize':
        result = `已整理 ${affectedItems} 个${target}，按${constraints.join('、')}排序`;
        break;
      case 'rename':
        result = `已重命名 ${affectedItems} 个${target}，按日期格式命名`;
        break;
      case 'move':
        result = `已移动 ${affectedItems} 个${target}到指定位置`;
        break;
      default:
        result = `已执行 ${action} 操作，影响 ${affectedItems} 个${target}`;
    }

    return {
      success: true,
      result,
      affectedItems,
    };
  }
}

/**
 * T-NSEC 3.0 集成测试主类
 */
class TNSECIntegrationTest {
  private graph: GraphManager;
  private hsge: HSGE;
  private hdc: HDCEngine;
  private inferenceEngine!: InferenceEngine;
  private scheduler!: HSpecScheduler;
  private treeInferencer!: TreeInferencer;
  private apo: TKAPOCalibrator;
  private perception: PerceptionModule;
  private execution: ExecutionEngine;
  private systemSupervisor: SystemSupervisor;
  private llm!: LocalLLM;
  private resourceMonitor: ResourceMonitor | null = null;

  constructor() {
    // 初始化基础组件
    this.graph = new GraphManager('./data/integration-test.db');
    this.hdc = new HDCEngine(10000, 42);
    this.hsge = new HSGE(this.graph, this.hdc);
    this.perception = new PerceptionModule(this.hdc);
    this.execution = new ExecutionEngine();
    this.apo = new TKAPOCalibrator(this.graph);
    this.systemSupervisor = new SystemSupervisor();
  }

  /**
   * 初始化系统
   */
  async initialize(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         T-NSEC 3.0 系统初始化                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const initStart = performance.now();

    // 1. 初始化系统监督器
    console.log('📊 [1/5] 初始化系统监督器...');
    await this.systemSupervisor.initialize('env1');
    console.log('   ✅ 系统监督器已初始化\n');

    // 2. 加载模型
    console.log('📦 [2/5] 加载本地模型...');
    const loader = new AdaptiveLoader('./models');
    this.llm = await loader.autoLoad();
    console.log('   ✅ 模型已加载\n');

    // 3. 初始化推理引擎
    console.log('🚀 [3/5] 初始化推理引擎...');
    this.inferenceEngine = new InferenceEngine({
      modelPath: './models/qwen2.5-14b-instruct-q4_k_m.gguf',
      contextSize: 8192,
    });
    await this.inferenceEngine.initialize();
    console.log('   ✅ 推理引擎已初始化\n');

    // 4. 初始化调度器
    console.log('⚙️  [4/5] 初始化 H-Spec 调度器...');
    this.scheduler = new HSpecScheduler(this.inferenceEngine);
    console.log('   ✅ 调度器已初始化\n');

    // 5. 初始化 Tree-CoS 推理器
    console.log('🌳 [5/5] 初始化 Tree-CoS 推理器...');
    this.treeInferencer = new TreeInferencer(this.llm, this.graph, this.hsge, {
      numPaths: 10,
      maxDepth: 5,
    });
    console.log('   ✅ Tree-CoS 推理器已初始化\n');

    // 6. 创建资源监控器
    console.log('📊 创建资源监控器...');
    this.resourceMonitor = this.systemSupervisor.createResourceMonitor(this.inferenceEngine);
    console.log('   ✅ 资源监控器已创建\n');

    // 7. 填充示例知识图谱数据
    console.log('📚 填充知识图谱...');
    this.seedKnowledgeGraph();
    console.log('   ✅ 知识图谱已填充\n');

    const initDuration = performance.now() - initStart;
    console.log(`✅ 系统初始化完成 (耗时: ${initDuration.toFixed(2)}ms)\n`);
  }

  /**
   * 填充知识图谱
   */
  private seedKnowledgeGraph(): void {
    // 添加文件操作相关节点
    const nodes = [
      { label: '文件操作', type: 'concept', karma: 1.0 },
      { label: '整理', type: 'action', karma: 0.9 },
      { label: '重命名', type: 'action', karma: 0.9 },
      { label: '截图', type: 'entity', karma: 0.8 },
      { label: '桌面', type: 'location', karma: 0.7 },
      { label: '日期', type: 'attribute', karma: 0.8 },
      { label: '文件管理', type: 'concept', karma: 0.9 },
    ];

    const nodeMap = new Map<string, string>();
    for (const n of nodes) {
      const node = this.graph.addNode(n);
      nodeMap.set(n.label, node.id);
    }

    // 添加关系
    const edges = [
      { source: '文件操作', target: '整理', relation: 'has_action' },
      { source: '文件操作', target: '重命名', relation: 'has_action' },
      { source: '整理', target: '截图', relation: 'applies_to' },
      { source: '重命名', target: '截图', relation: 'applies_to' },
      { source: '截图', target: '桌面', relation: 'located_in' },
      { source: '重命名', target: '日期', relation: 'uses_attribute' },
      { source: '文件操作', target: '文件管理', relation: 'is_a' },
    ];

    for (const e of edges) {
      const sourceId = nodeMap.get(e.source);
      const targetId = nodeMap.get(e.target);
      if (sourceId && targetId) {
        this.graph.addEdge({
          sourceId,
          targetId,
          relation: e.relation,
          weight: 1.0,
          karma: 0.8,
        });
      }
    }
  }

  /**
   * 执行完整的任务处理循环
   */
  async processTask(instruction: string): Promise<ExecutionTrace> {
    const taskId = `task-${Date.now()}`;
    const trace: ExecutionTrace = {
      taskId,
      instruction,
      stages: [],
      totalDuration: 0,
      finalResult: '',
      success: false,
      timestamp: Date.now(),
    };

    const overallStart = performance.now();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          T-NSEC 3.0 任务处理循环                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 任务ID: ${taskId}`.padEnd(61) + '║');
    console.log(`║ 指令: ${instruction.substring(0, 55).padEnd(55)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 开始资源监控
    if (this.resourceMonitor) {
      this.resourceMonitor.startMonitoring(1000); // 每秒采样一次
    }

    try {
      // 阶段 1: 感知（D-VSR）
      const perceptionResult = await this.stagePerception(instruction);
      trace.stages.push(perceptionResult);

      if (!perceptionResult.success) {
        throw new Error(`感知阶段失败: ${perceptionResult.error}`);
      }

      const parsed = perceptionResult.result;

      // 阶段 2: 图谱检索（H-SGE）
      const retrievalResult = await this.stageGraphRetrieval(parsed);
      trace.stages.push(retrievalResult);

      if (!retrievalResult.success) {
        throw new Error(`图谱检索阶段失败: ${retrievalResult.error}`);
      }

      // 阶段 3: 推理决策（H-Spec调度与Tree-CoS）
      const reasoningResult = await this.stageReasoning(instruction, parsed, retrievalResult.result);
      trace.stages.push(reasoningResult);

      if (!reasoningResult.success) {
        throw new Error(`推理决策阶段失败: ${reasoningResult.error}`);
      }

      // 阶段 4: 执行
      const executionResult = await this.stageExecution(parsed, reasoningResult.result);
      trace.stages.push(executionResult);

      if (!executionResult.success) {
        throw new Error(`执行阶段失败: ${executionResult.error}`);
      }

      // 阶段 5: 验证（APO）
      const verificationResult = await this.stageVerification(executionResult.result);
      trace.stages.push(verificationResult);

      trace.success = true;
      trace.finalResult = executionResult.result.result;

    } catch (error: any) {
      console.error(`\n❌ 任务处理失败: ${error.message}`);
      trace.success = false;
      trace.finalResult = error.message;
    }

    trace.totalDuration = performance.now() - overallStart;

    // 停止资源监控
    if (this.resourceMonitor) {
      const resourceStats = this.resourceMonitor.stopMonitoring();
      
      // 打印资源监控报告
      this.resourceMonitor.printStats();

      // 生成 ASCII 图表
      console.log(this.resourceMonitor.generateASCIIChart('systemMemory', 60, 10));
      console.log(this.resourceMonitor.generateASCIIChart('gpuMemory', 60, 10));
      console.log(this.resourceMonitor.generateASCIIChart('gpuUtilization', 60, 10));
      console.log(this.resourceMonitor.generateASCIIChart('cpuUtilization', 60, 10));

      // 将资源监控数据添加到跟踪中
      (trace as any).resourceStats = resourceStats;
    }

    // 打印执行跟踪
    this.printExecutionTrace(trace);

    return trace;
  }

  /**
   * 阶段 1: 感知（D-VSR）
   */
  private async stagePerception(instruction: string): Promise<StageResult> {
    const stage = 'PERCEPTION';
    const startTime = performance.now();

    console.log('🔍 [阶段 1/5] 感知（D-VSR）');
    console.log('━'.repeat(60));

    try {
      const parsed = await this.perception.parseInstruction(instruction);

      console.log(`   动作: ${parsed.action}`);
      console.log(`   目标: ${parsed.target}`);
      console.log(`   约束: ${parsed.constraints.join(', ') || '无'}`);
      console.log(`   复杂度: ${parsed.complexity}`);
      console.log(`   关键词: ${parsed.keywords.join(', ')}`);

      const duration = performance.now() - startTime;
      console.log(`   ✅ 感知完成 (耗时: ${duration.toFixed(2)}ms)\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: true,
        result: parsed,
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`   ❌ 感知失败: ${error.message}\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: false,
        result: null,
        error: error.message,
      };
    }
  }

  /**
   * 阶段 2: 图谱检索（H-SGE）
   */
  private async stageGraphRetrieval(parsed: any): Promise<StageResult> {
    const stage = 'GRAPH_RETRIEVAL';
    const startTime = performance.now();

    console.log('📚 [阶段 2/5] 图谱检索（H-SGE）');
    console.log('━'.repeat(60));

    try {
      // 从知识图谱中检索相关节点
      const allNodes = this.graph.getAllNodes(100);
      const relevantNodes: any[] = [];

      for (const node of allNodes) {
        // 检查节点标签是否与关键词匹配
        const nodeLabel = node.label.toLowerCase();
        const isRelevant = parsed.keywords.some((kw: string) =>
          nodeLabel.includes(kw.toLowerCase())
        );

        if (isRelevant) {
          relevantNodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            karma: node.karma,
          });
        }
      }

      // 使用 H-SGE 进行结构相似性检索
      let analogyResults: any[] = [];
      if (relevantNodes.length > 0) {
        const queryNode = relevantNodes[0];
        analogyResults = this.hsge.findAnalogous(queryNode.id, 5, 0.3);
      }

      console.log(`   检索到 ${relevantNodes.length} 个相关节点`);
      console.log(`   发现 ${analogyResults.length} 个结构相似节点`);

      if (relevantNodes.length > 0) {
        console.log(`   主要节点: ${relevantNodes.slice(0, 3).map((n: any) => n.label).join(', ')}`);
      }

      const duration = performance.now() - startTime;
      console.log(`   ✅ 图谱检索完成 (耗时: ${duration.toFixed(2)}ms)\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: true,
        result: {
          relevantNodes,
          analogyResults,
        },
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`   ❌ 图谱检索失败: ${error.message}\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: false,
        result: null,
        error: error.message,
      };
    }
  }

  /**
   * 阶段 3: 推理决策（H-Spec调度与Tree-CoS）
   */
  private async stageReasoning(
    instruction: string,
    parsed: any,
    retrievalResult: any
  ): Promise<StageResult> {
    const stage = 'REASONING';
    const startTime = performance.now();

    console.log('🧠 [阶段 3/5] 推理决策（H-Spec调度与Tree-CoS）');
    console.log('━'.repeat(60));

    try {
      // 构建增强的提示（包含图谱检索结果）
      const contextNodes = retrievalResult.relevantNodes
        .slice(0, 5)
        .map((n: any) => n.label)
        .join('、');

      const enhancedPrompt = `基于以下知识：${contextNodes}。\n\n任务：${instruction}\n\n请生成详细的执行计划。`;

      // 确定任务级别
      const taskLevel = parsed.complexity;

      // 使用 H-Spec 调度器
      const task: Task = {
        id: `task-${Date.now()}`,
        level: taskLevel,
        prompt: enhancedPrompt,
        priority: 8,
        metadata: {
          action: parsed.action,
          target: parsed.target,
          constraints: parsed.constraints,
        },
      };

      this.scheduler.submit(task);
      const scheduleResult = await this.scheduler.processNext();

      if (!scheduleResult) {
        throw new Error('调度器返回空结果');
      }

      console.log(`   调度策略: ${scheduleResult.strategy}`);
      console.log(`   决策: ${scheduleResult.schedulingDecision}`);

      // 使用 Tree-CoS 进行深度推理
      const cosResult = await this.treeInferencer.runTreeCoS(enhancedPrompt);
      const metacognitiveState = this.treeInferencer.getMetacognitiveState(cosResult);

      console.log(`   置信度: ${(cosResult.confidence * 100).toFixed(1)}%`);
      console.log(`   共识比例: ${(cosResult.consensusRatio * 100).toFixed(1)}%`);
      console.log(`   建议动作: ${metacognitiveState.suggestedAction}`);
      console.log(`   推理延迟: ${cosResult.latency.toFixed(2)}ms`);

      const duration = performance.now() - startTime;
      console.log(`   ✅ 推理决策完成 (耗时: ${duration.toFixed(2)}ms)\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: true,
        result: {
          scheduleResult,
          cosResult,
          metacognitiveState,
          executionPlan: cosResult.finalAnswer,
        },
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`   ❌ 推理决策失败: ${error.message}\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: false,
        result: null,
        error: error.message,
      };
    }
  }

  /**
   * 阶段 4: 执行
   */
  private async stageExecution(parsed: any, reasoningResult: any): Promise<StageResult> {
    const stage = 'EXECUTION';
    const startTime = performance.now();

    console.log('⚡ [阶段 4/5] 执行');
    console.log('━'.repeat(60));

    try {
      // 根据推理结果执行动作
      const executionResult = await this.execution.execute(
        parsed.action,
        parsed.target,
        parsed.constraints
      );

      console.log(`   执行结果: ${executionResult.result}`);
      console.log(`   影响项数: ${executionResult.affectedItems}`);

      const duration = performance.now() - startTime;
      console.log(`   ✅ 执行完成 (耗时: ${duration.toFixed(2)}ms)\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: true,
        result: executionResult,
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`   ❌ 执行失败: ${error.message}\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: false,
        result: null,
        error: error.message,
      };
    }
  }

  /**
   * 阶段 5: 验证（APO）
   */
  private async stageVerification(executionResult: any): Promise<StageResult> {
    const stage = 'VERIFICATION';
    const startTime = performance.now();

    console.log('✅ [阶段 5/5] 验证（APO）');
    console.log('━'.repeat(60));

    try {
      // 记录访问事件并更新 Karma
      const allNodes = this.graph.getAllNodes(50);
      const updates: AccessEvent[] = [];

      for (const node of allNodes.slice(0, 5)) {
        const event: AccessEvent = {
          nodeId: node.id,
          timestamp: Date.now(),
          success: executionResult.success,
          context: 'task_execution',
        };
        this.apo.recordAccess(event);
        updates.push(event);
      }

      // 运行 Karma 校准
      const calibrationResult = this.apo.runCalibration();

      console.log(`   更新节点数: ${calibrationResult.updatedNodes}`);
      console.log(`   剪枝节点数: ${calibrationResult.prunedNodes}`);
      console.log(`   巩固节点数: ${calibrationResult.consolidatedNodes}`);
      console.log(`   平均Karma: ${calibrationResult.avgKarmaBefore.toFixed(3)} → ${calibrationResult.avgKarmaAfter.toFixed(3)}`);

      const duration = performance.now() - startTime;
      console.log(`   ✅ 验证完成 (耗时: ${duration.toFixed(2)}ms)\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: true,
        result: {
          calibrationResult,
          updates,
        },
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`   ❌ 验证失败: ${error.message}\n`);

      return {
        stage,
        startTime,
        endTime: performance.now(),
        duration,
        success: false,
        result: null,
        error: error.message,
      };
    }
  }

  /**
   * 打印执行跟踪
   */
  private printExecutionTrace(trace: ExecutionTrace): void {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              执行跟踪报告                                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 任务ID: ${trace.taskId}`.padEnd(61) + '║');
    console.log(`║ 状态: ${trace.success ? '✅ 成功' : '❌ 失败'}`.padEnd(61) + '║');
    console.log(`║ 总耗时: ${trace.totalDuration.toFixed(2)}ms`.padEnd(61) + '║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 阶段详情:'.padEnd(61) + '║');

    for (const stage of trace.stages) {
      const status = stage.success ? '✅' : '❌';
      const stageName = {
        PERCEPTION: '感知（D-VSR）',
        GRAPH_RETRIEVAL: '图谱检索（H-SGE）',
        REASONING: '推理决策（H-Spec+Tree-CoS）',
        EXECUTION: '执行',
        VERIFICATION: '验证（APO）',
      }[stage.stage];

      console.log(`║   ${status} ${stageName}: ${stage.duration.toFixed(2)}ms`.padEnd(61) + '║');
      if (!stage.success && stage.error) {
        console.log(`║     错误: ${stage.error.substring(0, 55).padEnd(55)}║`);
      }
    }

    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 最终结果:`.padEnd(61) + '║');
    console.log(`║   ${trace.finalResult.substring(0, 57).padEnd(57)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 保存执行跟踪到文件
   */
  async saveTrace(trace: ExecutionTrace, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存 JSON
    fs.writeFileSync(outputPath, JSON.stringify(trace, null, 2), 'utf-8');
    console.log(`✅ 执行跟踪已保存: ${outputPath}`);

    // 保存 CSV
    const csvPath = outputPath.replace('.json', '.csv');
    const csvLines: string[] = [];
    csvLines.push('阶段,开始时间(ms),结束时间(ms),耗时(ms),成功,错误');

    for (const stage of trace.stages) {
      csvLines.push([
        stage.stage,
        stage.startTime.toFixed(2),
        stage.endTime.toFixed(2),
        stage.duration.toFixed(2),
        stage.success ? '是' : '否',
        stage.error || '',
      ].join(','));
    }

    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
    console.log(`✅ CSV 跟踪已保存: ${csvPath}`);
  }

  /**
   * 获取资源监控器
   */
  getResourceMonitor(): ResourceMonitor | null {
    return this.resourceMonitor;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 停止资源监控（如果还在运行）
    if (this.resourceMonitor) {
      this.resourceMonitor.stopMonitoring();
    }
    this.graph.close();
  }
}

/**
 * 主函数
 */
async function main() {
  // 从命令行参数获取指令，或使用默认值
  const instruction = process.argv[2] || '整理我桌面上的所有截图文件，并按日期重命名';

  console.log('🚀 T-NSEC 3.0 完整集成测试\n');
  console.log(`📝 任务指令: ${instruction}\n`);

  const test = new TNSECIntegrationTest();

  try {
    // 初始化系统
    await test.initialize();

    // 执行任务
    const trace = await test.processTask(instruction);

    // 保存跟踪
    const timestamp = Date.now();
    await test.saveTrace(
      trace,
      `./reports/integration-test-${timestamp}.json`
    );

    // 保存资源监控数据
    const resourceMonitor = test.getResourceMonitor();
    if (resourceMonitor) {
      resourceMonitor.exportJSON(`./reports/resource-monitor-${timestamp}.json`);
      resourceMonitor.exportCSV(`./reports/resource-monitor-${timestamp}.csv`);
    }

    // 清理
    test.cleanup();

    console.log('✅ 集成测试完成！\n');
    process.exit(trace.success ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ 集成测试失败:', error);
    test.cleanup();
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default TNSECIntegrationTest;

