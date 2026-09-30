import type { Analysis } from "../../types";
import {
  coerceActions, coerceAnalyze, coerceDecisions, coerceHighlights, coerceSummary, digestOf, finalize,
  type AnalyzeOut,
} from "./assemble";
import { AIError } from "./errors";
import { callJSON, type Complete } from "./json";
import {
  actionsPrompt, analyzePrompt, decisionsPrompt, highlightsPrompt, summaryPrompt, type AnalysisInput,
} from "./prompts";

/**
 * The node bodies of the analysis workflow. langgraph wires them together
 * (analysis-graph.ts); keeping them free of framework imports makes them
 * testable with a fake model.
 */
export const nodes = {
  analyze: (c: Complete, i: AnalysisInput) => {
    const p = analyzePrompt(i);
    return callJSON(c, p.system, p.user, (r) => coerceAnalyze(r, i));
  },
  summary: (c: Complete, i: AnalysisInput, a: AnalyzeOut) => {
    const p = summaryPrompt(i, digestOf(a));
    return callJSON(c, p.system, p.user, coerceSummary);
  },
  decisions: (c: Complete, i: AnalysisInput) => {
    const p = decisionsPrompt(i);
    return callJSON(c, p.system, p.user, (r) => coerceDecisions(r, i));
  },
  actions: (c: Complete, i: AnalysisInput) => {
    const p = actionsPrompt(i);
    return callJSON(c, p.system, p.user, (r) => coerceActions(r, i));
  },
  highlights: (c: Complete, i: AnalysisInput, a: AnalyzeOut) => {
    const p = highlightsPrompt(i, digestOf(a));
    return callJSON(c, p.system, p.user, (r) => coerceHighlights(r, i));
  },
  finalize,
};

export { STEPS } from "../../steps";

/** Single-pass limit. ~100k characters is roughly 25k tokens, about two hours of speech. */
export const MAX_TRANSCRIPT_CHARS = 100_000;

export function assertAnalyzable(i: AnalysisInput) {
  const chars = i.segments.reduce((n, s) => n + s.text.length + 30, 0);
  if (chars > MAX_TRANSCRIPT_CHARS)
    throw new AIError("empty", `This transcript is too long to analyse in one pass (${Math.round(chars / 1000)}k characters; limit ${MAX_TRANSCRIPT_CHARS / 1000}k).`);
  if (i.segments.length < 3) throw new AIError("empty", "This transcript is too short to analyse (needs at least 3 segments).");
}

/** Sequential reference run of the same nodes, used by tests. */
export async function runSequential(c: Complete, i: AnalysisInput, modelName: string): Promise<Analysis> {
  assertAnalyzable(i);
  const analyze = await nodes.analyze(c, i);
  const summary = await nodes.summary(c, i, analyze);
  const decisions = await nodes.decisions(c, i);
  const actions = await nodes.actions(c, i);
  const highlights = await nodes.highlights(c, i, analyze);
  return finalize(i, modelName, { analyze, summary, decisions, actions, highlights });
}
