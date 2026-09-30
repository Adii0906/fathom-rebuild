import { TEMPLATES } from "../../templates";
import type {
  ActionItem, Analysis, Decision, Highlight, KeyPoint, Question, Risk, TemplateSection,
} from "../../types";
import type { AnalysisInput } from "./prompts";

/** The graph state slices, already validated + grounded. */
export interface AnalyzeOut {
  topics: string[];
  keyPoints: KeyPoint[];
  questions: Omit<Question, "id">[];
  risks: Omit<Risk, "id">[];
  sections: TemplateSection[];
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function need(raw: unknown): Obj {
  if (!isObj(raw)) throw new Error("expected a JSON object");
  return raw;
}

/** Resolve the model's cited segment id to a real segment. Invalid citation ⇒ item is dropped. */
function refOf(v: unknown, i: AnalysisInput): { segmentId: number; at: number } | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/^s/i, "")) : NaN;
  if (!Number.isInteger(n)) return null;
  const seg = i.segments[n];
  return seg && seg.id === n ? { segmentId: n, at: seg.start } : null;
}

/** Map a model-provided owner to a real participant; anything unknown becomes Unassigned. */
export function resolveOwner(v: unknown, i: AnalysisInput): string {
  const s = norm(str(v));
  if (!s) return "Unassigned";
  const exact = i.participants.find((p) => norm(p.name) === s);
  if (exact) return exact.name;
  const first = i.participants.filter((p) => norm(p.name).split(" ")[0] === s.split(" ")[0]);
  return first.length === 1 ? first[0].name : "Unassigned";
}

function dedupe<T extends { text?: string; title?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = norm((x.text ?? x.title ?? "").slice(0, 80));
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function points(v: unknown, i: AnalysisInput, max: number): KeyPoint[] {
  const out: KeyPoint[] = [];
  for (const it of arr(v)) {
    if (!isObj(it)) continue;
    const text = str(it.text);
    const r = refOf(it.segment, i);
    if (text && r) out.push({ text, ...r });
  }
  return dedupe(out).slice(0, max);
}

export function coerceAnalyze(raw: unknown, i: AnalysisInput): AnalyzeOut {
  const o = need(raw);
  const questions: Omit<Question, "id">[] = [];
  for (const it of arr(o.questions)) {
    if (!isObj(it)) continue;
    const text = str(it.text);
    const r = refOf(it.segment, i);
    if (text && r)
      questions.push({ text, askedBy: str(it.askedBy) ? resolveOwner(it.askedBy, i) : undefined, answered: it.answered === true, ...r });
  }
  const risks: Omit<Risk, "id">[] = [];
  for (const it of arr(o.risks)) {
    if (!isObj(it)) continue;
    const text = str(it.text);
    const r = refOf(it.segment, i);
    const sev = str(it.severity).toLowerCase();
    if (text && r) risks.push({ text, severity: sev === "high" || sev === "low" ? sev : "medium", ...r });
  }
  const secRaw = isObj(o.sections) ? o.sections : {};
  const sections: TemplateSection[] = TEMPLATES[i.template].sections.map((def) => {
    let items = points(secRaw[def.key], i, 8);
    if (def.key === "quotes") {
      // Verbatim means verbatim: keep only quotes that literally appear in the cited line.
      items = items.filter((it) => norm(i.segments[it.segmentId].text).includes(norm(it.text)));
    }
    return { key: def.key, title: def.title, items };
  });
  const topics = arr(o.topics).map(str).filter(Boolean).slice(0, 8);
  const keyPoints = points(o.keyPoints, i, 9);
  if (!keyPoints.length && !sections.some((s) => s.items.length))
    throw new Error("analysis contained no items with valid segment citations");
  return { topics, keyPoints, questions: dedupe(questions).slice(0, 8), risks: dedupe(risks).slice(0, 8), sections };
}

export function coerceSummary(raw: unknown): string {
  const s = str(need(raw).summary);
  if (s.length < 20) throw new Error("summary missing or too short");
  return s;
}

export function coerceDecisions(raw: unknown, i: AnalysisInput): Omit<Decision, "id">[] {
  const out: Omit<Decision, "id">[] = [];
  for (const it of arr(need(raw).decisions)) {
    if (!isObj(it)) continue;
    const text = str(it.text);
    const r = refOf(it.segment, i);
    if (text && r) out.push({ text, owner: str(it.owner) ? resolveOwner(it.owner, i) : undefined, ...r });
  }
  return dedupe(out).slice(0, 10);
}

export function coerceActions(raw: unknown, i: AnalysisInput): Omit<ActionItem, "id">[] {
  const out: Omit<ActionItem, "id">[] = [];
  for (const it of arr(need(raw).actionItems)) {
    if (!isObj(it)) continue;
    const text = str(it.text);
    const r = refOf(it.segment, i);
    if (!text || !r) continue;
    const due = str(it.due);
    out.push({ text, owner: resolveOwner(it.owner, i), due: due || undefined, ...r });
  }
  return dedupe(out).slice(0, 20);
}

export function coerceHighlights(raw: unknown, i: AnalysisInput): Omit<Highlight, "id">[] {
  const out: Omit<Highlight, "id">[] = [];
  for (const it of arr(need(raw).highlights)) {
    if (!isObj(it)) continue;
    const title = str(it.title);
    const r = refOf(it.segment, i);
    if (title && r) out.push({ title, note: str(it.note), ...r });
  }
  return dedupe(out).slice(0, 8);
}

/** Compact, already-grounded digest handed to later graph nodes instead of re-sending the transcript. */
export function digestOf(a: AnalyzeOut): string {
  const l = (t: string, xs: { text: string }[]) => (xs.length ? `${t}:\n${xs.map((x) => `- ${x.text}`).join("\n")}` : "");
  return [
    `Topics: ${a.topics.join(", ")}`,
    l("Key points", a.keyPoints),
    l("Risks", a.risks),
    ...a.sections.map((s) => l(s.title, s.items)),
  ].filter(Boolean).join("\n");
}

export function finalize(
  i: AnalysisInput,
  model: string,
  p: {
    analyze: AnalyzeOut;
    summary: string;
    decisions: Omit<Decision, "id">[];
    actions: Omit<ActionItem, "id">[];
    highlights: Omit<Highlight, "id">[];
  },
  now: Date = new Date(),
): Analysis {
  const t = i.template;
  const byTime = <T extends { at: number }>(xs: T[]) => [...xs].sort((a, b) => a.at - b.at);
  return {
    template: t,
    generatedAt: now.toISOString(),
    model,
    summary: p.summary,
    topics: p.analyze.topics,
    keyPoints: byTime(p.analyze.keyPoints),
    decisions: byTime(p.decisions).map((x, n) => ({ id: `${t}-dec-${n + 1}`, ...x })),
    actionItems: byTime(p.actions).map((x, n) => ({ id: `${t}-act-${n + 1}`, ...x })),
    highlights: byTime(p.highlights).map((x, n) => ({ id: `${t}-hl-${n + 1}`, ...x })),
    questions: byTime(p.analyze.questions).map((x, n) => ({ id: `${t}-q-${n + 1}`, ...x })),
    risks: byTime(p.analyze.risks).map((x, n) => ({ id: `${t}-risk-${n + 1}`, ...x })),
    sections: p.analyze.sections.map((s) => ({ ...s, items: byTime(s.items) })),
  };
}
