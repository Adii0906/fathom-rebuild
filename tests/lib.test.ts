import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscript } from "../src/lib/transcript-parse";
import { buildIndex, search, retrieveSources } from "../src/lib/retrieval";
import { seedMeetings } from "../src/lib/seed/index";

test("parse: bracket timestamps + continuation lines", () => {
  const r = parseTranscript("[00:05] Ana: Hello there.\nStill Ana talking.\n[01:10] Bo Lee: Reply.");
  assert.equal(r.segments.length, 2);
  assert.equal(r.segments[0].start, 5);
  assert.match(r.segments[0].text, /Still Ana talking/);
  assert.equal(r.segments[1].start, 70);
  assert.deepEqual(r.participants.map((p) => p.name), ["Ana", "Bo Lee"]);
});

test("parse: no timestamps estimates monotonic timing", () => {
  const r = parseTranscript("Ana: one two three four five six seven eight nine ten.\nBo: short.");
  assert.ok(r.segments[1].start >= r.segments[0].end);
  assert.ok(r.durationSec > 0);
});

test("parse: VTT cues with speaker prefixes", () => {
  const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nAna: Hi all\n\n2\n00:00:05.000 --> 00:01:06.500\nBo: Hello";
  const r = parseTranscript(vtt);
  assert.equal(r.segments.length, 2);
  assert.equal(r.segments[1].start, 5);
  assert.equal(r.segments[1].end, 66);
  assert.equal(r.segments[1].speakerId, "bo");
});

test("parse: SRT with comma milliseconds and numeric cue ids", () => {
  const srt = "1\n00:00:01,000 --> 00:00:04,500\nAna: First line\n\n2\n00:01:05,250 --> 00:01:09,000\nBo: Second line";
  const r = parseTranscript(srt);
  assert.equal(r.segments.length, 2);
  assert.equal(r.segments[1].start, 65);
  assert.equal(r.segments[1].speakerId, "bo");
});

test("parse: trailing timestamp style and errors", () => {
  const r = parseTranscript("Ana (00:30): Hi\nBo (01:00): Yo");
  assert.equal(r.segments[1].start, 60);
  assert.throws(() => parseTranscript("   "));
});

const items = seedMeetings(new Date("2026-09-30T12:00:00Z")).map((meeting) => ({
  meeting, state: { userHighlights: [], completedActions: {}, analyses: {} },
}));
const index = buildIndex(items);

test("search: SSO finds multiple meetings and opens at a timestamp", () => {
  const hits = search(index, "SSO", 40);
  const meetings = new Set(hits.map((h) => h.meetingId));
  assert.ok(meetings.size >= 4, `only ${meetings.size}`);
  assert.ok(hits.some((h) => h.kind === "transcript" && h.at !== undefined));
});

test("search: action items for Aditya", () => {
  const hits = search(index, "action items assigned to Aditya", 20);
  assert.ok(hits.some((h) => h.kind === "action" && /Aditya/.test(h.snippet)));
});

test("retrieval: onboarding question returns grounded sources", () => {
  const src = retrieveSources(index, "What did customers say about onboarding?", 8);
  assert.ok(src.length >= 4);
  assert.ok(src.some((s) => s.meetingId === "discovery-brightwave-logistics"));
  assert.ok(src.every((s, i) => s.sid === `S${i + 1}`));
});

test("retrieval: off-topic question yields no sources", () => {
  assert.equal(retrieveSources(index, "What is the capital of Mongolia?").length, 0);
  assert.equal(retrieveSources(index, "quantum entanglement pineapple").length, 0);
});
