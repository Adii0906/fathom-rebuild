import type { Participant, Segment } from "./types";

export interface ParsedTranscript {
  segments: Segment[];
  participants: Participant[];
  durationSec: number;
}

const TS = String.raw`(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?`;
const toSec = (h: string | undefined, m: string, s: string) =>
  (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10);

const WORDS_PER_SEC = 2.5; // ~150 wpm, used when the source has no timestamps
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "speaker";

interface Raw {
  start?: number;
  end?: number;
  speaker: string;
  text: string;
}

/**
 * Accepts the transcript formats people actually paste or export:
 *   [00:12] Name: text        00:12 Name: text        Name (00:12): text
 *   Name: text                (no timestamps, timing is estimated)
 *   WebVTT / SRT cues         (00:00:01.000 --> 00:00:04.000, optional "Name: " prefix)
 * Continuation lines are appended to the previous turn.
 */
export function parseTranscript(input: string): ParsedTranscript {
  const text = input.replace(/\r/g, "").replace(/^WEBVTT.*$/m, "").trim();
  if (!text) throw new Error("Transcript is empty.");

  const cueRe = new RegExp(String.raw`^${TS}\s*-->\s*${TS}`);
  const raws: Raw[] = /-->/.test(text) ? parseCues(text, cueRe) : parseLines(text);
  if (raws.length === 0) throw new Error("Could not find any speech in the transcript.");

  // Estimate missing timings from word counts.
  let cursor = 0;
  for (const r of raws) {
    if (r.start === undefined) r.start = cursor;
    const est = Math.max(2, Math.round(r.text.split(/\s+/).length / WORDS_PER_SEC));
    if (r.end === undefined) r.end = r.start + est;
    cursor = r.end;
  }
  // Enforce monotonic starts (bad exports happen).
  let prev = 0;
  for (const r of raws) {
    r.start = Math.max(r.start!, prev);
    r.end = Math.max(r.end!, r.start);
    prev = r.start;
  }

  const participants = new Map<string, Participant>();
  const segments: Segment[] = raws.map((r, i) => {
    const id = slug(r.speaker);
    if (!participants.has(id)) participants.set(id, { id, name: r.speaker, role: "Participant" });
    return { id: i, speakerId: id, start: r.start!, end: r.end!, text: r.text };
  });
  return {
    segments,
    participants: [...participants.values()],
    durationSec: Math.ceil(Math.max(...segments.map((s) => s.end))),
  };
}

function splitSpeaker(line: string): { speaker: string; text: string } {
  const m = line.match(/^([A-Z][\w.'’-]*(?: [A-Za-z][\w.'’-]*){0,3}):\s+(.+)$/);
  return m ? { speaker: m[1], text: m[2] } : { speaker: "Speaker", text: line };
}

function parseCues(text: string, cueRe: RegExp): Raw[] {
  const out: Raw[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => cueRe.test(l));
    if (i < 0) continue;
    const m = lines[i].match(cueRe)!;
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (!body) continue;
    const { speaker, text: t } = splitSpeaker(body);
    out.push({ start: toSec(m[1], m[2], m[3]), end: toSec(m[4], m[5], m[6]), speaker, text: t });
  }
  return out;
}

function parseLines(text: string): Raw[] {
  const lead = new RegExp(String.raw`^\[?${TS}\]?\s+(.*)$`);
  const trail = new RegExp(String.raw`^(.+?)\s*[\[(]${TS}[\])]:?\s*(.*)$`);
  const out: Raw[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let start: number | undefined;
    let rest = line;
    let m = line.match(lead);
    if (m) {
      start = toSec(m[1], m[2], m[3]);
      rest = m[4];
    } else if ((m = line.match(trail))) {
      start = toSec(m[2], m[3], m[4]);
      rest = `${m[1]}: ${m[5]}`;
    }
    const hasSpeaker = /^[A-Z][\w.'’-]*(?: [A-Za-z][\w.'’-]*){0,3}:\s+\S/.test(rest);
    if (!hasSpeaker && out.length && start === undefined) {
      out[out.length - 1].text += " " + rest; // continuation
      continue;
    }
    const { speaker, text: t } = splitSpeaker(rest);
    out.push({ start, speaker, text: t });
  }
  return out;
}
