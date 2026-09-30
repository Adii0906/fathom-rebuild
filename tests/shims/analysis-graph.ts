// Test shim for src/lib/ai/analysis-graph.ts: same node functions, run sequentially with a fake model.
import { AIError } from "./core/errors";
import { runSequential } from "./core/nodes";
import { STEPS } from "../steps";
import type { AnalysisInput } from "./core/prompts";
import { fakeComplete } from "../../../tests/fake-model";
import type { Analysis } from "../types";

export async function runAnalysis(
  input: AnalysisInput,
  onStep?: (e: { step: string; label: string; index: number; total: number }) => void,
): Promise<Analysis> {
  const g = globalThis as { __AI_MODE?: string };
  if (g.__AI_MODE === "no_key") throw new AIError("no_key", "GROQ_API_KEY is not set.");
  STEPS.forEach((s, i) => onStep?.({ step: s.id, label: s.label, index: i + 1, total: STEPS.length }));
  return runSequential(fakeComplete, input, "fake-model");
}
