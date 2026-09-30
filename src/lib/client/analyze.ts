import type { Analysis, TemplateId } from "@/lib/types";

export interface StepEvent {
  step: string;
  label: string;
  index: number;
  total: number;
}

export class AnalyzeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Runs the LangGraph analysis on the server and reports each finished node.
 * The route streams Server-Sent Events: {type:"step"} … then {type:"done"} or {type:"error"}.
 */
export async function streamAnalysis(
  meetingId: string,
  template: TemplateId,
  onStep: (e: StepEvent) => void,
  signal?: AbortSignal,
): Promise<Analysis> {
  let res: Response;
  try {
    res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AnalyzeError("network", "Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => null);
    throw new AnalyzeError(j?.error?.code ?? "upstream", j?.error?.message ?? `Request failed (${res.status}).`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.type === "step") onStep(evt as StepEvent);
      else if (evt.type === "error") throw new AnalyzeError(evt.code ?? "upstream", evt.message ?? "Analysis failed.");
      else if (evt.type === "done") return evt.analysis as Analysis;
    }
  }
  throw new AnalyzeError("upstream", "The analysis stream ended unexpectedly. Try again.");
}
