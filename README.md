# T-NSEC-CORE
### Edge-First Neuro-Symbolic Runtime | Thomas Lab

> **Status**: Experimental / Proof-of-Concept
> **Author**: Thomas Tan (陈铭) - *Rogue AI Cultivator*

---

## 🙋‍♂️ About Me & This Project (关于我与本项目)

我是 **Thomas**，一名 AI 领域的“散修”。
我没有大厂背景，也没有顶会论文。我有的只是**对技术本质的直觉**和**用 AI 解决问题的执行力**。

这个项目 **T-NSEC-CORE** 是我在 **30 天** 内，利用 AI Agent 辅助，从 0 到 1 构建的一个**边缘计算智能运行时**。
它不是为了炫技，而是为了解决我在实际业务（WhatsApp 智能客服）中遇到的真实痛点：**云端 GPU 太贵，本地小模型太蠢。**

**核心能力自述**：
*   **不写废代码**：我擅长定义架构、设计接口、编写 Prompt，让 AI 完成 99% 的体力活。
*   **不盲从主流**：当所有人都在卷 GPU 算力时，我选择死磕 **CPU 优化** 和 **存算分离**。
*   **结果导向**：代码必须能跑，数据必须真实。

---

## 🛠️ What I Built (我造了什么)

为了在低成本硬件（如笔记本、树莓派）上跑通企业级 AI，我设计并实现了以下核心模块：

### 1. 解决“慢”的问题 —— H-Spec
*   **痛点**：在 CPU 上跑 7B 模型，每秒只能出 2-3 个字，用户等不起。
*   **我的解法**：**分层推测解码 (Hierarchical Speculation)**。
    *   用一个极小的 0.5B 模型（Draft）疯狂“猜”后面的词。
    *   用 7B 模型（Verify）批量“批改”作业。
*   **成果**：在测试中实现了 **3x** 的推理加速。
    *   *Code*: `src/inference/HSpecScheduler.ts`
    *   *Paper*: `papers/02_H-Spec_Plus_Inference.md`

### 2. 解决“蠢”的问题 —— SGE
*   **痛点**：传统的 RAG（向量检索）经常搜出一堆无关片段，导致模型胡说八道。
*   **我的解法**：**稀疏图编码 (Sparse Graph Encoding)**。
    *   不只搜“关键词”，而是搜“知识结构（子图）”。
    *   利用 Weighted PPR 算法，把相关的上下文“顺藤摸瓜”找出来。
*   **成果**：显著减少了幻觉，提升了回答的逻辑性。
    *   *Code*: `src/graph/HSGE.ts`
    *   *Paper*: `papers/04_SGE_Graph_Encoding.md`

### 3. 解决“贵”的问题 —— TK-APO
*   **痛点**：微调（Fine-tuning）模型需要昂贵的显卡，且容易“学了新知识，忘了旧知识”。
*   **我的解法**：**时间-业力优化 (TK-APO)**。
    *   不动模型参数，只动图谱权重。
    *   模拟人脑：常用的知识（高 Karma）保留，不用的知识（低 Karma）随时间遗忘。
*   **成果**：实现了**零梯度的持续学习**。
    *   *Code*: `src/evolution/TKAPOCalibrator.ts`
    *   *Paper*: `papers/03_TK-APO_Continual_Learning.md`

---

## 📂 Lab Assets (实验室资产)

这里存放了我所有的研究手稿和实验数据。虽然我是散修，但我用**学术界的标准**要求自己。

*   **Research Matrix (研究索引)**: `docs/research/README.md` (16 篇论文的完整规划)
*   **Evidence Bundle (证据链)**: `benchmark/Research_Evidence_Bundle/README.md` (所有 CSV 和图表)
*   **Philosophy (设计哲学)**: `docs/philosophy/Cultivation_of_the_Machine.md` (为何我把 AI 进化比作“修真”)

---

## 💻 Deploy & Verify (如何验证)

我不喜欢空谈。你可以直接拉取代码，在你的电脑上跑起来。

```bash
# 1. 安装依赖
npm install

# 2. 运行完整测试套件 (包含 HDC, Graph, H-Spec)
npm test

# 3. 查看项目成果展示 (CLI Dashboard)
npm run showcase
```

如果你想看**生产环境**的样子：
*   查看 `docs/deploy/ENTERPRISE_SERVER.md`。
*   运行 `npm run serve`，启动一个带鉴权和限流的 API 服务器。

---

**Contact**: `chenmoke2022@gmail.com`
**Location**: Singapore / Shenzhen
