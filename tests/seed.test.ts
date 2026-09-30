import { test } from "node:test";
import assert from "node:assert/strict";
import { seedMeetings, eventsFor } from "../src/lib/seed/index";
import { TEMPLATES } from "../src/lib/templates";

const now = new Date("2026-09-30T12:00:00Z");
const meetings = seedMeetings(now);

test("at least 8 meetings including the flagship", () => {
  assert.ok(meetings.length >= 8);
  const f = meetings.find((m) => m.title === "Acme Enterprise Product Review");
  assert.ok(f);
  assert.equal(f.participants.length, 8);
  assert.ok(f.segments.length >= 150, `segments: ${f.segments.length}`);
  assert.ok(f.durationSec >= 58 * 60 && f.durationSec <= 65 * 60);
  const a = f.analyses[f.defaultTemplate]!;
  assert.ok(a.actionItems.length >= 8 && a.decisions.length >= 3);
  assert.ok(a.highlights.length >= 3 && a.questions.length >= 2 && a.risks.length >= 3);
});

test("timestamps are monotonic and within duration", () => {
  for (const m of meetings) {
    let prev = -1;
    for (const s of m.segments) {
      assert.ok(s.start >= prev, `${m.id} seg ${s.id}`);
      assert.ok(s.end >= s.start && s.end <= m.durationSec);
      prev = s.start;
    }
  }
});

test("every analysis ref points at a real segment with matching time", () => {
  for (const m of meetings) {
    const a = m.analyses[m.defaultTemplate]!;
    const refs = [
      ...a.keyPoints, ...a.decisions, ...a.actionItems, ...a.highlights,
      ...a.questions, ...a.risks, ...a.sections.flatMap((s) => s.items),
    ];
    for (const r of refs) {
      assert.equal(m.segments[r.segmentId].start, r.at, `${m.id}`);
    }
    assert.equal(a.sections.length, TEMPLATES[m.defaultTemplate].sections.length);
  }
});

test("ids unique; speakers are participants; all six templates showcased", () => {
  const ids = new Set(meetings.map((m) => m.id));
  assert.equal(ids.size, meetings.length);
  const used = new Set(meetings.map((m) => m.defaultTemplate));
  assert.equal(used.size, 6);
  for (const m of meetings) {
    const pids = new Set(m.participants.map((p) => p.id));
    assert.ok(m.segments.every((s) => pids.has(s.speakerId)));
  }
});

test("Aditya has actions in several meetings; calendar has past and future", () => {
  const n = meetings.filter((m) =>
    m.analyses[m.defaultTemplate]!.actionItems.some((a) => a.owner === "Aditya Sharma")).length;
  assert.ok(n >= 3);
  const ev = eventsFor(meetings, now);
  assert.ok(ev.some((e) => new Date(e.startsAt) > now));
  assert.ok(ev.some((e) => e.meetingId));
});
