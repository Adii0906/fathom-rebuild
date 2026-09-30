import type { Meeting, MeetingState, SearchHit } from "./types";

export interface Doc {
  id: string;
  kind: SearchHit["kind"];
  meetingId: string;
  meetingTitle: string;
  at?: number;
  /** what is shown / given to the model */
  text: string;
  /** small boost for high-signal kinds */
  boost: number;
  tokens: string[];
}

export interface Index {
  docs: Doc[];
  df: Map<string, number>;
  avgLen: number;
}

const STOP = new Set(
  "a an and are as at be but by can did do does for from had has have how i in is it its of on or our that the their them then there these they this to us was we were what when where which who whom why will with would you your about across said say tell mention mentioned meeting meetings".split(" "),
);

/** Lightweight domain synonyms so "SSO" also finds "single sign-on / SAML / Okta". */
const ALIASES: Record<string, string[]> = {
  sso: ["saml", "okta", "single", "sign"],
  saml: ["sso", "okta"],
  onboarding: ["onboard", "setup"],
  onboard: ["onboarding", "setup"],
  scim: ["provisioning", "deprovision"],
  deprovision: ["scim", "offboarding"],
  audit: ["log", "siem", "splunk"],
  pricing: ["price", "discount", "seat", "cost"],
  price: ["pricing", "seat", "cost"],
  residency: ["eu", "frankfurt", "germany"],
};

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map(stem);
}

/** Query terms with weights: what the user typed counts fully, synonyms count less. */
export function expandQuery(q: string): Map<string, number> {
  const base = tokenize(q);
  const out = new Map<string, number>(base.map((t) => [t, 1]));
  for (const t of base)
    for (const a of ALIASES[t] ?? []) if (!out.has(stem(a))) out.set(stem(a), 0.35);
  return out;
}

export interface MeetingWithState {
  meeting: Meeting;
  state: MeetingState;
}

export function buildIndex(items: MeetingWithState[]): Index {
  const docs: Doc[] = [];
  const add = (d: Omit<Doc, "tokens"> & { score?: string }) => {
    const { score: scoreText, ...rest } = d;
    docs.push({ ...rest, tokens: tokenize(scoreText ?? d.text) });
  };

  for (const { meeting: m, state } of items) {
    const name = (id: string) => m.participants.find((p) => p.id === id)?.name ?? id;
    const base = { meetingId: m.id, meetingTitle: m.title };

    add({ ...base, id: `${m.id}:title`, kind: "meeting", boost: 1,
      text: `${m.title}. Participants: ${m.participants.map((p) => p.name).join(", ")}.` });

    // Scored on the segment itself; the following turn is display/LLM context only.
    m.segments.forEach((s, i) => {
      const line = (x: typeof s) => `${name(x.speakerId)}: ${x.text}`;
      const next = m.segments[i + 1];
      const text = [s, next].filter(Boolean).map((x) => line(x!)).join(" ");
      add({ ...base, id: `${m.id}:seg:${s.id}`, kind: "transcript", at: s.start, boost: 1, text, score: line(s) });
    });

    const analyses = { ...m.analyses, ...state.analyses };
    for (const a of Object.values(analyses)) {
      if (!a) continue;
      add({ ...base, id: `${m.id}:sum:${a.template}`, kind: "meeting", boost: 1.1, text: a.summary });
      for (const x of a.actionItems)
        add({ ...base, id: `${m.id}:act:${x.id}`, kind: "action", at: x.at, boost: 1.3,
          text: `Action item for ${x.owner}: ${x.text}${x.due ? ` (due ${x.due})` : ""}` });
      for (const x of a.decisions)
        add({ ...base, id: `${m.id}:dec:${x.id}`, kind: "decision", at: x.at, boost: 1.25, text: `Decision: ${x.text}` });
      for (const x of a.highlights)
        add({ ...base, id: `${m.id}:hl:${x.id}`, kind: "highlight", at: x.at, boost: 1.25, text: `${x.title}. ${x.note}` });
    }
    for (const h of state.userHighlights)
      add({ ...base, id: `${m.id}:uhl:${h.id}`, kind: "highlight", at: h.at, boost: 1.5, text: `${h.title}. ${h.note}` });
  }

  const df = new Map<string, number>();
  let total = 0;
  for (const d of docs) {
    total += d.tokens.length;
    for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { docs, df, avgLen: total / Math.max(1, docs.length) };
}

const K1 = 1.4;
const B = 0.75;

export function score(index: Index, q: Map<string, number>, d: Doc): number {
  if (!q.size) return 0;
  const N = index.docs.length;
  const tf = new Map<string, number>();
  for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let s = 0;
  for (const [t, w] of q) {
    const f = tf.get(t);
    if (!f) continue;
    const n = index.df.get(t) ?? 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    s += w * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.tokens.length) / index.avgLen)));
  }
  return s * d.boost;
}

export function rank(index: Index, query: string, limit: number, opts: { meetingId?: string } = {}): { doc: Doc; score: number }[] {
  const q = expandQuery(query);
  const out: { doc: Doc; score: number }[] = [];
  for (const doc of index.docs) {
    if (opts.meetingId && doc.meetingId !== opts.meetingId) continue;
    const sc = score(index, q, doc);
    if (sc > 0) out.push({ doc, score: sc });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Drop overlapping transcript windows so one moment doesn't fill the result list. */
function dedupeAdjacent(hits: { doc: Doc; score: number }[]): { doc: Doc; score: number }[] {
  const kept: { doc: Doc; score: number }[] = [];
  for (const h of hits) {
    const dup = kept.some(
      (k) => k.doc.meetingId === h.doc.meetingId && k.doc.kind === h.doc.kind &&
        k.doc.at !== undefined && h.doc.at !== undefined && Math.abs(k.doc.at - h.doc.at) < 20,
    );
    if (!dup) kept.push(h);
  }
  return kept;
}

export function search(index: Index, query: string, limit = 30): SearchHit[] {
  const ranked = dedupeAdjacent(rank(index, query, limit * 4)).slice(0, limit);
  return ranked.map(({ doc, score }) => ({
    kind: doc.kind,
    meetingId: doc.meetingId,
    meetingTitle: doc.meetingTitle,
    at: doc.at,
    snippet: snippetFor(doc, expandQuery(query)),
    score: Math.round(score * 100) / 100,
  }));
}

/** For transcript docs, show the matching turn (not its neighbours) when possible. */
function snippetFor(doc: Doc, q: Map<string, number>): string {
  let t = doc.text;
  if (doc.kind === "transcript") {
    const turns = t.split(/(?<=[.?!])\s+(?=[A-Z][\w.'’-]*(?: [A-Za-z][\w.'’-]*){0,3}: )/);
    const best = turns
      .map((x) => ({ x, n: tokenize(x).filter((w) => q.has(w)).length }))
      .sort((a, b) => b.n - a.n)[0];
    if (best && best.n > 0) t = best.x;
  }
  return t.length > 260 ? t.slice(0, 257) + "…" : t;
}

export interface Source {
  sid: string; // S1, S2, ... what the model cites
  meetingId: string;
  meetingTitle: string;
  at?: number;
  kind: Doc["kind"];
  text: string;
}

/** Top passages for a question, deduplicated, with stable ids for citation. */
export function retrieveSources(index: Index, question: string, k = 10): Source[] {
  const hits = dedupeAdjacent(rank(index, question, k * 4)).slice(0, k);
  // Below this the match is essentially noise; better to answer "not found" than to guess.
  const floor = 1.2;
  return hits
    .filter((h) => h.score >= floor)
    .map((h, i) => ({
      sid: `S${i + 1}`,
      meetingId: h.doc.meetingId,
      meetingTitle: h.doc.meetingTitle,
      at: h.doc.at,
      kind: h.doc.kind,
      text: h.doc.text,
    }));
}
