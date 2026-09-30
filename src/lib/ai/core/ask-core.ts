import { mmss } from "./prompts";
import type { Source } from "../../retrieval";

export interface AskCitation {
  sid: string;
  meetingId: string;
  meetingTitle: string;
  at?: number;
  kind: Source["kind"];
  snippet: string;
}
export interface AskResult {
  answer: string;
  grounded: boolean;
  citations: AskCitation[];
}

export const NOT_FOUND = "I couldn't find anything about that in your meetings.";

export function formatSources(sources: Source[]): string {
  return sources
    .map((s) => `[${s.sid}] ${s.meetingTitle}${s.at !== undefined ? ` @ ${mmss(s.at)}` : ""} (${s.kind}): ${s.text}`)
    .join("\n");
}

export function askPrompt(question: string, sources: Source[]) {
  return {
    system: `You answer questions about a user's recorded meetings using ONLY the numbered SOURCES provided.

RULES (follow strictly):
- Every claim must come from the sources. Never use outside knowledge, never guess, never fill gaps.
- Cite every claim with the source id in square brackets, e.g. "SSO is targeted for October 21 [S3]". Use several ids when several sources support it.
- Name the meeting when it helps (for example "In Weekly Engineering Sync, ...").
- For "which meetings" or "who has" questions, list each match with its citation.
- If the sources do not contain the answer, set "found" to false and say so plainly. If they only partly answer, answer the supported part and say what is missing.
- Be concise: at most 150 words, plain sentences or a short list.
- Reply with ONE JSON object only: {"found": boolean, "answer": string, "citations": [string]}  where citations lists the source ids you used.`,
    user: `SOURCES:\n${formatSources(sources)}\n\nQUESTION: ${question}`,
  };
}

/**
 * Enforce grounding after generation: drop citations to sources that were never
 * provided, strip the matching markers from the text, and refuse to present an
 * answer that cites nothing valid.
 */
export function verifyAnswer(raw: unknown, sources: Source[]): AskResult {
  if (typeof raw !== "object" || raw === null) throw new Error("expected a JSON object");
  const o = raw as Record<string, unknown>;
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";
  if (!answer) throw new Error('missing "answer"');
  const byId = new Map(sources.map((s) => [s.sid, s]));

  const cited = new Set<string>();
  for (const c of Array.isArray(o.citations) ? o.citations : []) if (typeof c === "string" && byId.has(c)) cited.add(c);
  const cleaned = answer.replace(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g, (m, ids: string) => {
    const ok = ids.split(/\s*,\s*/).filter((id) => byId.has(id));
    ok.forEach((id) => cited.add(id));
    return ok.length ? `[${ok.join(", ")}]` : "";
  }).replace(/\s{2,}/g, " ").trim();

  if (o.found === false || cited.size === 0) {
    // Model said "not found", or it answered without any valid evidence: don't present it as grounded.
    return { answer: o.found === false ? cleaned : NOT_FOUND, grounded: false, citations: [] };
  }
  const citations = [...cited]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((sid) => {
      const s = byId.get(sid)!;
      return { sid, meetingId: s.meetingId, meetingTitle: s.meetingTitle, at: s.at, kind: s.kind,
        snippet: s.text.length > 220 ? s.text.slice(0, 217) + "…" : s.text };
    });
  return { answer: cleaned, grounded: true, citations };
}
