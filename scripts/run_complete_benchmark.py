#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整基准测试脚本
整合TypeScript基准测试和服务器测试，生成完整的CSV、图表和报告
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
from typing import Dict, List, Any, Optional
import platform

# 设置Windows控制台编码
if platform.system() == 'Windows':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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
    print("检查服务器状态...")
    print("=" * 60)
    
    all_running = True
    for name, config in SERVERS.items():
        if check_server_health(config['port']):
            print(f"✅ {name} 服务器已运行 (端口 {config['port']})")
        else:
            all_running = False
            print(f"⚠️  {name} 服务器未运行 (端口 {config['port']})")
    
    if not all_running:
        print("\n" + "=" * 60)
        print("服务器未运行")
        print("=" * 60)
        print("\n请运行以下命令启动服务器:")
        print("  Windows: scripts\\start_models.bat")
        print("  Linux/Mac: python3.12 scripts/start_models.py")
        print("\n或使用: py -3.12 scripts\\start_models.py\n")
        print("注意: 将跳过服务器测试，仅运行TypeScript基准测试\n")
        
        # 自动跳过服务器启动（非交互模式）
        auto_start = os.environ.get('AUTO_START_SERVERS', 'false').lower() == 'true'
        if auto_start:
            try:
                if platform.system() == 'Windows':
                    proc = subprocess.Popen(
                        ['py', '-3.12', 'scripts\\start_models.py'],
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
                
                print("等待服务器启动（30秒）...")
                for i in range(30):
                    time.sleep(1)
                    all_running = True
                    for name, config in SERVERS.items():
                        if not check_server_health(config['port'], timeout=2):
                            all_running = False
                            break
                    if all_running:
                        print(f"\n✅ 所有服务器已启动！")
                        break
                    print(f".", end='', flush=True)
                
                if not all_running:
                    print("\n⚠️  服务器可能未完全启动，继续测试...")
            except Exception as e:
                print(f"❌ 启动失败: {e}")
                return False
        else:
            print("跳过服务器启动，继续运行TypeScript基准测试...")
            return False
    else:
        print("\n所有服务器已运行！\n")
    
    return True

def run_typescript_benchmark():
    """运行TypeScript基准测试"""
    print("\n" + "=" * 60)
    print("运行TypeScript基准测试 (benchmark-full.ts)")
    print("=" * 60)
    
    try:
        # 使用npx直接运行，避免npm路径问题
        result = subprocess.run(
            ['npx', 'tsx', 'scripts/benchmark-full.ts'],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=3600,  # 1小时超时
            shell=True if platform.system() == 'Windows' else False
        )
        
        print(result.stdout)
        if result.stderr:
            print("错误输出:", result.stderr)
        
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print("❌ 基准测试超时")
        return False
    except Exception as e:
        print(f"❌ 运行失败: {e}")
        return False

def collect_server_test_data():
    """收集服务器测试数据"""
    print("\n" + "=" * 60)
    print("收集服务器测试数据")
    print("=" * 60)
    
    test_prompts = [
        '什么是认知？',
        '记忆如何工作？',
        '解释类比推理',
        '什么是神经网络？',
        '解释机器学习',
    ]
    
    results = []
    
    for server_name, server_config in SERVERS.items():
        port = server_config['port']
        
        if not check_server_health(port):
            print(f"⚠️  {server_name} 服务器未运行，跳过")
            continue
        
        print(f"\n测试 {server_name} 服务器 (端口 {port})...")
        
        for i, prompt in enumerate(test_prompts, 1):
            print(f"  [{i}/{len(test_prompts)}] {prompt[:40]}...", end=' ', flush=True)
            
            try:
                start_time = time.time()
                response = requests.post(
                    f'http://localhost:{port}/infer',
                    json={
                        'prompt': prompt,
                        'maxTokens': 256,
                        'temperature': 0.7,
                    },
                    timeout=60
                )
                latency = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    data = response.json()
                    result = {
                        'server': server_name,
                        'port': port,
                        'prompt': prompt,
                        'success': True,
                        'latency': latency,
                        'tokens': data.get('tokens', 0),
                        'tokensPerSecond': data.get('tokensPerSecond', 0),
                        'duration': data.get('duration', latency),
                        'gpuMemoryUsed': data.get('gpuMemoryUsed', 0),
                        'gpuLoad': data.get('gpuLoad', 0),
                        'timestamp': datetime.now().isoformat(),
                    }
                    print(f"✅ {latency:.0f}ms, {result['tokensPerSecond']:.1f} TPS")
                else:
                    result = {
                        'server': server_name,
                        'port': port,
                        'prompt': prompt,
                        'success': False,
                        'error': f'HTTP {response.status_code}',
                        'latency': latency,
                        'timestamp': datetime.now().isoformat(),
                    }
                    print(f"❌ HTTP {response.status_code}")
                
                results.append(result)
            except Exception as e:
                result = {
                    'server': server_name,
                    'port': port,
                    'prompt': prompt,
                    'success': False,
                    'error': str(e),
                    'latency': 0,
                    'timestamp': datetime.now().isoformat(),
                }
                print(f"❌ {str(e)[:50]}")
                results.append(result)
            
            time.sleep(0.5)
    
    return results

def load_json_reports(reports_dir: Path) -> List[Dict[str, Any]]:
    """加载JSON报告文件"""
    reports = []
    
    if not reports_dir.exists():
        return reports
    
    for json_file in sorted(reports_dir.glob('benchmark-*.json')):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                data['_source_file'] = json_file.name
                reports.append(data)
        except Exception as e:
            print(f"⚠️  无法加载 {json_file}: {e}")
    
    return reports

def export_all_to_csv(server_results: List[Dict], json_reports: List[Dict], output_dir: Path):
    """导出所有数据到CSV"""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 1. 服务器测试结果CSV
    if server_results:
        csv_path = output_dir / f'server_tests_{timestamp}.csv'
        fieldnames = [
            'timestamp', 'server', 'port', 'prompt',
            'success', 'latency', 'tokens', 'tokensPerSecond',
            'duration', 'gpuMemoryUsed', 'gpuLoad', 'error'
        ]
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for result in server_results:
                row = {field: result.get(field, '') for field in fieldnames}
                writer.writerow(row)
        
        print(f"✅ 服务器测试CSV: {csv_path}")
    
    # 2. JSON报告数据CSV
    if json_reports:
        csv_path = output_dir / f'benchmark_metrics_{timestamp}.csv'
        
        # 提取关键指标
        rows = []
        for report in json_reports:
            row = {
                'timestamp': report.get('timestamp', ''),
                'duration': report.get('duration', 0),
                'bwt': report.get('bwt', 0),
                'cognitiveEntropy': report.get('cognitiveEntropy', 0),
                'analogyTransferRate': report.get('analogyTransferRate', 0),
                'calibrationError': report.get('calibrationError', 0),
                'avgLatency': report.get('avgLatency', 0),
                'p50Latency': report.get('p50Latency', 0),
                'p95Latency': report.get('p95Latency', 0),
                'p99Latency': report.get('p99Latency', 0),
                'nodeCount': report.get('nodeCount', 0),
                'edgeCount': report.get('edgeCount', 0),
                'avgKarma': report.get('avgKarma', 0),
                'modularity': report.get('modularity', 0),
            }
            
            # GPU指标
            if 'gpuMetrics' in report and report['gpuMetrics']:
                gpu = report['gpuMetrics']
                row.update({
                    'avgVramUsed': gpu.get('avgVramUsed', 0),
                    'peakVramUsed': gpu.get('peakVramUsed', 0),
                    'avgGpuLoad': gpu.get('avgGpuLoad', 0),
                    'peakGpuLoad': gpu.get('peakGpuLoad', 0),
                    'avgTPS': gpu.get('avgTPS', 0),
                    'TPW': gpu.get('TPW', 0),
                })
            
            rows.append(row)
        
        if rows:
            fieldnames = list(rows[0].keys())
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            
            print(f"✅ 基准指标CSV: {csv_path}")

def generate_comprehensive_report(server_results: List[Dict], json_reports: List[Dict], output_dir: Path):
    """生成综合报告"""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = output_dir / f'comprehensive_report_{timestamp}.md'
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# T-NSEC 3.0 完整基准测试报告\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # 服务器测试结果
        if server_results:
            f.write("## 服务器性能测试\n\n")
            successful = [r for r in server_results if r.get('success', False)]
            
            f.write(f"- **总测试数**: {len(server_results)}\n")
            f.write(f"- **成功数**: {len(successful)}\n")
            f.write(f"- **成功率**: {len(successful)/len(server_results)*100:.1f}%\n\n")
            
            # 按服务器统计
            server_stats = {}
            for result in successful:
                server = result['server']
                if server not in server_stats:
                    server_stats[server] = {'count': 0, 'latencies': [], 'tps': []}
                stats = server_stats[server]
                stats['count'] += 1
                if 'latency' in result:
                    stats['latencies'].append(result['latency'])
                if 'tokensPerSecond' in result:
                    stats['tps'].append(result['tokensPerSecond'])
            
            f.write("### 服务器性能对比\n\n")
            f.write("| 服务器 | 测试数 | 平均延迟(ms) | 平均TPS |\n")
            f.write("|--------|--------|--------------|---------|\n")
            for server_name in ['0.5B', '1.5B', '3B', '14B']:
                if server_name in server_stats:
                    stats = server_stats[server_name]
                    avg_latency = sum(stats['latencies']) / len(stats['latencies']) if stats['latencies'] else 0
                    avg_tps = sum(stats['tps']) / len(stats['tps']) if stats['tps'] else 0
                    f.write(f"| {server_name} | {stats['count']} | {avg_latency:.2f} | {avg_tps:.2f} |\n")
        
        # TypeScript基准测试结果
        if json_reports:
            f.write("\n## TypeScript基准测试结果\n\n")
            
            latest_report = json_reports[-1]  # 使用最新的报告
            
            f.write("### 核心指标\n\n")
            f.write(f"- **BWT (后向迁移)**: {latest_report.get('bwt', 0):.4f}\n")
            f.write(f"- **认知熵**: {latest_report.get('cognitiveEntropy', 0):.4f}\n")
            f.write(f"- **类比迁移率**: {latest_report.get('analogyTransferRate', 0)*100:.2f}%\n")
            f.write(f"- **校准误差 (ECE)**: {latest_report.get('calibrationError', 0):.4f}\n\n")
            
            f.write("### 性能指标\n\n")
            f.write(f"- **平均延迟**: {latest_report.get('avgLatency', 0):.2f} ms\n")
            f.write(f"- **P50延迟**: {latest_report.get('p50Latency', 0):.2f} ms\n")
            f.write(f"- **P95延迟**: {latest_report.get('p95Latency', 0):.2f} ms\n")
            f.write(f"- **P99延迟**: {latest_report.get('p99Latency', 0):.2f} ms\n\n")
            
            f.write("### 图谱指标\n\n")
            f.write(f"- **节点数**: {latest_report.get('nodeCount', 0)}\n")
            f.write(f"- **边数**: {latest_report.get('edgeCount', 0)}\n")
            f.write(f"- **平均Karma**: {latest_report.get('avgKarma', 0):.4f}\n")
            f.write(f"- **模块度**: {latest_report.get('modularity', 0):.4f}\n\n")
            
            if 'gpuMetrics' in latest_report and latest_report['gpuMetrics']:
                gpu = latest_report['gpuMetrics']
                f.write("### GPU指标\n\n")
                f.write(f"- **平均VRAM**: {gpu.get('avgVramUsed', 0):.0f} MB\n")
                f.write(f"- **峰值VRAM**: {gpu.get('peakVramUsed', 0):.0f} MB\n")
                f.write(f"- **平均GPU负载**: {gpu.get('avgGpuLoad', 0):.1f}%\n")
                f.write(f"- **平均TPS**: {gpu.get('avgTPS', 0):.2f} tokens/s\n")
                f.write(f"- **能效比 (TPW)**: {gpu.get('TPW', 0):.2f} tokens/Wh\n\n")
        
        f.write("## 结论\n\n")
        f.write("测试完成。所有数据已导出到CSV文件，可用于论文分析和进一步研究。\n")
    
    print(f"✅ 综合报告: {report_path}")
    return report_path

def generate_charts(server_results: List[Dict], json_reports: List[Dict], output_dir: Path):
    """生成图表"""
    try:
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("⚠️  matplotlib未安装，跳过图表生成")
        print("   安装: pip install matplotlib numpy")
        return None
    
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    successful_results = [r for r in server_results if r.get('success', False)]
    
    if not successful_results and not json_reports:
        print("⚠️  没有数据可绘制")
        return None
    
    fig = plt.figure(figsize=(16, 12))
    
    # 1. 服务器延迟对比
    if successful_results:
        ax1 = plt.subplot(2, 3, 1)
        server_latencies = {}
        for result in successful_results:
            server = result['server']
            if server not in server_latencies:
                server_latencies[server] = []
            if 'latency' in result:
                server_latencies[server].append(result['latency'])
        
        if server_latencies:
            servers = ['0.5B', '1.5B', '3B', '14B']
            data = [server_latencies.get(s, []) for s in servers]
            ax1.boxplot([d for d in data if d], labels=[s for s in servers if s in server_latencies])
            ax1.set_title('服务器延迟对比 (ms)')
            ax1.set_ylabel('延迟 (ms)')
        ax1.grid(True, alpha=0.3)
    
    # 2. 服务器TPS对比
    if successful_results:
        ax2 = plt.subplot(2, 3, 2)
        server_tps = {}
        for result in successful_results:
            server = result['server']
            if server not in server_tps:
                server_tps[server] = []
            if 'tokensPerSecond' in result:
                server_tps[server].append(result['tokensPerSecond'])
        
        if server_tps:
            servers = ['0.5B', '1.5B', '3B', '14B']
            data = [server_tps.get(s, []) for s in servers]
            ax2.boxplot([d for d in data if d], labels=[s for s in servers if s in server_tps])
            ax2.set_title('服务器TPS对比')
            ax2.set_ylabel('TPS (tokens/s)')
        ax2.grid(True, alpha=0.3)
    
    # 3. 延迟分布
    if successful_results:
        ax3 = plt.subplot(2, 3, 3)
        all_latencies = [r['latency'] for r in successful_results if 'latency' in r]
        if all_latencies:
            ax3.hist(all_latencies, bins=30, edgecolor='black', alpha=0.7)
            ax3.set_title('延迟分布')
            ax3.set_xlabel('延迟 (ms)')
            ax3.set_ylabel('频次')
        ax3.grid(True, alpha=0.3)
    
    # 4. 核心指标（如果有JSON报告）
    if json_reports:
        latest = json_reports[-1]
        ax4 = plt.subplot(2, 3, 4)
        metrics = {
            'BWT': latest.get('bwt', 0),
            '认知熵': latest.get('cognitiveEntropy', 0),
            '类比迁移率': latest.get('analogyTransferRate', 0) * 100,
            '校准误差': latest.get('calibrationError', 0) * 100,
        }
        ax4.bar(metrics.keys(), metrics.values())
        ax4.set_title('核心认知指标')
        ax4.set_ylabel('值')
        plt.setp(ax4.xaxis.get_majorticklabels(), rotation=45, ha='right')
        ax4.grid(True, alpha=0.3)
    
    # 5. 性能指标
    if json_reports:
        latest = json_reports[-1]
        ax5 = plt.subplot(2, 3, 5)
        perf_metrics = {
            '平均': latest.get('avgLatency', 0),
            'P50': latest.get('p50Latency', 0),
            'P95': latest.get('p95Latency', 0),
            'P99': latest.get('p99Latency', 0),
        }
        ax5.bar(perf_metrics.keys(), perf_metrics.values())
        ax5.set_title('延迟百分位数 (ms)')
        ax5.set_ylabel('延迟 (ms)')
        ax5.grid(True, alpha=0.3)
    
    # 6. GPU指标
    if json_reports and 'gpuMetrics' in json_reports[-1] and json_reports[-1]['gpuMetrics']:
        gpu = json_reports[-1]['gpuMetrics']
        ax6 = plt.subplot(2, 3, 6)
        gpu_metrics = {
            'VRAM (MB)': gpu.get('avgVramUsed', 0),
            'GPU负载 (%)': gpu.get('avgGpuLoad', 0),
            'TPS': gpu.get('avgTPS', 0),
        }
        ax6.bar(gpu_metrics.keys(), gpu_metrics.values())
        ax6.set_title('GPU性能指标')
        ax6.set_ylabel('值')
        plt.setp(ax6.xaxis.get_majorticklabels(), rotation=45, ha='right')
        ax6.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    chart_path = output_dir / f'benchmark_charts_{timestamp}.png'
    plt.savefig(chart_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"✅ 图表: {chart_path}")
    return chart_path

def main():
    """主函数"""
    print("=" * 60)
    print("T-NSEC 3.0 完整基准测试")
    print("=" * 60)
    print()
    
    # 1. 检查/启动服务器
    servers_running = start_servers()
    
    # 2. 运行TypeScript基准测试
    print("\n" + "=" * 60)
    print("步骤1: 运行TypeScript基准测试")
    print("=" * 60)
    ts_success = run_typescript_benchmark()
    
    # 3. 收集服务器测试数据（如果服务器运行）
    server_results = []
    if servers_running:
        print("\n" + "=" * 60)
        print("步骤2: 收集服务器测试数据")
        print("=" * 60)
        server_results = collect_server_test_data()
    else:
        print("\n⚠️  服务器未运行，跳过服务器测试")
    
    # 4. 加载JSON报告
    reports_dir = project_root / 'reports'
    json_reports = load_json_reports(reports_dir)
    
    if json_reports:
        print(f"\n✅ 加载了 {len(json_reports)} 个JSON报告")
    
    # 5. 创建输出目录
    output_dir = project_root / 'reports' / 'paper_benchmark'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 6. 导出CSV
    print("\n" + "=" * 60)
    print("步骤3: 导出数据")
    print("=" * 60)
    export_all_to_csv(server_results, json_reports, output_dir)
    
    # 7. 生成报告
    print("\n" + "=" * 60)
    print("步骤4: 生成报告")
    print("=" * 60)
    generate_comprehensive_report(server_results, json_reports, output_dir)
    
    # 8. 生成图表
    print("\n" + "=" * 60)
    print("步骤5: 生成图表")
    print("=" * 60)
    generate_charts(server_results, json_reports, output_dir)
    
    # 9. 总结
    print("\n" + "=" * 60)
    print("✅ 测试完成！")
    print("=" * 60)
    print(f"\n所有文件已保存到: {output_dir}\n")

if __name__ == '__main__':
    main()

