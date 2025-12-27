#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
压力测试结果可视化脚本
生成学术风格的压力测试图表
"""

import csv
import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

# 设置学术风格
try:
    plt.style.use('seaborn-v0_8')
except:
    try:
        plt.style.use('seaborn')
    except:
        plt.style.use('default')

# 设置中文字体（如果需要）
plt.rcParams['font.sans-serif'] = ['Arial', 'DejaVu Sans', 'Liberation Sans']
plt.rcParams['axes.unicode_minus'] = False


def load_csv_data(csv_path: str):
    """加载 CSV 数据"""
    items_count = []
    retrieval_rank = []
    ram_usage_mb = []
    time_elapsed = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            items_count.append(int(row['Items_Count']))
            retrieval_rank.append(int(row['Retrieval_Rank']))
            ram_usage_mb.append(float(row['RAM_Usage_MB']))
            time_elapsed.append(float(row['Time_Elapsed']))
    
    return items_count, retrieval_rank, ram_usage_mb, time_elapsed


def plot_stress_test(csv_path: str, output_path: str):
    """生成压力测试可视化图表"""
    # 加载数据
    items_count, retrieval_rank, ram_usage_mb, time_elapsed = load_csv_data(csv_path)
    
    # 转换为 numpy 数组
    items_count = np.array(items_count)
    retrieval_rank = np.array(retrieval_rank)
    ram_usage_mb = np.array(ram_usage_mb)
    time_elapsed = np.array(time_elapsed)
    
    # 创建图形（3 个子图）
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 10))
    fig.suptitle('T-NSEC Graph Memory Stress Test: 100k Items Performance', 
                 fontsize=14, fontweight='bold', y=0.995)
    
    # 子图1: Retrieval Rank（应该是平坦的线，值为 1）
    ax1.plot(items_count, retrieval_rank, 'r-', linewidth=2.5, marker='o', 
             markersize=6, label='Golden Memory Rank', alpha=0.8)
    ax1.axhline(y=1, color='green', linestyle='--', linewidth=1.5, 
                alpha=0.6, label='Target Rank = 1')
    ax1.set_xlabel('Items Count', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Retrieval Rank', fontsize=11, fontweight='bold')
    ax1.set_title('Retrieval Stability: Golden Memory Rank Over Time', 
                  fontsize=12, fontweight='bold', pad=10)
    ax1.grid(True, alpha=0.3, linestyle='--')
    ax1.legend(loc='upper right', fontsize=10)
    ax1.set_ylim([0, max(2, np.max(retrieval_rank) * 1.2)])
    # 设置 y 轴刻度为整数
    ax1.set_yticks(range(int(np.max(retrieval_rank)) + 2))
    
    # 子图2: RAM Usage（应该是线性的）
    ax2.plot(items_count, ram_usage_mb, 'b-', linewidth=2.5, marker='s', 
             markersize=6, label='RAM Usage', alpha=0.8)
    
    # 添加线性拟合线
    if len(items_count) > 1:
        z = np.polyfit(items_count, ram_usage_mb, 1)
        p = np.poly1d(z)
        trendline = p(items_count)
        ax2.plot(items_count, trendline, 'b--', linewidth=1.5, 
                alpha=0.6, label=f'Linear Fit (slope={z[0]:.4f} MB/item)')
    
    ax2.set_xlabel('Items Count', fontsize=11, fontweight='bold')
    ax2.set_ylabel('RAM Usage (MB)', fontsize=11, fontweight='bold')
    ax2.set_title('Memory Efficiency: Linear Growth Pattern', 
                  fontsize=12, fontweight='bold', pad=10)
    ax2.grid(True, alpha=0.3, linestyle='--')
    ax2.legend(loc='upper left', fontsize=10)
    
    # 子图3: Time Elapsed
    ax3.plot(items_count, time_elapsed, 'g-', linewidth=2.5, marker='^', 
             markersize=6, label='Time Elapsed', alpha=0.8)
    
    # 添加趋势线（可能是二次或线性）
    if len(items_count) > 1:
        # 尝试二次拟合
        z2 = np.polyfit(items_count, time_elapsed, 2)
        p2 = np.poly1d(z2)
        trendline2 = p2(items_count)
        ax3.plot(items_count, trendline2, 'g--', linewidth=1.5, 
                alpha=0.6, label='Quadratic Fit')
    
    ax3.set_xlabel('Items Count', fontsize=11, fontweight='bold')
    ax3.set_ylabel('Time Elapsed (seconds)', fontsize=11, fontweight='bold')
    ax3.set_title('Processing Time: Scalability Analysis', 
                  fontsize=12, fontweight='bold', pad=10)
    ax3.grid(True, alpha=0.3, linestyle='--')
    ax3.legend(loc='upper left', fontsize=10)
    
    # 调整布局
    plt.tight_layout(rect=[0, 0, 1, 0.98])
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    
    # 保存图表
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    
    print(f"[成功] 图表已保存至: {output_path}")


def main():
    """主函数"""
    # 获取脚本所在目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # 设置路径（CSV 可能在项目根目录的 benchmark 下）
    csv_paths = [
        project_root / 'benchmark' / 'stress_test_100k.csv',
        project_root.parent / 'benchmark' / 'stress_test_100k.csv',
    ]
    
    csv_path = None
    for path in csv_paths:
        if path.exists():
            csv_path = path
            break
    
    output_path = project_root / 'docs' / 'assets' / 'stress_test_100k.png'
    
    # 检查 CSV 文件是否存在
    if not csv_path.exists():
        print(f"[错误] CSV 文件不存在: {csv_path}")
        sys.exit(1)
    
    # 生成图表
    plot_stress_test(str(csv_path), str(output_path))


if __name__ == "__main__":
    main()

