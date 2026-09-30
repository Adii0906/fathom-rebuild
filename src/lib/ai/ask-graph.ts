import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { retrieveSources, type Index, type Source } from "../retrieval";
import { askPrompt, NOT_FOUND, verifyAnswer, type AskResult } from "./core/ask-core";
import { toAIError } from "./core/errors";
import { callJSON, type Complete } from "./core/json";
import { groqComplete } from "./model";

/**
 * Ask across meetings:
 *
 *   START → retrieve ─┬─(sources found)→ generate → verify → END
 *                     └─(nothing relevant)→ empty ────────→ END
 *
 * Retrieval is lexical BM25 over transcript turns, action items, decisions and highlights.
 * When nothing relevant is retrieved the model is never called, so it cannot invent an answer.
 * `verify` then drops any citation the model made up.
 */
const State = Annotation.Root({
  question: Annotation<string>(),
  sources: Annotation<Source[]>(),
  raw: Annotation<unknown>(),
  result: Annotation<AskResult>(),
});

export function buildAskGraph(index: Index, complete: Complete) {
  return new StateGraph(State)
    .addNode("retrieve", (s) => ({ sources: retrieveSources(index, s.question, 12) }))
    .addNode("generate", async (s) => {
      const p = askPrompt(s.question, s.sources);
      return { raw: await callJSON(complete, p.system, p.user, (r) => r) };
    })
    .addNode("verify", (s) => ({ result: verifyAnswer(s.raw, s.sources) }))
    .addNode("empty", () => ({ result: { answer: NOT_FOUND, grounded: false, citations: [] } as AskResult }))
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", (s) => (s.sources.length ? "generate" : "empty"), ["generate", "empty"])
    .addEdge("generate", "verify")
    .addEdge("verify", END)
    .addEdge("empty", END)
    .compile();
}

export async function askAcrossMeetings(index: Index, question: string, complete?: Complete): Promise<AskResult> {
  const q = question.trim();
  if (q.length < 3) throw toAIError(new Error("Question is too short."));
  try {
    // Only build the Groq client when retrieval found something to ask about.
    let c = complete;
    const lazy: Complete = (s, u) => (c ??= groqComplete())(s, u);
    const out = await buildAskGraph(index, lazy).invoke({ question: q });
    return out.result;
  } catch (e) {
    throw toAIError(e);
  }
}
