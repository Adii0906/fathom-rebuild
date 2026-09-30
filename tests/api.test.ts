import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as store from "../src/lib/store";
import { streamAnalysis, AnalyzeError } from "../src/lib/client/analyze";
import { SAMPLE_TRANSCRIPT } from "../src/lib/sample-transcript";
import { STEPS } from "../src/lib/steps";
import * as importRoute from "../src/app/api/import/route";
import * as analyzeRoute from "../src/app/api/meetings/[id]/analyze/route";
import * as hlRoute from "../src/app/api/meetings/[id]/highlights/route";
import * as hlIdRoute from "../src/app/api/meetings/[id]/highlights/[hid]/route";
import * as actRoute from "../src/app/api/meetings/[id]/actions/[actionId]/route";
import * as searchRoute from "../src/app/api/search/route";
import * as askRoute from "../src/app/api/ask/route";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cadence-api-"));
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const post = (url: string, body: unknown) => new Request(`http://t${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Route the client's fetch() straight into the real handlers.
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const m = /^\/api\/meetings\/([^/]+)\/analyze$/.exec(url);
  if (!m) throw new Error(`unexpected fetch ${url}`);
  return analyzeRoute.POST(new Request(`http://t${url}`, init), ctx({ id: decodeURIComponent(m[1]) }));
}) as typeof fetch;

let importedId = "";

test("import: validates, parses, creates a processing meeting", async () => {
  const bad = await importRoute.POST(post("/api/import", { title: "", template: "general", transcript: SAMPLE_TRANSCRIPT }));
  assert.equal(bad.status, 400);
  const badT = await importRoute.POST(post("/api/import", { title: "X", template: "nope", transcript: SAMPLE_TRANSCRIPT }));
  assert.equal(badT.status, 400);
  const empty = await importRoute.POST(post("/api/import", { title: "X", template: "general", transcript: "   " }));
  assert.equal(empty.status, 400);
  assert.match((await empty.json()).error.message, /empty/i);

  const res = await importRoute.POST(post("/api/import", { title: "Mobile Release Planning", template: "product", transcript: SAMPLE_TRANSCRIPT }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.segments >= 20 && body.participants === 4);
  importedId = body.id;
  const m = await store.getMeeting(importedId);
  assert.equal(m!.status, "processing");
  assert.equal(m!.source, "import");
  assert.ok((await store.listMeetings()).some((x) => x.id === importedId));
});

test("analyze: streams every LangGraph step, then marks the import ready", async () => {
  const seen: string[] = [];
  const a = await streamAnalysis(importedId, "product", (e) => seen.push(e.step));
  assert.deepEqual(seen, STEPS.map((s) => s.id));
  assert.equal(a.template, "product");
  assert.ok(a.keyPoints.length && a.actionItems.length && a.decisions.length && a.highlights.length);
  const m = (await store.getMeeting(importedId))!;
  assert.equal(m.status, "ready");
  assert.ok(m.analyses.product);
  // every cited timestamp matches the transcript
  for (const k of a.keyPoints) assert.equal(m.segments[k.segmentId].start, k.at);
});

test("templates: switching template produces different output (and persists both)", async () => {
  const sales = await streamAnalysis(importedId, "sales", () => {});
  const interview = await streamAnalysis(importedId, "interview", () => {});
  const m = (await store.getMeeting(importedId))!;
  assert.deepEqual(Object.keys(m.analyses).sort(), ["interview", "product", "sales"]);
  assert.notDeepEqual(sales.sections.map((s) => s.key), interview.sections.map((s) => s.key));
  assert.notEqual(sales.summary, interview.summary);
  assert.ok(sales.sections.some((s) => s.key === "objections"));
  assert.ok(interview.sections.some((s) => s.key === "strengths"));
});

test("analyze: errors surface as typed events; import meeting flips to failed", async () => {
  const r = await importRoute.POST(post("/api/import", { title: "Will fail", template: "general", transcript: SAMPLE_TRANSCRIPT }));
  const { id } = await r.json();
  (globalThis as { __AI_MODE?: string }).__AI_MODE = "no_key";
  await assert.rejects(streamAnalysis(id, "general", () => {}), (e: unknown) => e instanceof AnalyzeError && e.code === "no_key" && /GROQ_API_KEY/.test(e.message));
  const m = (await store.getMeeting(id))!;
  assert.equal(m.status, "failed");
  assert.match(m.error ?? "", /GROQ_API_KEY/);
  (globalThis as { __AI_MODE?: string }).__AI_MODE = undefined;
  await streamAnalysis(id, "general", () => {}); // retry succeeds
  assert.equal((await store.getMeeting(id))!.status, "ready");
  const bad = await analyzeRoute.POST(post("/x", { template: "nope" }), ctx({ id }));
  assert.equal(bad.status, 400);
  const missing = await analyzeRoute.POST(post("/x", { template: "general" }), ctx({ id: "does-not-exist" }));
  assert.equal(missing.status, 404);
});

test("highlights: create (server resolves time), edit, delete, validation", async () => {
  const id = "acme-enterprise-product-review";
  const m = (await store.getMeeting(id))!;
  const res = await hlRoute.POST(post("/h", { segmentId: 20, title: "Pilot idea", note: "Revisit", at: 99999 }), ctx({ id }));
  assert.equal(res.status, 201);
  const { highlight } = await res.json();
  assert.equal(highlight.at, m.segments[20].start, "client-supplied time is ignored");
  assert.equal((await hlRoute.POST(post("/h", { segmentId: 9999, title: "x" }), ctx({ id }))).status, 400);
  assert.equal((await hlRoute.POST(post("/h", { segmentId: 1, title: "  " }), ctx({ id }))).status, 400);
  assert.equal((await hlRoute.POST(post("/h", { segmentId: 1, title: "t" }), ctx({ id: "nope" }))).status, 404);

  const patch = await hlIdRoute.PATCH(new Request("http://t/h", { method: "PATCH", body: JSON.stringify({ title: "Renamed", note: "n2" }) }), ctx({ id, hid: highlight.id }));
  assert.equal(patch.status, 200);
  assert.equal((await store.getState(id)).userHighlights[0].title, "Renamed");
  await hlIdRoute.DELETE(new Request("http://t/h", { method: "DELETE" }), ctx({ id, hid: highlight.id }));
  assert.equal((await store.getState(id)).userHighlights.length, 0);
});

test("actions: toggle complete / incomplete, rejects unknown items", async () => {
  const id = "acme-enterprise-product-review";
  const aid = `${id}-act-3`;
  const patch = (done: unknown) => actRoute.PATCH(new Request("http://t/a", { method: "PATCH", body: JSON.stringify({ done }) }), ctx({ id, actionId: aid }));
  assert.equal((await patch(true)).status, 200);
  assert.equal((await store.getState(id)).completedActions[aid], true);
  assert.equal((await patch(false)).status, 200);
  assert.equal((await store.getState(id)).completedActions[aid], undefined);
  assert.equal((await patch("yes")).status, 400);
  const nf = await actRoute.PATCH(new Request("http://t/a", { method: "PATCH", body: JSON.stringify({ done: true }) }), ctx({ id, actionId: "bogus" }));
  assert.equal(nf.status, 404);
});

test("search route: finds seeded + imported content with timestamps", async () => {
  const get = async (q: string) => (await (await searchRoute.GET(new Request(`http://t/api/search?q=${encodeURIComponent(q)}`))).json()).hits as { meetingId: string; kind: string; at?: number }[];
  const sso = await get("SSO");
  assert.ok(new Set(sso.map((h) => h.meetingId)).size >= 4);
  const imported = await get("accessibility");
  assert.ok(imported.some((h) => h.meetingId === importedId && h.at !== undefined), "imported transcript is searchable");
  assert.deepEqual(await get("x"), []);
});

test("ask route: grounded answer with verified citations; unanswerable + off-topic are not grounded", async () => {
  const ask = async (question: string) => askRoute.POST(post("/api/ask", { question }));
  const ok = await (await ask("Which meetings mentioned SSO?")).json();
  assert.equal(ok.grounded, true);
  assert.ok(ok.citations.length >= 1 && ok.citations.every((c: { sid: string }) => c.sid !== "S99"));
  assert.ok(!ok.answer.includes("S99"), "invented citation stripped");
  const off = await (await ask("What is the capital of Mongolia?")).json();
  assert.equal(off.grounded, false);
  const none = await (await ask("SSO ZZZ-UNANSWERABLE")).json();
  assert.equal(none.grounded, false);
  assert.equal((await ask("hi")).status, 400);
});
