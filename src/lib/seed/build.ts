import type {
  Analysis,
  Meeting,
  Participant,
  Segment,
  TemplateId,
} from "../types";

export type ScriptLine = [speakerId: string, text: string, tag?: string];

/** Authored analysis. Items point at transcript lines by tag, never by hand-typed timestamp. */
export interface DraftAnalysis {
  summary: string;
  topics: string[];
  keyPoints: [text: string, tag: string][];
  decisions: [text: string, tag: string, ownerId?: string][];
  actions: [text: string, ownerId: string, tag: string, due?: string][];
  highlights: [title: string, note: string, tag: string][];
  questions: [text: string, askedById: string, tag: string, answered: boolean][];
  risks: [text: string, severity: "low" | "medium" | "high", tag: string][];
  sections: Record<string, [text: string, tag: string][]>;
}

export interface MeetingDraft {
  id: string;
  title: string;
  /** days before "now"; negative = in the future */
  daysAgo: number;
  /** UTC start time */
  time: [hour: number, minute: number];
  durationMin: number;
  template: TemplateId;
  tags: string[];
  participants: Participant[];
  script: ScriptLine[];
  analysis: DraftAnalysis;
}

import { TEMPLATES } from "../templates";

const words = (s: string) => s.trim().split(/\s+/).length;

export function buildSegments(script: ScriptLine[], durationSec: number): Segment[] {
  const weights = script.map(([, t]) => words(t) + 5); // 5 ≈ natural pause between turns
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return script.map(([speakerId, text], i) => {
    const span = (weights[i] / total) * durationSec;
    const seg: Segment = {
      id: i,
      speakerId,
      start: Math.round(cursor),
      end: Math.round(cursor + span * 0.94),
      text,
    };
    cursor += span;
    return seg;
  });
}

export function buildMeeting(d: MeetingDraft, now: Date = new Date()): Meeting {
  const durationSec = d.durationMin * 60;
  const segments = buildSegments(d.script, durationSec);

  const tagIndex = new Map<string, number>();
  d.script.forEach(([, , tag], i) => {
    if (!tag) return;
    if (tagIndex.has(tag)) throw new Error(`${d.id}: duplicate tag "${tag}"`);
    tagIndex.set(tag, i);
  });
  const ref = (tag: string) => {
    const i = tagIndex.get(tag);
    if (i === undefined) throw new Error(`${d.id}: unknown tag "${tag}"`);
    return { segmentId: i, at: segments[i].start };
  };
  const person = (id: string) => {
    const p = d.participants.find((x) => x.id === id);
    if (!p) throw new Error(`${d.id}: unknown participant "${id}"`);
    return p.name;
  };
  for (const [sp] of d.script) person(sp);

  const a = d.analysis;
  const p = `${d.id}`;
  const analysis: Analysis = {
    template: d.template,
    generatedAt: new Date(now.getTime() - (d.daysAgo * 86400 - d.durationMin * 60 - 600) * 1000).toISOString(),
    model: "seed",
    summary: a.summary,
    topics: a.topics,
    keyPoints: a.keyPoints.map(([text, tag]) => ({ text, ...ref(tag) })),
    decisions: a.decisions.map(([text, tag, owner], i) => ({
      id: `${p}-dec-${i + 1}`,
      text,
      owner: owner ? person(owner) : undefined,
      ...ref(tag),
    })),
    actionItems: a.actions.map(([text, owner, tag, due], i) => ({
      id: `${p}-act-${i + 1}`,
      text,
      owner: person(owner),
      due,
      ...ref(tag),
    })),
    highlights: a.highlights.map(([title, note, tag], i) => ({
      id: `${p}-hl-${i + 1}`,
      title,
      note,
      ...ref(tag),
    })),
    questions: a.questions.map(([text, by, tag, answered], i) => ({
      id: `${p}-q-${i + 1}`,
      text,
      askedBy: person(by),
      answered,
      ...ref(tag),
    })),
    risks: a.risks.map(([text, severity, tag], i) => ({
      id: `${p}-risk-${i + 1}`,
      text,
      severity,
      ...ref(tag),
    })),
    sections: TEMPLATES[d.template].sections.map((s) => ({
      key: s.key,
      title: s.title,
      items: (a.sections[s.key] ?? []).map(([text, tag]) => ({ text, ...ref(tag) })),
    })),
  };

  const day = new Date(now);
  day.setUTCHours(d.time[0], d.time[1], 0, 0);
  const startsAt = new Date(day.getTime() - d.daysAgo * 86400_000).toISOString();

  return {
    id: d.id,
    title: d.title,
    startsAt,
    durationSec,
    participants: d.participants,
    segments,
    source: "seed",
    status: "ready",
    defaultTemplate: d.template,
    analyses: { [d.template]: analysis },
    tags: d.tags,
  };
}
