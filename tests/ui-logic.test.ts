import { test } from "node:test";
import assert from "node:assert/strict";
import { activeIndexAt } from "../src/lib/player-utils";
import { formatDate, formatDuration, initials, mmss, splitForHighlight } from "../src/lib/format";
import { openActionsOf, summarize, totalsOf } from "../src/lib/summary";
import { seedMeetings } from "../src/lib/seed/index";

const meetings = seedMeetings(new Date("2026-09-30T12:00:00Z"));
const flagship = meetings[0];

test("activeIndexAt: binary search over segment starts", () => {
  const s = flagship.segments;
  assert.equal(activeIndexAt(s, 0), 0);
  assert.equal(activeIndexAt(s, s[40].start), 40);
  assert.equal(activeIndexAt(s, s[40].start + 0.5), 40);
  assert.equal(activeIndexAt(s, s[41].start - 0.01), 40);
  assert.equal(activeIndexAt(s, 1e9), s.length - 1);
});

test("clicking an analysis timestamp lands on the cited segment", () => {
  const a = flagship.analyses[flagship.defaultTemplate]!;
  for (const x of [...a.actionItems, ...a.decisions, ...a.highlights]) {
    assert.equal(activeIndexAt(flagship.segments, x.at), x.segmentId);
  }
});

test("format helpers", () => {
  assert.equal(mmss(65), "01:05");
  assert.equal(mmss(3725), "1:02:05");
  assert.equal(formatDuration(62 * 60), "1h 02m");
  assert.equal(formatDuration(30 * 60), "30 min");
  assert.equal(initials("Aditya Sharma"), "AS");
  assert.equal(formatDate("2026-09-30T23:30:00Z"), "Sep 30, 2026");
  assert.deepEqual(splitForHighlight("Set up SSO with Okta", "sso okta").filter((p) => p.hit).map((p) => p.t), ["SSO", "Okta"]);
  assert.deepEqual(splitForHighlight("nothing", ""), [{ t: "nothing", hit: false }]);
  assert.doesNotThrow(() => splitForHighlight("a (b) [c]", "(b) [c]"));
});

test("dashboard counts add up", () => {
  const bundles = meetings.map((meeting) => ({ meeting, state: { userHighlights: [], completedActions: {}, analyses: {} } }));
  const rows = bundles.map((b) => summarize(b.meeting, b.state));
  const t = totalsOf(rows);
  assert.equal(t.meetings, meetings.length);
  assert.equal(t.openActions, openActionsOf(bundles).length);
  assert.equal(t.actions, t.openActions, "nothing completed yet");
  const done = { ...bundles[0].state, completedActions: { [flagship.analyses[flagship.defaultTemplate]!.actionItems[0].id]: true } };
  assert.equal(summarize(flagship, done).counts.openActions, summarize(flagship, bundles[0].state).counts.openActions - 1);
  assert.ok(t.highlights >= 15 && t.decisions >= 10);
});
