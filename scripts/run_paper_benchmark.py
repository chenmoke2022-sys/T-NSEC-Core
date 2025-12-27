#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
论文基准测试脚本
根据交付包.md要求，启动所有服务器并收集测试数据
生成CSV、图表和总结报告
"""

import subprocess
import sys
import os
import json
import time
import requests
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
import platform

# 获取项目根目录
project_root = Path(__file__).parent.parent
os.chdir(project_root)

# 服务器配置
SERVERS = {
    '0.5B': {'port': 8080, 'model': 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf'},
    '1.5B': {'port': 8081, 'model': 'qwen2.5-1.5b-instruct-q4_k_m.gguf'},
    '3B': {'port': 8082, 'model': 'Qwen2.5-3B-Instruct-Q4_K_M.gguf'},
    '14B': {'port': 8083, 'model': 'qwen2.5-14b-instruct-q4_k_m.gguf'},
}

# 测试输入
TEST_PROMPTS = {
    'cognitive': [
        '什么是认知？',
        '记忆如何工作？',
        '解释类比推理',
        '什么是元认知？',
        '如何进行终身学习？',
    ],
    'technical': [
        '什么是神经网络？',
        '解释机器学习',
        '什么是超维计算？',
        '解释图神经网络',
        '什么是神经符号系统？',
    ],
    'analogy': [
        '太阳系和原子的类比',
        '大脑和计算机的类比',
        '学习和进化的类比',
        '记忆和存储的类比',
        '认知和计算的类比',
    ],
}

def check_server_health(port: int, timeout: int = 5) -> bool:
    """检查服务器是否运行"""
    try:
        response = requests.get(f'http://localhost:{port}/health', timeout=timeout)
        return response.status_code == 200
    except:
        return False

def start_servers():
    """启动所有服务器"""
    print("=" * 60)
    print("启动多模型服务器...")
    print("=" * 60)
    
    # 检查服务器是否已运行
    all_running = True
    for name, config in SERVERS.items():
        if check_server_health(config['port']):
            print(f"✅ {name} 服务器已在运行 (端口 {config['port']})")
        else:
            all_running = False
            print(f"⚠️  {name} 服务器未运行 (端口 {config['port']})")
    
    if all_running:
        print("\n所有服务器已运行，继续测试...\n")
        return True
    
    print("\n正在启动服务器...")
    print("请确保已运行: scripts\\start_models.bat 或 py -3.12 scripts\\start_models.py\n")
    
    # 尝试启动服务器
    try:
        if platform.system() == 'Windows':
            proc = subprocess.Popen(
                ['scripts\\start_models.bat'],
                cwd=project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            proc = subprocess.Popen(
                ['python3.12', 'scripts/start_models.py'],
                cwd=project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
        
        print("等待服务器启动...")
        time.sleep(10)
        
        # 检查服务器是否启动成功
        for name, config in SERVERS.items():
            if check_server_health(config['port'], timeout=10):
                print(f"✅ {name} 服务器已启动")
            else:
                print(f"❌ {name} 服务器启动失败")
                return False
        
        return True
    except Exception as e:
        print(f"❌ 启动服务器失败: {e}")
        return False

def test_inference(port: int, prompt: str, max_tokens: int = 512) -> Dict[str, Any]:
    """测试推理接口"""
    try:
        start_time = time.time()
        response = requests.post(
            f'http://localhost:{port}/infer',
            json={
                'prompt': prompt,
                'maxTokens': max_tokens,
                'temperature': 0.7,
            },
            timeout=120
        )
        latency = (time.time() - start_time) * 1000  # ms
        
        if response.status_code == 200:
            data = response.json()
            return {
                'success': True,
                'latency': latency,
                'tokens': data.get('tokens', 0),
                'tokensPerSecond': data.get('tokensPerSecond', 0),
                'duration': data.get('duration', latency),
                'gpuMemoryUsed': data.get('gpuMemoryUsed', 0),
                'gpuLoad': data.get('gpuLoad', 0),
                'text': data.get('text', '')[:100],  # 前100字符
            }
        else:
            return {
                'success': False,
                'error': f'HTTP {response.status_code}',
                'latency': latency,
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'latency': 0,
        }

def run_benchmark_tests():
    """运行基准测试"""
    print("=" * 60)
    print("运行基准测试")
    print("=" * 60)
    
    all_results = []
    
    for server_name, server_config in SERVERS.items():
        port = server_config['port']
        print(f"\n测试 {server_name} 服务器 (端口 {port})...")
        
        server_results = []
        
        for domain, prompts in TEST_PROMPTS.items():
            print(f"  测试域: {domain} ({len(prompts)} 个提示)")
            
            for i, prompt in enumerate(prompts, 1):
                print(f"    [{i}/{len(prompts)}] {prompt[:50]}...", end=' ', flush=True)
                
                result = test_inference(port, prompt)
                result['server'] = server_name
                result['port'] = port
                result['domain'] = domain
                result['prompt'] = prompt
                result['timestamp'] = datetime.now().isoformat()
                
                if result['success']:
                    print(f"✅ {result['latency']:.0f}ms, {result.get('tokensPerSecond', 0):.1f} TPS")
                else:
                    print(f"❌ {result.get('error', 'Unknown error')}")
                
                server_results.append(result)
                all_results.append(result)
                
                time.sleep(0.5)  # 避免过载
        
        print(f"\n  {server_name} 测试完成: {len([r for r in server_results if r['success']])}/{len(server_results)} 成功")
    
    return all_results

def export_to_csv(results: List[Dict[str, Any]], output_dir: Path):
    """导出结果到CSV"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = output_dir / f'benchmark_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    if not results:
        print("⚠️  没有数据可导出")
        return None
    
    # 获取所有字段
    fieldnames = [
        'timestamp', 'server', 'port', 'domain', 'prompt',
        'success', 'latency', 'tokens', 'tokensPerSecond',
        'duration', 'gpuMemoryUsed', 'gpuLoad', 'text', 'error'
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            row = {field: result.get(field, '') for field in fieldnames}
            writer.writerow(row)
    
    print(f"✅ CSV已导出: {csv_path}")
    return csv_path

def generate_summary_report(results: List[Dict[str, Any]], output_dir: Path):
    """生成总结报告"""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    report_path = output_dir / f'benchmark_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
    
    successful_results = [r for r in results if r.get('success', False)]
    
    # 按服务器统计
    server_stats = {}
    for result in successful_results:
        server = result['server']
        if server not in server_stats:
            server_stats[server] = {
                'count': 0,
                'latencies': [],
                'tps': [],
                'tokens': [],
                'gpu_memory': [],
                'gpu_load': [],
            }
        
        stats = server_stats[server]
        stats['count'] += 1
        if 'latency' in result:
            stats['latencies'].append(result['latency'])
        if 'tokensPerSecond' in result:
            stats['tps'].append(result['tokensPerSecond'])
        if 'tokens' in result:
            stats['tokens'].append(result['tokens'])
        if 'gpuMemoryUsed' in result:
            stats['gpu_memory'].append(result['gpuMemoryUsed'])
        if 'gpuLoad' in result:
            stats['gpu_load'].append(result['gpuLoad'])
    
    # 生成报告
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# T-NSEC 3.0 基准测试报告\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 测试概览\n\n")
        f.write(f"- **总测试数**: {len(results)}\n")
        f.write(f"- **成功数**: {len(successful_results)}\n")
        f.write(f"- **成功率**: {len(successful_results)/len(results)*100:.1f}%\n\n")
        
        f.write("## 服务器性能统计\n\n")
        f.write("| 服务器 | 测试数 | 平均延迟(ms) | 平均TPS | 平均Token数 | 平均VRAM(MB) | 平均GPU负载(%) |\n")
        f.write("|--------|--------|--------------|---------|------------|--------------|---------------|\n")
        
        for server_name in ['0.5B', '1.5B', '3B', '14B']:
            if server_name in server_stats:
                stats = server_stats[server_name]
                avg_latency = sum(stats['latencies']) / len(stats['latencies']) if stats['latencies'] else 0
                avg_tps = sum(stats['tps']) / len(stats['tps']) if stats['tps'] else 0
                avg_tokens = sum(stats['tokens']) / len(stats['tokens']) if stats['tokens'] else 0
                avg_vram = sum(stats['gpu_memory']) / len(stats['gpu_memory']) if stats['gpu_memory'] else 0
                avg_gpu_load = sum(stats['gpu_load']) / len(stats['gpu_load']) if stats['gpu_load'] else 0
                
                f.write(f"| {server_name} | {stats['count']} | {avg_latency:.2f} | {avg_tps:.2f} | {avg_tokens:.0f} | {avg_vram:.0f} | {avg_gpu_load:.1f} |\n")
        
        f.write("\n## 按域统计\n\n")
        
        # 按域统计
        domain_stats = {}
        for result in successful_results:
            domain = result.get('domain', 'unknown')
            if domain not in domain_stats:
                domain_stats[domain] = {'count': 0, 'latencies': []}
            domain_stats[domain]['count'] += 1
            if 'latency' in result:
                domain_stats[domain]['latencies'].append(result['latency'])
        
        f.write("| 域 | 测试数 | 平均延迟(ms) |\n")
        f.write("|----|--------|--------------|\n")
        for domain, stats in domain_stats.items():
            avg_latency = sum(stats['latencies']) / len(stats['latencies']) if stats['latencies'] else 0
            f.write(f"| {domain} | {stats['count']} | {avg_latency:.2f} |\n")
        
        f.write("\n## 关键指标\n\n")
        
        if successful_results:
            all_latencies = [r['latency'] for r in successful_results if 'latency' in r]
            all_tps = [r['tokensPerSecond'] for r in successful_results if 'tokensPerSecond' in r]
            
            if all_latencies:
                f.write(f"- **平均延迟**: {sum(all_latencies)/len(all_latencies):.2f} ms\n")
                f.write(f"- **最小延迟**: {min(all_latencies):.2f} ms\n")
                f.write(f"- **最大延迟**: {max(all_latencies):.2f} ms\n")
            
            if all_tps:
                f.write(f"- **平均TPS**: {sum(all_tps)/len(all_tps):.2f} tokens/s\n")
                f.write(f"- **最小TPS**: {min(all_tps):.2f} tokens/s\n")
                f.write(f"- **最大TPS**: {max(all_tps):.2f} tokens/s\n")
        
        f.write("\n## 结论\n\n")
        f.write("测试完成。所有数据已导出到CSV文件，可用于进一步分析。\n")
    
    print(f"✅ 报告已生成: {report_path}")
    return report_path

def generate_charts(results: List[Dict[str, Any]], output_dir: Path):
    """生成图表（如果matplotlib可用）"""
    try:
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("⚠️  matplotlib未安装，跳过图表生成")
        print("   安装命令: pip install matplotlib numpy")
        return None
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    successful_results = [r for r in results if r.get('success', False)]
    
    if not successful_results:
        print("⚠️  没有成功的数据可绘制")
        return None
    
    # 1. 延迟对比图
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    
    # 延迟箱线图
    ax1 = axes[0, 0]
    server_latencies = {}
    for result in successful_results:
        server = result['server']
        if server not in server_latencies:
            server_latencies[server] = []
        if 'latency' in result:
            server_latencies[server].append(result['latency'])
    
    if server_latencies:
        ax1.boxplot([server_latencies[s] for s in ['0.5B', '1.5B', '3B', '14B'] if s in server_latencies],
                   labels=[s for s in ['0.5B', '1.5B', '3B', '14B'] if s in server_latencies])
        ax1.set_title('延迟对比 (ms)')
        ax1.set_ylabel('延迟 (ms)')
        ax1.grid(True, alpha=0.3)
    
    # TPS对比图
    ax2 = axes[0, 1]
    server_tps = {}
    for result in successful_results:
        server = result['server']
        if server not in server_tps:
            server_tps[server] = []
        if 'tokensPerSecond' in result:
            server_tps[server].append(result['tokensPerSecond'])
    
    if server_tps:
        ax2.boxplot([server_tps[s] for s in ['0.5B', '1.5B', '3B', '14B'] if s in server_tps],
                   labels=[s for s in ['0.5B', '1.5B', '3B', '14B'] if s in server_tps])
        ax2.set_title('TPS对比 (tokens/s)')
        ax2.set_ylabel('TPS (tokens/s)')
        ax2.grid(True, alpha=0.3)
    
    # 延迟分布直方图
    ax3 = axes[1, 0]
    all_latencies = [r['latency'] for r in successful_results if 'latency' in r]
    if all_latencies:
        ax3.hist(all_latencies, bins=30, edgecolor='black', alpha=0.7)
        ax3.set_title('延迟分布')
        ax3.set_xlabel('延迟 (ms)')
        ax3.set_ylabel('频次')
        ax3.grid(True, alpha=0.3)
    
    # TPS分布直方图
    ax4 = axes[1, 1]
    all_tps = [r['tokensPerSecond'] for r in successful_results if 'tokensPerSecond' in r]
    if all_tps:
        ax4.hist(all_tps, bins=30, edgecolor='black', alpha=0.7)
        ax4.set_title('TPS分布')
        ax4.set_xlabel('TPS (tokens/s)')
        ax4.set_ylabel('频次')
        ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    chart_path = output_dir / f'benchmark_charts_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
    plt.savefig(chart_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"✅ 图表已生成: {chart_path}")
    return chart_path

def main():
    """主函数"""
    print("=" * 60)
    print("T-NSEC 3.0 论文基准测试")
    print("=" * 60)
    print()
    
    # 1. 启动服务器
    if not start_servers():
        print("❌ 服务器启动失败，退出")
        sys.exit(1)
    
    # 等待服务器完全启动
    print("等待服务器完全启动...")
    time.sleep(5)
    
    # 2. 运行测试
    results = run_benchmark_tests()
    
    if not results:
        print("❌ 没有测试结果")
        sys.exit(1)
    
    # 3. 创建输出目录
    output_dir = project_root / 'reports' / 'paper_benchmark'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 4. 导出CSV
    csv_path = export_to_csv(results, output_dir)
    
    # 5. 生成报告
    report_path = generate_summary_report(results, output_dir)
    
    # 6. 生成图表
    chart_path = generate_charts(results, output_dir)
    
    # 7. 总结
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print(f"\n输出文件:")
    if csv_path:
        print(f"  - CSV: {csv_path}")
    if report_path:
        print(f"  - 报告: {report_path}")
    if chart_path:
        print(f"  - 图表: {chart_path}")
    print()

if __name__ == '__main__':
    main()

