import { TEMPLATES } from "../../templates";
import type { Participant, Segment, TemplateId } from "../../types";

export interface AnalysisInput {
  title: string;
  template: TemplateId;
  participants: Participant[];
  segments: Segment[];
}

export const mmss = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};

/** `[s12 04:31] Priya Raman: text` — the s-id is what the model cites back. */
export function formatTranscript(i: Pick<AnalysisInput, "participants" | "segments">): string {
  const name = new Map(i.participants.map((p) => [p.id, p.name]));
  return i.segments
    .map((s) => `[s${s.id} ${mmss(s.start)}] ${name.get(s.speakerId) ?? s.speakerId}: ${s.text}`)
    .join("\n");
}

const RULES = `GROUNDING RULES (follow strictly):
- Use ONLY what is said in the transcript. Never invent facts, numbers, dates, names, commitments or owners.
- Every item you return must include "segment": the integer N from the [sN ...] tag of the single line that best supports it.
- If the transcript contains nothing for a field, return an empty list for it. Fewer, correct items beat more, guessed ones.
- Write in plain, specific language. No filler, no marketing tone.
- Reply with ONE JSON object and nothing else (no markdown, no commentary).`;

const people = (i: AnalysisInput) =>
  i.participants.map((p) => `${p.name} (${p.role}${p.org ? `, ${p.org}` : ""})`).join("; ");

function sys(i: AnalysisInput, task: string): string {
  const t = TEMPLATES[i.template];
  return `You analyse meeting transcripts for a meeting-intelligence product.
Meeting: "${i.title}". Template: ${t.label}. ${t.focus}
Participants: ${people(i)}.

${task}

${RULES}`;
}

export function analyzePrompt(i: AnalysisInput) {
  const t = TEMPLATES[i.template];
  const secKeys = t.sections.map((s) => `    "${s.key}": [{"text": string, "segment": int}]  // ${s.title}: ${s.instruction}`).join(",\n");
  return {
    system: sys(i, `TASK: analyse the transcript.
Return JSON:
{
  "topics": [string],                      // 3-8 short topic labels
  "keyPoints": [{"text": string, "segment": int}],   // 5-9 most important points, one sentence each
  "questions": [{"text": string, "askedBy": string, "segment": int, "answered": boolean}],  // real questions raised; answered=true only if answered in the transcript
  "risks": [{"text": string, "severity": "low"|"medium"|"high", "segment": int}],   // risks, blockers or concerns explicitly voiced
  "sections": {
${secKeys}
  }
}
Choose keyPoints, risks and sections through the lens of the ${t.label} template.${t.sections.some((s) => s.key === "quotes") ? ' Items under "quotes" must be copied word for word from the transcript.' : ""}`),
    user: `TRANSCRIPT:\n${formatTranscript(i)}`,
  };
}

export function summaryPrompt(i: AnalysisInput, digest: string) {
  const t = TEMPLATES[i.template];
  return {
    system: sys(i, `TASK: write the meeting summary.
Style: ${t.summaryStyle}
Return JSON: {"summary": string}   // 60-130 words, one paragraph, no bullet points
Base the summary ONLY on the verified analysis below. Do not add any fact that is not in it.`),
    user: `VERIFIED ANALYSIS:\n${digest}`,
  };
}

export function decisionsPrompt(i: AnalysisInput) {
  return {
    system: sys(i, `TASK: list the decisions that were actually made (something was agreed or settled, not merely discussed).
Return JSON: {"decisions": [{"text": string, "owner": string|null, "segment": int}]}
"segment" = the line where the decision was made or confirmed. "owner" = participant who owns/made it, only if stated, else null.`),
    user: `TRANSCRIPT:\n${formatTranscript(i)}`,
  };
}

export function actionsPrompt(i: AnalysisInput) {
  return {
    system: sys(i, `TASK: list action items: concrete follow-ups someone committed to or was asked to do.
Return JSON: {"actionItems": [{"text": string, "owner": string, "due": string|null, "segment": int}]}
"owner" must be exactly one participant name from the list above, or "Unassigned" if the transcript does not say. "due" only if a deadline is spoken (e.g. "Friday"), else null. "segment" = the line where it was committed or assigned. Start "text" with a verb.`),
    user: `TRANSCRIPT:\n${formatTranscript(i)}`,
  };
}

export function highlightsPrompt(i: AnalysisInput, digest: string) {
  return {
    system: sys(i, `TASK: pick the 3-6 moments a busy reader must not miss (a decision, a risk, a striking customer statement, a commitment).
Return JSON: {"highlights": [{"title": string, "note": string, "segment": int}]}
"title" max 6 words. "note" one sentence explaining why it matters, using only transcript facts.`),
    user: `ALREADY-EXTRACTED CONTEXT (for reference; highlights must still cite transcript lines):\n${digest}\n\nTRANSCRIPT:\n${formatTranscript(i)}`,
  };
}
