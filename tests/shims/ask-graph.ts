// Test shim for src/lib/ai/ask-graph.ts: retrieve → (empty | generate → verify), no langgraph.
import { askPrompt, NOT_FOUND, verifyAnswer, type AskResult } from "./core/ask-core";
import { callJSON } from "./core/json";
import { retrieveSources, type Index } from "../retrieval";
import { fakeComplete } from "../../../tests/fake-model";

export async function askAcrossMeetings(index: Index, question: string): Promise<AskResult> {
  const sources = retrieveSources(index, question, 12);
  if (!sources.length) return { answer: NOT_FOUND, grounded: false, citations: [] };
  const p = askPrompt(question, sources);
  const raw = await callJSON(fakeComplete, p.system, p.user, (r) => r);
  return verifyAnswer(raw, sources);
}
