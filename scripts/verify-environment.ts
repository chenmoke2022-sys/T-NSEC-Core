/**
 * verify-environment.ts - 验证环境和依赖
 * 
 * 检查所有必需的环境和依赖是否已正确安装
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  status: '✅' | '❌' | '⚠️';
  message: string;
}

async function checkNodeVersion(): Promise<CheckResult> {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    const major = parseInt(version.substring(1).split('.')[0]);
    if (major >= 20) {
      return { name: 'Node.js', status: '✅', message: version };
    }
    return { name: 'Node.js', status: '⚠️', message: `${version} (需要 >= 20)` };
  } catch {
    return { name: 'Node.js', status: '❌', message: '未安装' };
  }
}

async function checkNPM(): Promise<CheckResult> {
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    return { name: 'npm', status: '✅', message: version };
  } catch {
    return { name: 'npm', status: '❌', message: '未安装' };
  }
}

async function checkPython(): Promise<CheckResult> {
  try {
    const version = execSync('python --version', { encoding: 'utf8' }).trim();
    return { name: 'Python', status: '✅', message: version };
  } catch {
    return { name: 'Python', status: '⚠️', message: '未安装（可选，用于下载模型）' };
  }
}

async function checkHuggingFaceCLI(): Promise<CheckResult> {
  try {
    execSync('hf --version', { stdio: 'ignore' });
    return { name: 'huggingface-cli', status: '✅', message: '已安装' };
  } catch {
    try {
      execSync('huggingface-cli', { stdio: 'ignore' });
      return { name: 'huggingface-cli', status: '✅', message: '已安装' };
    } catch {
      return { name: 'huggingface-cli', status: '⚠️', message: '未安装（可选，用于下载模型）' };
    }
  }
}

async function checkCUDA(): Promise<CheckResult> {
  try {
    const output = execSync('nvidia-smi', { encoding: 'utf8' });
    if (output.includes('CUDA Version')) {
      const match = output.match(/CUDA Version: (\d+\.\d+)/);
      const cudaVersion = match ? match[1] : '未知';
      return { name: 'CUDA', status: '✅', message: `版本 ${cudaVersion}` };
    }
    return { name: 'CUDA', status: '⚠️', message: '检测到 NVIDIA GPU，但 CUDA 版本未知' };
  } catch {
    return { name: 'CUDA', status: '⚠️', message: '未检测到 NVIDIA GPU 或 nvidia-smi' };
  }
}

async function checkNodeModules(): Promise<CheckResult> {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    const requiredDeps = ['better-sqlite3', 'commander', 'node-llama-cpp'];
    const missing: string[] = [];
    
    for (const dep of requiredDeps) {
      if (!fs.existsSync(path.join(nodeModulesPath, dep))) {
        missing.push(dep);
      }
    }
    
    if (missing.length === 0) {
      return { name: 'Node 依赖', status: '✅', message: '所有依赖已安装' };
    }
    return { name: 'Node 依赖', status: '❌', message: `缺少: ${missing.join(', ')}` };
  }
  return { name: 'Node 依赖', status: '❌', message: 'node_modules 不存在，请运行 npm install' };
}

async function checkModels(): Promise<CheckResult[]> {
  const modelsDir = path.join(process.cwd(), 'models');
  const results: CheckResult[] = [];
  
  const requiredModels = [
    { name: 'Qwen2.5-14B', filename: 'qwen2.5-14b-instruct-q4_k_m.gguf', size: 8.5 },
    { name: 'Qwen2.5-1.5B', filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', size: 1.0 },
  ];
  
  if (!fs.existsSync(modelsDir)) {
    return [{ name: '模型目录', status: '❌', message: 'models/ 目录不存在' }];
  }
  
  for (const model of requiredModels) {
    const filePath = path.join(modelsDir, model.filename);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeGB = stats.size / 1024 / 1024 / 1024;
      if (sizeGB > model.size * 0.5) { // 至少是预期大小的一半
        results.push({
          name: model.name,
          status: '✅',
          message: `${sizeGB.toFixed(2)} GB`,
        });
      } else {
        results.push({
          name: model.name,
          status: '⚠️',
          message: `文件不完整 (${sizeGB.toFixed(2)} GB，预期 ${model.size} GB)`,
        });
      }
    } else {
      results.push({
        name: model.name,
        status: '❌',
        message: '未找到',
      });
    }
  }
  
  return results;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Thomas Zero 4.0 环境验证                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const checks: CheckResult[] = [];

  // 基础环境
  console.log('📌 基础环境检查');
  console.log('─'.repeat(50));
  checks.push(await checkNodeVersion());
  checks.push(await checkNPM());
  checks.push(await checkPython());
  checks.push(await checkHuggingFaceCLI());
  checks.push(await checkCUDA());

  // 依赖检查
  console.log('\n📌 依赖检查');
  console.log('─'.repeat(50));
  checks.push(await checkNodeModules());

  // 模型检查
  console.log('\n📌 模型文件检查');
  console.log('─'.repeat(50));
  const modelChecks = await checkModels();
  checks.push(...modelChecks);

  // 打印结果
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    验证结果                                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  for (const check of checks) {
    console.log(`║ ${check.status} ${check.name.padEnd(20)} ${check.message.padEnd(35)} ║`);
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 统计
  const success = checks.filter(c => c.status === '✅').length;
  const warning = checks.filter(c => c.status === '⚠️').length;
  const error = checks.filter(c => c.status === '❌').length;

  console.log(`✅ 通过: ${success}`);
  console.log(`⚠️  警告: ${warning}`);
  console.log(`❌ 失败: ${error}\n`);

  if (error === 0) {
    console.log('🎉 环境验证通过！可以开始使用 Thomas Zero 4.0\n');
  } else {
    console.log('⚠️  请修复上述问题后重试\n');
  }
}

main().catch(console.error);

