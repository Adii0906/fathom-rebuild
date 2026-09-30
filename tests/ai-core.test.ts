import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJSON, callJSON } from "../src/lib/ai/core/json";
import { runSequential } from "../src/lib/ai/core/nodes";
import { formatTranscript, analyzePrompt } from "../src/lib/ai/core/prompts";
import { askPrompt, verifyAnswer, NOT_FOUND } from "../src/lib/ai/core/ask-core";
import { toAIError } from "../src/lib/ai/core/errors";
import { seedMeetings } from "../src/lib/seed/index";
import { buildIndex, retrieveSources } from "../src/lib/retrieval";

const m = seedMeetings(new Date("2026-09-30T12:00:00Z")).find((x) => x.id === "sales-northstar-bank-demo")!;
const input = { title: m.title, template: "sales" as const, participants: m.participants, segments: m.segments };

test("extractJSON handles fences and chatter", () => {
  assert.deepEqual(extractJSON('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJSON('{"a":{"b":2}} trailing'), { a: { b: 2 } });
  assert.throws(() => extractJSON("no json"));
});

test("transcript format carries segment ids", () => {
  const t = formatTranscript(input);
  assert.match(t, /^\[s0 00:00\] Dana Whitfield: /);
  assert.equal(t.split("\n").length, m.segments.length);
});

// A fake model keyed on which task the system prompt asks for. It deliberately
// returns some bad citations / owners / quotes so we can check they are cleaned.
function fake(calls: string[]) {
  return async (system: string) => {
    calls.push(system.match(/TASK: ([a-z0-9 -]+)/)![1].trim());
    if (system.includes("TASK: analyse"))
      return JSON.stringify({
        topics: ["Budget", "SSO"],
        keyPoints: [{ text: "Budget expires in December", segment: 1 }, { text: "Hallucinated point", segment: 9999 }],
        questions: [{ text: "What if SSO slips?", askedBy: "Elena", segment: 9, answered: true }],
        risks: [{ text: "SSO date tight", severity: "extreme", segment: 9 }],
        sections: { signals: [{ text: "Budget approved", segment: 1 }], objections: [], competitors: [], nextsteps: [] },
      });
    if (system.includes("TASK: write the meeting summary")) return '```json\n{"summary":"Northstar wants a pilot before the year-end freeze and needs SSO and SOC 2."}\n```';
    if (system.includes("TASK: list the decisions"))
      return JSON.stringify({ decisions: [{ text: "Send security package Monday", owner: "Dana", segment: 26 }] });
    if (system.includes("TASK: list action items"))
      return JSON.stringify({ actionItems: [
        { text: "Send security package", owner: "dana", due: "Monday", segment: 26 },
        { text: "Do a thing", owner: "Nobody Real", due: null, segment: 3 },
        { text: "Out of range", owner: "Dana", segment: -4 },
      ] });
    return JSON.stringify({ highlights: [{ title: "Budget deadline", note: "Budget expires in December.", segment: 1 }] });
  };
}

test("workflow runs in order and grounds every item", async () => {
  const calls: string[] = [];
  const a = await runSequential(fake(calls), input, "fake-model");
  const order = ["analyse", "meeting summary", "decisions", "action items", "moments"];
  assert.equal(calls.length, order.length);
  order.forEach((frag, n) => assert.ok(calls[n].includes(frag), `step ${n}: ${calls[n]}`));
  assert.equal(a.template, "sales");
  assert.equal(a.keyPoints.length, 1, "hallucinated citation dropped");
  assert.equal(a.keyPoints[0].at, m.segments[1].start, "time resolved from segment, not the model");
  assert.equal(a.risks[0].severity, "medium", "bad severity normalised");
  assert.equal(a.actionItems.length, 2, "out-of-range citation dropped");
  assert.equal(a.actionItems[0].owner, "Unassigned");
  assert.ok(a.actionItems.some((x) => x.owner === "Dana Whitfield" && x.due === "Monday"));
  assert.equal(a.decisions[0].owner, "Dana Whitfield");
  assert.deepEqual(a.sections.map((s) => s.key), ["signals", "objections", "competitors", "nextsteps"]);
  assert.match(a.summary, /Northstar/);
  assert.equal(a.model, "fake-model");
});

test("template changes the prompt and the requested sections", async () => {
  const p = (template: "sales" | "interview" | "engineering") => analyzePrompt({ ...input, template }).system;
  assert.match(p("sales"), /Buying signals/);
  assert.match(p("interview"), /Strengths/);
  assert.match(p("engineering"), /Blockers/);
  assert.notEqual(p("sales"), p("interview"));
});

test("callJSON retries once on invalid output, then throws bad_output", async () => {
  let n = 0;
  const ok = await callJSON(async () => (n++ ? '{"v":1}' : "oops"), "s", "u", (r: any) => r.v);
  assert.equal(ok, 1);
  await assert.rejects(callJSON(async () => "never json", "s", "u", (r) => r), (e: any) => e.code === "bad_output");
});

test("callJSON waits out a short 429 and maps hard errors", async () => {
  let n = 0;
  const v = await callJSON(async () => {
    if (n++ === 0) throw Object.assign(new Error("Rate limit. Please try again in 50ms."), { status: 429 });
    return '{"v":2}';
  }, "s", "u", (r: any) => r.v);
  assert.equal(v, 2);
  assert.equal(toAIError({ status: 401, message: "x" }).code, "auth");
  assert.equal(toAIError({ status: 429, message: "x" }).code, "rate_limit");
});

test("verified quotes: non-verbatim quote is dropped for discovery", async () => {
  const d = seedMeetings().find((x) => x.id === "discovery-brightwave-logistics")!;
  const di = { title: d.title, template: "discovery" as const, participants: d.participants, segments: d.segments };
  const real = d.segments.find((s) => /newest hire/.test(s.text))!;
  const c = async (system: string) => {
    if (system.includes("TASK: analyse"))
      return JSON.stringify({ topics: [], keyPoints: [{ text: "k", segment: real.id }], questions: [], risks: [], sections: {
        quotes: [{ text: "my newest hire can use on day one", segment: real.id }, { text: "totally made up quote", segment: real.id }] } });
    return JSON.stringify({ summary: "x".repeat(30), decisions: [], actionItems: [], highlights: [] });
  };
  const a = await runSequential(c, di, "fake");
  assert.equal(a.sections.find((s) => s.key === "quotes")!.items.length, 1);
});

test("ask: answer must cite real sources; invalid markers stripped; not-found is ungrounded", () => {
  const items = seedMeetings().map((meeting) => ({ meeting, state: { userHighlights: [], completedActions: {}, analyses: {} } }));
  const sources = retrieveSources(buildIndex(items), "Which meetings mentioned SSO?", 6);
  assert.ok(sources.length >= 3);
  assert.match(askPrompt("q", sources).user, /\[S1\]/);

  const ok = verifyAnswer({ found: true, answer: "SSO came up in two places [S1, S2] and once elsewhere [S99].", citations: ["S1", "S2", "S99"] }, sources);
  assert.equal(ok.grounded, true);
  assert.deepEqual(ok.citations.map((c) => c.sid), ["S1", "S2"]);
  assert.ok(!ok.answer.includes("S99"));

  const uncited = verifyAnswer({ found: true, answer: "Confident but unsupported.", citations: [] }, sources);
  assert.equal(uncited.grounded, false);
  assert.equal(uncited.answer, NOT_FOUND);

  const nf = verifyAnswer({ found: false, answer: "Nothing about that.", citations: [] }, sources);
  assert.equal(nf.grounded, false);
  assert.equal(nf.citations.length, 0);
});
