/**
 * InferenceEngine - minimal inference abstraction used by HSpecScheduler/SystemSupervisor.
 *
 * Public (open-source) baseline:
 * - Uses the project-local `LocalLLM` simulation by default.
 * - Provides a stable interface for scheduling/benchmarking code.
 * - Does NOT require GGUF assets in repo.
 */

import { LocalLLM } from '../llm/LocalLLM.js';

export type TaskLevel = 'L1' | 'L2' | 'L3' | 'PLANNING';

export type TaskConfig = {
  level: TaskLevel;
  useHSpec: boolean;
  maxTokens: number;
  temperature: number;
};

export type InferenceEngineConfig = {
  // Legacy-compatible fields (kept to avoid breaking benchmark scripts)
  modelPath?: string;
  contextSize?: number;
  gpuConfig?: Record<string, unknown>;

  // Explicit draft/verify (preferred)
  draftModelPath?: string;
  verifyModelPath?: string;
};

export type InferenceResult = {
  text: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  duration: number; // ms
  tokensPerSecond: number;
  gpuMemoryUsed: number; // MB (0 for CPU-only baseline)
  gpuLoad: number; // %  (0 for CPU-only baseline)
  usedHSpec: boolean;
  acceptedTokens?: number;
  totalDraftTokens?: number;
  acceptanceRate?: number;
};

export type GPUStatus = {
  name: string;
  vramTotal: number;
  vramUsed: number;
  vramFree: number;
  gpuLoad: number;
  temperature: number;
  cudaAvailable: boolean;
};

export class InferenceEngine {
  private draft: LocalLLM;
  private verify: LocalLLM;

  constructor(config?: InferenceEngineConfig | { draft?: LocalLLM; verify?: LocalLLM }) {
    // Allow passing LocalLLM instances directly
    const asAny = config as any;
    if (asAny?.draft instanceof LocalLLM || asAny?.verify instanceof LocalLLM) {
      this.draft =
        asAny.draft ??
        new LocalLLM({ modelPath: './models/qwen2.5-0.5b-instruct-q4_k_m.gguf', maxTokens: 256, temperature: 0.7 });
      this.verify =
        asAny.verify ??
        new LocalLLM({ modelPath: './models/qwen2.5-7b-instruct-q4_k_m.gguf', maxTokens: 256, temperature: 0.7 });
      return;
    }

    const cfg = config as InferenceEngineConfig | undefined;
    const draftPath = cfg?.draftModelPath || './models/qwen2.5-0.5b-instruct-q4_k_m.gguf';
    const verifyPath =
      cfg?.verifyModelPath ||
      // legacy: if only modelPath is provided, treat it as verify
      cfg?.modelPath ||
      './models/qwen2.5-7b-instruct-q4_k_m.gguf';

    this.draft = new LocalLLM({ modelPath: draftPath, maxTokens: 256, temperature: 0.7 });
    this.verify = new LocalLLM({ modelPath: verifyPath, maxTokens: 256, temperature: 0.7 });
  }

  async initialize(): Promise<void> {
    // Ensure models are "loaded" for a stable baseline (simulation mode).
    await Promise.allSettled([this.draft.load(), this.verify.load()]);
  }

  async dispose(): Promise<void> {
    await Promise.allSettled([this.draft.unload(), this.verify.unload()]);
  }

  async infer(prompt: string, config?: Partial<TaskConfig>): Promise<InferenceResult> {
    const useHSpec = Boolean(config?.useHSpec);
    const maxTokens = typeof config?.maxTokens === 'number' ? config!.maxTokens : 256;
    const temperature = typeof config?.temperature === 'number' ? config!.temperature : 0.7;

    // keep verify config consistent for simulated engine
    // (LocalLLM uses its own internal generator; temperature/maxTokens are used only as metadata here)
    void maxTokens;
    void temperature;

    if (!useHSpec) {
      const r = await this.verify.infer(prompt);
      const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
      return {
        text: r.text,
        tokens: r.tokens,
        promptTokens,
        completionTokens: r.tokens,
        duration: r.duration,
        tokensPerSecond: r.tokensPerSecond,
        gpuMemoryUsed: 0,
        gpuLoad: 0,
        usedHSpec: false,
      };
    }

    // Simulated speculative decoding: draft -> verify with partial acceptance
    const draftTokens = Number.parseInt(process.env.T_NSEC_HSPEC_DRAFT_TOKENS || '8', 10);
    const dv = await this.verify.createDraftVerify(prompt, this.draft, Number.isFinite(draftTokens) ? draftTokens : 8);

    // For the public baseline, approximate latency/TPS by running verify infer once more on final text.
    // This keeps result shape stable for scheduler stats.
    const r = await this.verify.infer(prompt);
    const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
    return {
      text: dv.finalText,
      tokens: r.tokens,
      promptTokens,
      completionTokens: r.tokens,
      duration: r.duration,
      tokensPerSecond: r.tokensPerSecond,
      gpuMemoryUsed: 0,
      gpuLoad: 0,
      usedHSpec: true,
      acceptedTokens: dv.acceptedTokens,
      totalDraftTokens: dv.totalDraftTokens,
      acceptanceRate: dv.acceptanceRate,
    };
  }

  async getGPUStatus(): Promise<GPUStatus | null> {
    return null;
  }
}


