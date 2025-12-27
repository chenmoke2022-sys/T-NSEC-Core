#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_spectral_alignment.py

目的（Spectral Loss/频谱对齐最小实验入口）：
- 不改训练代码，先验证一个可测的现象：对齐后的向量在“频域能量分布”上是否更接近 teacher。
- 产物：CSV + PNG（分布图）+ Markdown 报告（可作为后续 Spectral Loss 的对照基线）。

依赖：
- Python 3.12.7
- numpy, requests, matplotlib（可选，但推荐）

默认使用 Ollama embeddings API：
- http://localhost:11434/api/embeddings
你需要本机已安装并启动 Ollama，并且存在可用模型（可通过 `ollama list` 查看）。

注意：
- 本脚本不会宣称“Spectral Loss 有效”，它只提供频域度量的“baseline测量”。
- 真正的 Spectral Loss A/B 需要你在训练脚本里加入 loss 后再跑一遍生成对比 CSV/图。
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import requests


DEFAULT_TEXTS: List[str] = [
    "用一句话解释什么是神经符号系统。",
    "给出一个类比：太阳系与原子结构。",
    "解释一下灾难性遗忘以及一种缓解思路。",
    "为什么 CPU-first 对边缘 AI 很重要？",
    "给出 3 条建议：如何让回答更一致、更少幻觉。",
    "规划一个机器人取水任务的步骤（尽量简洁）。",
    "解释 PageRank 的直觉含义，并说明个性化 PageRank 用在哪。",
    "用 2-3 句总结 TK-APO 的核心公式与含义。",
    "如何用图谱做上下文压缩？给一个例子。",
    "解释“输出口径约束”为什么能提升相似度分布。",
]


@dataclass
class SampleResult:
    text: str
    cosine: float
    spec_mse: float
    spec_cosine: float


def l2_normalize(x: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(x)
    if n == 0:
        return x
    return x / n


def rfft_mag(x: np.ndarray) -> np.ndarray:
    # 使用 rfft 幅度谱（更稳健），避免相位噪声
    f = np.fft.rfft(x.astype(np.float32))
    return np.abs(f).astype(np.float32)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    a = l2_normalize(a)
    b = l2_normalize(b)
    return float(np.dot(a, b))


def ollama_embeddings(base_url: str, model: str, text: str, timeout_s: int = 30) -> np.ndarray:
    url = base_url.rstrip("/") + "/api/embeddings"
    payload = {"model": model, "prompt": text}
    r = requests.post(url, json=payload, timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    emb = data.get("embedding")
    if not emb:
        raise RuntimeError(f"Ollama embeddings returned empty embedding for model={model}")
    return np.asarray(emb, dtype=np.float32)


def load_alignment_matrix(w_path: Path) -> np.ndarray:
    """
    W_v2_1.npy 预期形状：
    - (teacher_dim, draft_dim) 或 (draft_dim, teacher_dim)
    我们自动判断并在映射时处理转置。
    """
    w = np.load(str(w_path)).astype(np.float32)
    if w.ndim != 2:
        raise ValueError(f"W must be 2D, got shape={w.shape}")
    return w


def map_draft_to_teacher(W: np.ndarray, draft: np.ndarray, teacher_dim_hint: int | None = None) -> np.ndarray:
    """
    尝试两种方向：
    - teacher = W @ draft
    - teacher = W.T @ draft
    以输出维度更接近 teacher_dim_hint 的为准；没有 hint 时优先 W @ draft 可行者。
    """
    candidates: List[Tuple[str, np.ndarray]] = []
    try:
        cand = W @ draft
        candidates.append(("W@draft", cand))
    except Exception:
        pass
    try:
        cand = W.T @ draft
        candidates.append(("W.T@draft", cand))
    except Exception:
        pass

    if not candidates:
        raise RuntimeError(f"Cannot apply W to draft: W={W.shape}, draft={draft.shape}")

    if teacher_dim_hint is None:
        return candidates[0][1]

    # 选择输出维度最接近 teacher_dim_hint 的
    candidates.sort(key=lambda kv: abs(kv[1].shape[0] - teacher_dim_hint))
    return candidates[0][1]


def ensure_deps_for_plot() -> Tuple[bool, Any]:
    try:
        import matplotlib.pyplot as plt  # type: ignore
        return True, plt
    except Exception:
        return False, None


def percentile(xs: List[float], p: float) -> float:
    if not xs:
        return 0.0
    xs_sorted = sorted(xs)
    k = (len(xs_sorted) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(xs_sorted[int(k)])
    d0 = xs_sorted[f] * (c - k)
    d1 = xs_sorted[c] * (k - f)
    return float(d0 + d1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ollama", default="http://localhost:11434", help="Ollama base url")
    ap.add_argument("--draft-model", default="qwen2.5:0.5b", help="Ollama model for draft embeddings")
    ap.add_argument("--teacher-model", default="qwen2.5:7b", help="Ollama model for teacher embeddings")
    ap.add_argument("--w", default="benchmark/qwen-sentence-align/artifacts/W_v2_1.npy", help="Alignment matrix path")
    ap.add_argument("--out-dir", default="benchmark/qwen-sentence-align/reports/spectral", help="Output directory")
    ap.add_argument("--n", type=int, default=len(DEFAULT_TEXTS), help="How many texts to test")
    args = ap.parse_args()

    w_path = Path(args.w)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 0) health check ollama
    try:
        r = requests.get(args.ollama.rstrip("/") + "/api/tags", timeout=5)
        if r.status_code != 200:
            raise RuntimeError(f"unexpected status: {r.status_code}")
    except Exception as e:
        print("[ERROR] Ollama is not reachable. Please start Ollama first.")
        print("        Expected endpoint: http://localhost:11434/api/tags")
        print(f"        Details: {e}")
        print("\nIf you don't use Ollama, you can still keep this script as a planned experiment entry.")
        raise SystemExit(2)

    if not w_path.exists():
        print(f"[ERROR] Missing alignment matrix: {w_path}")
        raise SystemExit(2)

    W = load_alignment_matrix(w_path)

    texts = DEFAULT_TEXTS[: max(1, min(args.n, len(DEFAULT_TEXTS)))]
    results: List[SampleResult] = []

    print(f"[INFO] texts={len(texts)}")
    print(f"[INFO] draft-model={args.draft_model}, teacher-model={args.teacher_model}")
    print(f"[INFO] W shape={W.shape}")

    for i, t in enumerate(texts, 1):
        print(f"[{i}/{len(texts)}] embedding...")
        d = ollama_embeddings(args.ollama, args.draft_model, t)
        te = ollama_embeddings(args.ollama, args.teacher_model, t)

        mapped = map_draft_to_teacher(W, d, teacher_dim_hint=te.shape[0])
        mapped = l2_normalize(mapped)
        te = l2_normalize(te)

        cos = cosine(mapped, te)

        mag_m = rfft_mag(mapped)
        mag_t = rfft_mag(te)
        # pad to same length (rfft length differs by dim)
        L = max(mag_m.shape[0], mag_t.shape[0])
        if mag_m.shape[0] != L:
            mag_m = np.pad(mag_m, (0, L - mag_m.shape[0]))
        if mag_t.shape[0] != L:
            mag_t = np.pad(mag_t, (0, L - mag_t.shape[0]))

        mag_m = l2_normalize(mag_m)
        mag_t = l2_normalize(mag_t)
        spec_mse = float(np.mean((mag_m - mag_t) ** 2))
        spec_cos = float(np.dot(mag_m, mag_t))

        results.append(SampleResult(text=t, cosine=cos, spec_mse=spec_mse, spec_cosine=spec_cos))

    # write csv
    csv_path = out_dir / "spectral_alignment_baseline.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("idx,cosine,spec_mse,spec_cosine,text\n")
        for i, r in enumerate(results, 1):
            safe = r.text.replace("\n", " ").replace("\r", " ")
            f.write(f"{i},{r.cosine:.6f},{r.spec_mse:.8f},{r.spec_cosine:.6f},{json.dumps(safe, ensure_ascii=False)}\n")

    cosines = [r.cosine for r in results]
    spec_mses = [r.spec_mse for r in results]
    spec_coses = [r.spec_cosine for r in results]

    # report
    report_path = out_dir / "spectral_alignment_baseline_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Spectral Alignment Baseline (No Spectral Loss)\n\n")
        f.write("This is a **baseline measurement** of frequency-domain similarity between:\n\n")
        f.write("- mapped draft embedding: `mapped = W * draft_emb`\n")
        f.write("- teacher embedding: `teacher_emb`\n\n")
        f.write("## Setup\n\n")
        f.write(f"- Ollama: `{args.ollama}`\n")
        f.write(f"- Draft model: `{args.draft_model}`\n")
        f.write(f"- Teacher model: `{args.teacher_model}`\n")
        f.write(f"- W: `{w_path.as_posix()}` (shape={tuple(W.shape)})\n")
        f.write(f"- Samples: {len(results)}\n\n")
        f.write("## Metrics\n\n")
        f.write("- `cosine`: cosine(mapped, teacher)\n")
        f.write("- `spec_mse`: MSE(|RFFT(mapped)|, |RFFT(teacher)|) on L2-normalized magnitude spectrum\n")
        f.write("- `spec_cosine`: cosine similarity between normalized magnitude spectra\n\n")
        f.write("## Summary\n\n")
        f.write(f"- cosine: mean={float(np.mean(cosines)):.6f}, p50={percentile(cosines, 0.50):.6f}, p95={percentile(cosines, 0.95):.6f}\n")
        f.write(f"- spec_mse: mean={float(np.mean(spec_mses)):.8f}, p50={percentile(spec_mses, 0.50):.8f}, p95={percentile(spec_mses, 0.95):.8f}\n")
        f.write(f"- spec_cosine: mean={float(np.mean(spec_coses)):.6f}, p50={percentile(spec_coses, 0.50):.6f}, p95={percentile(spec_coses, 0.95):.6f}\n")
        f.write("\n## Artifacts\n\n")
        f.write(f"- CSV: `{csv_path.as_posix()}`\n")
        f.write(f"- Report: `{report_path.as_posix()}`\n")

    # plot (optional)
    has_plot, plt = ensure_deps_for_plot()
    if has_plot:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))
        axes[0].hist(cosines, bins=10, edgecolor="black", alpha=0.8)
        axes[0].set_title("Cosine(mapped, teacher)")
        axes[0].set_xlabel("cosine")
        axes[0].set_ylabel("count")

        axes[1].hist(spec_mses, bins=10, edgecolor="black", alpha=0.8)
        axes[1].set_title("Spectral MSE (mag spectrum)")
        axes[1].set_xlabel("spec_mse")
        axes[1].set_ylabel("count")

        plt.tight_layout()
        png_path = out_dir / "spectral_alignment_baseline.png"
        plt.savefig(png_path, dpi=200)
        plt.close()
        print(f"[OK] plot: {png_path}")
    else:
        print("[WARN] matplotlib not installed; skip plot")

    print(f"[OK] csv: {csv_path}")
    print(f"[OK] report: {report_path}")


if __name__ == "__main__":
    main()


