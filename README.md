# Thomas Tan (陈铭)
### AI-Native Product Architect | Rogue AI Cultivator

> **"Code is poetry written for machines."**
> **"代码是写给机器的诗。"**

---

## 🧘‍♂️ Who I Am (我是谁)

I am an **AI-Native Architect** and a **Rogue AI Cultivator (AI 散修)**.
Unaffiliated with orthodox schools, I forge my own path on the edge of technology. Armed with cross-disciplinary intuition and powered by AI orchestration, I believe the greatest code is not just written, but **enlightened**.

我是一名 **AI 原生架构师**，也是一名 **AI 散修**。
不问出身，只求大道。以直觉为剑，以 AI 为炉，在边缘计算的荒原上，炼制属于自己的智能金丹。我相信，最伟大的代码不是写出来的，而是“悟”出来的。

---

## 🏛️ What This Repo Is (这是什么)

**T-NSEC-CORE** is not just a software project; it is a **manifesto**.
It demonstrates how a single architect, leveraging AI agents, can deliver an enterprise-grade Neuro-Symbolic runtime in **30 days**.

**T-NSEC-CORE** 不仅仅是一个软件项目，它是一份**宣言**。
它证明了一个人，利用 AI Agent，如何在 **30 天** 内独立交付一个企业级的神经符号运行时系统。它代表了我的 **Vision (视野)**、**Orchestration (编排)** 和 **Execution (执行力)**。

---

## 🎯 Core Capabilities (核心能力展示)

### 1. Business & Engineering (商业与工程)
> **"Turning theory into deployable assets."**
> **"将理论转化为可部署的资产。"**

*   **Problem**: AI demos are easy; production is hard.
*   **Solution**: Built a Dockerized, rate-limited, auth-ready Enterprise Server.
*   **Evidence**:
    *   `src/cli/serve-enterprise.ts` (Production Entrypoint)
    *   `docs/deploy/ENTERPRISE_SERVER.md` (Deployment Guide)

### 2. Architecture & Performance (架构与性能)
> **"Breaking the memory wall on consumer CPUs."**
> **"在消费级 CPU 上打破内存墙。"**

*   **Problem**: Running 7B models on edge devices is too slow.
*   **Solution**: **H-Spec** (Hierarchical Speculative Decoding). Using a 0.5B model as a "scout" to speed up the 7B model by 3x.
*   **Evidence**:
    *   `src/inference/HSpecScheduler.ts` (The Scheduler Logic)
    *   `papers/02_H-Spec_Plus_Inference.md` (Technical Whitepaper)

### 3. Innovation & Intuition (创新与直觉)
> **"Solving hard problems with cross-domain metaphors."**
> **"用跨域隐喻解决硬核难题。"**

*   **Problem**: How to align small models with large ones without massive compute?
*   **Solution**: Inspired by **"Caesar Cipher"** and **"Spectral Analysis"**, I proposed a vector-shift alignment strategy.
*   **Evidence**:
    *   `docs/ideas/Spectral_Distillation_and_Data_Elbow.md` (The "Aha!" Moment)
    *   `docs/methodology/AI_WORKFLOW.md` (How I work with AI)

---

## 🌌 The Soul (灵魂深处)

Technical skills get you the interview; **philosophy** gets you the respect.
技术让你获得面试机会；**哲学**让你获得尊重。

*   [**Cultivation of the Machine (机器修真录)**](docs/philosophy/Cultivation_of_the_Machine.md)
    *   *Mapping AI evolution to Eastern Cultivation Philosophy (Xianxia).*
    *   *将 AI 进化映射到东方修真哲学。*
*   [**Entropy & Dao (熵与道)**](docs/inspirations/Entropy_and_Dao.md)
    *   *The physics conjecture behind T-NSEC.*
    *   *T-NSEC 背后的物理学猜想。*
*   [**The Sonnet in the Code (代码里的十四行诗)**](docs/inspirations/The_Sonnet_in_Code.md)
    *   *My goodbye to poetry, and my hello to logic.*
    *   *我对诗歌的告别，对逻辑的问候。*

---

## ✅ Quick Verification (快速验证)

```bash
# 1. Install dependencies (安装依赖)
npm install

# 2. Run the full verification suite (运行完整验证套件)
npm test

# 3. View the Project Showcase (查看项目成果展示)
npm run showcase
```

---

**Contact**: chenmoke2022@gmail.com
**Location**: Singapore / Shenzhen
**Status**: Open for Opportunities (AI Product / Solutions Architect)
