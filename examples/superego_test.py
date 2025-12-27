#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
T-NSEC 超我概念验证实验
Superego Test: 验证通过 Karma 权重调节实现行为矫正（无需梯度反向传播）

实验设计：
1. 本我（Id）：模拟 0.5B 模型的幻觉，随机生成错误答案
2. 环境（Truth）：简单的加法计算器（1+1=2）
3. TK-APO（业力）：根据正确性更新 Karma 权重
   - 正确：Karma + 1
   - 错误：Karma - 5（重罚）
4. 超我（Superego）：使用 Karma 权重影响本我的行为选择

实验目标：展示随着时间推移，系统的错误率下降，且不需要梯度反向传播
"""

import random
import sys
import os
import numpy as np
from typing import Dict, List, Tuple
from dataclasses import dataclass
from collections import defaultdict

# 设置 UTF-8 编码（Windows 兼容）
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# 可选的可视化支持
try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


@dataclass
class TrialResult:
    """单次试验结果"""
    iteration: int
    answer: int
    correct: bool
    karma: float
    error_rate: float
    current_error_rate: float  # 滑动窗口平滑后的错误率
    current_karma: float  # 当前 Karma 值


class SuperegoSystem:
    """超我系统：通过 Karma 权重调节本我行为"""
    
    def __init__(self, initial_karma: float = 0.0):
        """
        初始化系统
        
        Args:
            initial_karma: 初始 Karma 值
        """
        self.karma = initial_karma
        self.correct_count = 0
        self.total_count = 0
        self.history: List[TrialResult] = []
        
        # 滑动窗口用于平滑错误率计算
        self.window_size = 50
        self.recent_results: List[bool] = []  # 存储最近的正确/错误结果
        
        # TK-APO 参数
        self.reward_correct = 2.0    # 正确时 Karma + 2（增强奖励，促进学习）
        self.penalty_wrong = -2.0    # 错误时 Karma - 2（适度惩罚）
        
    def id_function(self, question: Tuple[int, int]) -> int:
        """
        本我函数：模拟 0.5B 模型的幻觉
        
        行为规则：
        - 如果 Karma > 0：有 (karma / (karma + 10)) 的概率给出正确答案
        - 如果 Karma <= 0：完全随机（50% 正确率）
        
        Args:
            question: (a, b) 加法问题
            
        Returns:
            答案（可能是错误的）
        """
        a, b = question
        correct_answer = a + b
        
        # 根据 Karma 权重决定行为
        # 使用改进的 sigmoid 函数，即使 Karma 为负也能工作
        # 将 Karma 映射到 [0.2, 0.95] 的概率区间（保留更强的学习能力）
        # 使用 tanh 函数：prob = 0.2 + 0.75 * (tanh(karma/8) + 1) / 2
        # 当 karma = -30 时，prob ≈ 0.25（仍有学习能力）
        # 当 karma = 0 时，prob ≈ 0.58（略高于随机）
        # 当 karma = 30 时，prob ≈ 0.90（很高）
        normalized_karma = np.tanh(self.karma / 8.0)
        prob_correct = 0.2 + 0.75 * (normalized_karma + 1.0) / 2.0
        
        if random.random() < prob_correct:
            return correct_answer
        else:
            # 随机生成错误答案（1-10 之间的随机数，排除正确答案）
            wrong_answers = [i for i in range(1, 11) if i != correct_answer]
            return random.choice(wrong_answers)
    
    def truth_function(self, question: Tuple[int, int]) -> int:
        """
        环境（真理）函数：简单的加法计算器
        
        Args:
            question: (a, b) 加法问题
            
        Returns:
            正确答案
        """
        a, b = question
        return a + b
    
    def update_karma(self, is_correct: bool):
        """
        更新 Karma 权重（TK-APO 核心机制）
        
        Args:
            is_correct: 答案是否正确
        """
        if is_correct:
            self.karma += self.reward_correct
            self.correct_count += 1
        else:
            self.karma += self.penalty_wrong
            # Karma 不能无限负，设置下界为 -30（允许系统有恢复能力）
            self.karma = max(self.karma, -30.0)
        
        self.total_count += 1
        
        # 更新滑动窗口
        self.recent_results.append(is_correct)
        if len(self.recent_results) > self.window_size:
            self.recent_results.pop(0)
    
    def get_error_rate(self) -> float:
        """计算当前错误率（总体）"""
        if self.total_count == 0:
            return 1.0
        return 1.0 - (self.correct_count / self.total_count)
    
    def get_smoothed_error_rate(self) -> float:
        """计算滑动窗口平滑后的错误率"""
        if len(self.recent_results) == 0:
            return 1.0
        
        # 使用最近 window_size 个结果
        window = self.recent_results[-self.window_size:]
        error_count = sum(1 for result in window if not result)
        return error_count / len(window)
    
    def run_trial(self, iteration: int, question: Tuple[int, int] = (1, 1)) -> TrialResult:
        """
        运行一次试验
        
        Args:
            iteration: 迭代次数
            question: 问题（默认 1+1）
            
        Returns:
            试验结果
        """
        # 本我生成答案
        answer = self.id_function(question)
        
        # 环境验证答案
        correct_answer = self.truth_function(question)
        is_correct = (answer == correct_answer)
        
        # 更新 Karma
        old_karma = self.karma
        self.update_karma(is_correct)
        
        # 记录结果
        error_rate = self.get_error_rate()
        smoothed_error_rate = self.get_smoothed_error_rate()
        result = TrialResult(
            iteration=iteration,
            answer=answer,
            correct=is_correct,
            karma=self.karma,
            error_rate=error_rate,
            current_error_rate=smoothed_error_rate,
            current_karma=self.karma
        )
        self.history.append(result)
        
        return result
    
    def run_experiment(self, num_iterations: int = 100, question: Tuple[int, int] = (1, 1)) -> List[TrialResult]:
        """
        运行完整实验
        
        Args:
            num_iterations: 迭代次数
            question: 问题（默认 1+1）
            
        Returns:
            所有试验结果
        """
        print(f"开始实验：验证 T-NSEC 超我概念")
        print(f"问题：{question[0]} + {question[1]} = ?")
        print(f"正确答案：{self.truth_function(question)}")
        print(f"迭代次数：{num_iterations}")
        print(f"初始 Karma：{self.karma}")
        print(f"奖励（正确）：+{self.reward_correct}")
        print(f"惩罚（错误）：{self.penalty_wrong}")
        print("-" * 60)
        
        for i in range(1, num_iterations + 1):
            result = self.run_trial(i, question)
            
            # 每 10 次迭代打印一次进度
            if i % 10 == 0 or i == 1:
                status = "OK" if result.correct else "X"
                print(f"迭代 {i:3d}: 答案={result.answer:2d}, "
                      f"正确={status:2s}, "
                      f"Karma={result.karma:6.2f}, "
                      f"错误率={result.error_rate*100:5.2f}%")
        
        print("-" * 60)
        print(f"实验完成！")
        print(f"最终 Karma：{self.karma:.2f}")
        print(f"最终错误率：{self.get_error_rate()*100:.2f}%")
        print(f"总正确次数：{self.correct_count}/{self.total_count}")
        
        return self.history


def create_academic_visualization(history: List[TrialResult], save_path: str):
    """
    创建学术风格的可视化图表
    
    Args:
        history: 试验历史
        save_path: 保存路径
    """
    if not HAS_MATPLOTLIB:
        print("\n警告：matplotlib 未安装，跳过可视化")
        print("安装命令：pip install matplotlib")
        return
    
    # 设置学术风格
    try:
        plt.style.use('seaborn-v0_8')
    except:
        try:
            plt.style.use('seaborn')
        except:
            plt.style.use('default')
    
    # 提取数据
    iterations = np.array([r.iteration for r in history])
    smoothed_error_rates = np.array([r.current_error_rate * 100 for r in history])  # 转换为百分比
    karmas = np.array([r.current_karma for r in history])
    
    # 创建图形
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))
    fig.suptitle('T-NSEC Superego Learning: Entropy Reduction via Karma Weight Adjustment', 
                 fontsize=14, fontweight='bold', y=0.995)
    
    # 子图1：熵减曲线（错误率 vs 迭代次数）
    ax1.plot(iterations, smoothed_error_rates, 'r-', linewidth=2.5, label='Error Rate (Smoothed)', alpha=0.8)
    
    # 添加趋势线（多项式拟合）
    if len(iterations) > 3:
        try:
            z = np.polyfit(iterations, smoothed_error_rates, deg=min(3, len(iterations)//10))
            p = np.poly1d(z)
            trendline = p(iterations)
            ax1.plot(iterations, trendline, 'r--', linewidth=1.5, alpha=0.6, label='Trendline')
        except:
            pass
    
    ax1.set_xlabel('Iterations', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Error Rate (Smoothed)', fontsize=11, fontweight='bold')
    ax1.set_title('Entropy Reduction Curve', fontsize=12, fontweight='bold', pad=10)
    ax1.grid(True, alpha=0.3, linestyle='--')
    ax1.legend(loc='upper right', fontsize=10)
    ax1.set_ylim([0, max(105, np.max(smoothed_error_rates) * 1.1)])
    
    # 子图2：超我形成（Karma vs 迭代次数）
    ax2.fill_between(iterations, karmas, 0, alpha=0.6, color='blue', label='Cumulative Karma')
    ax2.plot(iterations, karmas, 'b-', linewidth=2, alpha=0.9)
    ax2.axhline(y=0, color='black', linestyle='-', linewidth=0.8, alpha=0.5)
    
    ax2.set_xlabel('Iterations', fontsize=11, fontweight='bold')
    ax2.set_ylabel('Cumulative Karma', fontsize=11, fontweight='bold')
    ax2.set_title('Superego Formation', fontsize=12, fontweight='bold', pad=10)
    ax2.grid(True, alpha=0.3, linestyle='--')
    ax2.legend(loc='upper left', fontsize=10)
    
    # 调整布局
    plt.tight_layout(rect=[0, 0, 1, 0.98])
    
    # 保存图表（不显示）
    plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()  # 关闭图形以释放内存
    
    print(f"\n[成功] 学术可视化图表已保存至：{save_path}")


def visualize_results(history: List[TrialResult], save_path: str = "superego_test_results.png"):
    """
    可视化实验结果（保留旧版本以兼容）
    
    Args:
        history: 试验历史
        save_path: 保存路径
    """
    if not HAS_MATPLOTLIB:
        print("\n警告：matplotlib 未安装，跳过可视化")
        print("安装命令：pip install matplotlib")
        return
    
    iterations = [r.iteration for r in history]
    karmas = [r.karma for r in history]
    error_rates = [r.error_rate * 100 for r in history]  # 转换为百分比
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # 子图1：Karma 变化
    ax1.plot(iterations, karmas, 'b-', linewidth=2, label='Karma 权重')
    ax1.axhline(y=0, color='r', linestyle='--', alpha=0.5, label='Karma = 0')
    ax1.set_xlabel('迭代次数', fontsize=12)
    ax1.set_ylabel('Karma 权重', fontsize=12)
    ax1.set_title('TK-APO 业力权重演化（无需梯度反向传播）', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # 子图2：错误率变化
    ax2.plot(iterations, error_rates, 'r-', linewidth=2, label='错误率', alpha=0.7)
    ax2.fill_between(iterations, error_rates, alpha=0.3, color='red')
    ax2.set_xlabel('迭代次数', fontsize=12)
    ax2.set_ylabel('错误率 (%)', fontsize=12)
    ax2.set_title('系统错误率随时间下降（行为矫正效果）', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    ax2.set_ylim([0, 105])
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"\n图表已保存至：{save_path}")
    
    # 显示图表（如果可能）
    try:
        plt.show()
    except:
        print("（无法显示交互式图表，但已保存图片文件）")


def analyze_results(history: List[TrialResult]):
    """
    分析实验结果
    
    Args:
        history: 试验历史
    """
    if len(history) == 0:
        return
    
    # 分段分析（前1/3、中1/3、后1/3）
    n = len(history)
    early = history[:n//3]
    middle = history[n//3:2*n//3]
    late = history[2*n//3:]
    
    print("\n" + "=" * 60)
    print("实验结果分析")
    print("=" * 60)
    
    print(f"\n【早期阶段】（前 {len(early)} 次迭代）")
    print(f"  平均错误率：{np.mean([r.error_rate for r in early])*100:.2f}%")
    print(f"  平均 Karma：{np.mean([r.karma for r in early]):.2f}")
    print(f"  正确次数：{sum(1 for r in early if r.correct)}/{len(early)}")
    
    print(f"\n【中期阶段】（中间 {len(middle)} 次迭代）")
    print(f"  平均错误率：{np.mean([r.error_rate for r in middle])*100:.2f}%")
    print(f"  平均 Karma：{np.mean([r.karma for r in middle]):.2f}")
    print(f"  正确次数：{sum(1 for r in middle if r.correct)}/{len(middle)}")
    
    print(f"\n【后期阶段】（后 {len(late)} 次迭代）")
    print(f"  平均错误率：{np.mean([r.error_rate for r in late])*100:.2f}%")
    print(f"  平均 Karma：{np.mean([r.karma for r in late]):.2f}")
    print(f"  正确次数：{sum(1 for r in late if r.correct)}/{len(late)}")
    
    # 计算改进幅度
    early_error = np.mean([r.error_rate for r in early])
    late_error = np.mean([r.error_rate for r in late])
    improvement = (early_error - late_error) / early_error * 100 if early_error > 0 else 0
    
    print(f"\n【关键发现】")
    print(f"  错误率改进：{improvement:.2f}%")
    print(f"  最终 Karma：{history[-1].karma:.2f}")
    print(f"  最终错误率：{history[-1].error_rate*100:.2f}%")
    
    if improvement > 0:
        print(f"\n[成功] 验证成功：系统通过 Karma 权重调节实现了行为矫正！")
        print(f"  无需梯度反向传播，仅通过 TK-APO 机制即可降低错误率。")
    else:
        print(f"\n[警告] 需要调整参数：当前设置下改进不明显。")


def main():
    """主函数"""
    # 创建超我系统
    system = SuperegoSystem(initial_karma=0.0)
    
    # 运行实验（100 次迭代，问题：1+1）
    history = system.run_experiment(num_iterations=100, question=(1, 1))
    
    # 分析结果
    analyze_results(history)
    
    # 创建学术可视化
    # 确保目录存在（相对于脚本位置）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # 回到 T-NSEC-CORE 目录
    output_dir = os.path.join(project_root, "docs", "assets")
    os.makedirs(output_dir, exist_ok=True)
    academic_save_path = os.path.join(output_dir, "superego_learning_curve.png")
    create_academic_visualization(history, academic_save_path)
    
    # 保留旧版可视化（可选）
    # visualize_results(history, save_path="superego_test_results.png")


if __name__ == "__main__":
    # 设置随机种子以便复现（可选）
    random.seed(42)
    np.random.seed(42)
    
    main()

