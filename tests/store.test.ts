import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as store from "../src/lib/store";
import { search } from "../src/lib/retrieval";

// store reads DATA_DIR lazily, so setting it after the (hoisted) import is fine
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cadence-test-"));

test("lists seeded meetings newest first", async () => {
  const ms = await store.listMeetings();
  assert.ok(ms.length >= 8);
  const dates = ms.map((m) => m.startsAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("highlights persist across a fresh backend instance", async () => {
  const h = await store.addUserHighlight("acme-enterprise-product-review", { segmentId: 14, at: 100, title: "Retention", note: "Day-two drop-off" });
  store._resetKV(); // simulate a restart: new KV reading from disk
  const st = await store.getState("acme-enterprise-product-review");
  assert.equal(st.userHighlights.length, 1);
  await store.updateUserHighlight("acme-enterprise-product-review", h.id, { note: "edited" });
  assert.equal((await store.getState("acme-enterprise-product-review")).userHighlights[0].note, "edited");
  await store.removeUserHighlight("acme-enterprise-product-review", h.id);
  assert.equal((await store.getState("acme-enterprise-product-review")).userHighlights.length, 0);
});

test("action completion toggles", async () => {
  const id = "acme-enterprise-product-review";
  await store.setActionDone(id, `${id}-act-1`, true);
  assert.equal((await store.getState(id)).completedActions[`${id}-act-1`], true);
  await store.setActionDone(id, `${id}-act-1`, false);
  assert.equal((await store.getState(id)).completedActions[`${id}-act-1`], undefined);
});

test("imports appear in the list; regenerated analysis merges in", async () => {
  const base = (await store.getMeeting("weekly-leadership-sync"))!;
  const imp = { ...base, id: store.newImportId("My Import"), title: "My Import", source: "import" as const, analyses: {} };
  await store.createImport(imp);
  assert.ok((await store.listMeetings()).some((m) => m.id === imp.id));
  const a = { ...base.analyses.general!, template: "sales" as const };
  await store.saveAnalysis("weekly-leadership-sync", a);
  assert.ok((await store.getMeeting("weekly-leadership-sync"))!.analyses.sales);
  assert.equal(await store.getMeeting("nope"), null);
});

test("search index includes user highlights", async () => {
  await store.addUserHighlight("weekly-engineering-sync", { segmentId: 1, at: 30, title: "zebra unicorn moment", note: "" });
  const hits = search(await store.getSearchIndex(), "zebra");
  assert.ok(hits.some((h) => h.kind === "highlight" && h.meetingId === "weekly-engineering-sync" && h.at === 30));
});
