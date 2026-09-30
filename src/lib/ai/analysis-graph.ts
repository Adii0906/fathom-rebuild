import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ActionItem, Analysis, Decision, Highlight } from "../types";
import type { AnalyzeOut } from "./core/assemble";
import { toAIError } from "./core/errors";
import type { Complete } from "./core/json";
import { assertAnalyzable, nodes } from "./core/nodes";
import { STEPS } from "../steps";
import type { AnalysisInput } from "./core/prompts";
import { groqComplete, groqModel } from "./model";

/**
 * Meeting analysis workflow:
 *
 *   START → analyze → summarize → extractDecisions → extractActions → pickHighlights → finalize → END
 *
 * State keys and node ids must differ in LangGraph, hence `analysis` (state) vs `analyze` (node).
 * Every node calls Groq through LangChain and returns JSON that is validated against the transcript
 * (segment citations, participant owners, verbatim quotes) before it reaches state.
 */
const State = Annotation.Root({
  input: Annotation<AnalysisInput>(),
  analysis: Annotation<AnalyzeOut>(),
  summaryText: Annotation<string>(),
  decisionList: Annotation<Omit<Decision, "id">[]>(),
  actionList: Annotation<Omit<ActionItem, "id">[]>(),
  highlightList: Annotation<Omit<Highlight, "id">[]>(),
  result: Annotation<Analysis>(),
});

export function buildAnalysisGraph(complete: Complete, modelName: string) {
  return new StateGraph(State)
    .addNode("analyze", async (s) => ({ analysis: await nodes.analyze(complete, s.input) }))
    .addNode("summarize", async (s) => ({ summaryText: await nodes.summary(complete, s.input, s.analysis) }))
    .addNode("extractDecisions", async (s) => ({ decisionList: await nodes.decisions(complete, s.input) }))
    .addNode("extractActions", async (s) => ({ actionList: await nodes.actions(complete, s.input) }))
    .addNode("pickHighlights", async (s) => ({ highlightList: await nodes.highlights(complete, s.input, s.analysis) }))
    .addNode("finalize", (s) => ({
      result: nodes.finalize(s.input, modelName, {
        analyze: s.analysis,
        summary: s.summaryText,
        decisions: s.decisionList,
        actions: s.actionList,
        highlights: s.highlightList,
      }),
    }))
    .addEdge(START, "analyze")
    .addEdge("analyze", "summarize")
    .addEdge("summarize", "extractDecisions")
    .addEdge("extractDecisions", "extractActions")
    .addEdge("extractActions", "pickHighlights")
    .addEdge("pickHighlights", "finalize")
    .addEdge("finalize", END)
    .compile();
}

export interface StepEvent {
  step: string; // node id that just completed
  label: string;
  index: number;
  total: number;
}

/** Run the workflow, reporting each completed node so the UI can show real progress. */
export async function runAnalysis(
  input: AnalysisInput,
  onStep?: (e: StepEvent) => void,
  complete: Complete = groqComplete(),
): Promise<Analysis> {
  assertAnalyzable(input);
  const graph = buildAnalysisGraph(complete, groqModel());
  let result: Analysis | undefined;
  try {
    const stream = await graph.stream({ input }, { streamMode: "updates" });
    for await (const chunk of stream) {
      const [node] = Object.keys(chunk);
      const idx = STEPS.findIndex((s) => s.id === node);
      if (idx >= 0) onStep?.({ step: node, label: STEPS[idx].label, index: idx + 1, total: STEPS.length });
      const upd = (chunk as Record<string, { result?: Analysis }>)[node];
      if (upd?.result) result = upd.result;
    }
  } catch (e) {
    throw toAIError(e);
  }
  if (!result) throw toAIError(new Error("analysis workflow produced no result"));
  return result;
}
