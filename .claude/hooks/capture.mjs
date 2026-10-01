#!/usr/bin/env node
// Agent capture hook (Claude Code). Appends the verbatim prompt and the final response of every
// turn to .agent-logs/<date>_<time>_<session>.md. Nothing in between: no thinking, no tool calls.
//
//   node capture.mjs prompt     UserPromptSubmit hook: logs the prompt
//   node capture.mjs response   Stop hook: logs the turn's final reply, read from the session transcript
//   node capture.mjs selftest   writes to a temp dir and verifies the format
//
// Hooks receive JSON on stdin ({session_id, transcript_path, cwd, prompt?, ...}). This script never
// blocks or fails a session: any error is written to .agent-logs/.capture-errors.log and ignored.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const mode = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

const logsDir = (cwd) => process.env.AGENT_LOGS_DIR || path.join(cwd, ".agent-logs");
const git = (cmd, cwd) => {
  try {
    return execSync(`git ${cmd}`, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

function readTranscript(p) {
  if (!p || !fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
}

const textOf = (content) =>
  typeof content === "string" ? content : (content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

/** Model of the most recent assistant message in the transcript, if any. */
function lastModel(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    const m = records[i].type === "assistant" && records[i].message?.model;
    if (m && m !== "<synthetic>") return m;
  }
  return undefined;
}

/** Final assistant text of the latest turn: the last assistant record with text, after the last real user prompt. */
function finalResponse(records) {
  let lastUser = -1;
  records.forEach((r, i) => {
    const c = r.message?.content;
    const isToolResult = Array.isArray(c) && c.length > 0 && c.every((b) => b.type === "tool_result");
    if (r.type === "user" && !r.isMeta && !r.isSidechain && !isToolResult) lastUser = i;
  });
  for (let i = records.length - 1; i > lastUser; i--) {
    const r = records[i];
    if (r.type === "assistant" && !r.isSidechain) {
      const t = textOf(r.message?.content).trim();
      if (t) return { text: t, timestamp: r.timestamp, model: r.message?.model };
    }
  }
  return undefined;
}

const shortId = (sid) => sid.slice(0, 8);

function findLog(dir, sid) {
  if (!fs.existsSync(dir)) return undefined;
  const f = fs.readdirSync(dir).find((n) => n.endsWith(`_${shortId(sid)}.md`));
  return f && path.join(dir, f);
}

const stamp = (iso) => iso.slice(0, 19).replace("T", "_").replace(/:/g, "-");

function header(h) {
  return `---
session_id: ${h.sid}
date: ${h.first.slice(0, 10)}
author: ${h.author}
model: ${h.model}
tool: claude-code
project: ${h.project}
total_exchanges: ${h.n}
first_prompt_time: ${h.first}
last_prompt_time: ${h.last}
---

# Session Log - ${h.first.slice(0, 10)}

Session: \`${shortId(h.sid)}\` | Project: \`${h.project}\` | Author: \`${h.author}\`

---
`;
}

function countPrompts(body) {
  return (body.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length;
}

function logPrompt(p) {
  const cwd = p.cwd || process.cwd();
  const dir = logsDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const records = readTranscript(p.transcript_path);
  const model = p.model || lastModel(records) || process.env.ANTHROPIC_MODEL || "unknown";
  const author = git("config github.user", cwd) || git("config user.name", cwd) || os.userInfo().username;
  const project = path.basename(git("rev-parse --show-toplevel", cwd) || cwd);

  let file = findLog(dir, p.session_id);
  let body = "";
  let first = now;
  if (file) {
    const txt = fs.readFileSync(file, "utf8");
    first = txt.match(/^first_prompt_time: (.+)$/m)?.[1] ?? now;
    body = txt.slice(txt.indexOf("\n---\n", 4) + 5); // everything after the front matter
  } else {
    file = path.join(dir, `${stamp(now)}_${shortId(p.session_id)}.md`);
  }
  const n = countPrompts(body) + 1;
  body += `\n[LOG_ENTRY type=PROMPT num=${n} session=${shortId(p.session_id)}]\ntimestamp: ${now}\nmodel: ${model}\n\n${p.prompt ?? ""}\n\n`;
  fs.writeFileSync(file, header({ sid: p.session_id, first, last: now, author, model, project, n }) + body.replace(/^\n?# Session Log[\s\S]*?\n---\n/, "") );
  // (front matter + title block are regenerated each time; the entries below them are only ever appended)
}

async function logResponse(p) {
  const cwd = p.cwd || process.cwd();
  const dir = logsDir(cwd);
  const file = findLog(dir, p.session_id);
  if (!file) return; // no prompt was logged for this session, nothing to pair with
  // The transcript can lag the Stop event slightly; give it a moment.
  let resp;
  for (let i = 0; i < 8 && !resp; i++) {
    resp = finalResponse(readTranscript(p.transcript_path));
    if (!resp) await sleep(250);
  }
  if (!resp) return;
  const txt = fs.readFileSync(file, "utf8");
  const num = countPrompts(txt);
  if (txt.includes(`[LOG_ENTRY type=RESPONSE num=${num} `)) return; // already logged this turn
  const model = resp.model || lastModel(readTranscript(p.transcript_path)) || "unknown";
  fs.appendFileSync(file, `\n[LOG_ENTRY type=RESPONSE num=${num} session=${shortId(p.session_id)}]\ntimestamp: ${resp.timestamp || new Date().toISOString()}\nmodel: ${model}\n\n${resp.text}\n\n`);
}

async function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "capture-selftest-"));
  process.env.AGENT_LOGS_DIR = path.join(tmp, "logs");
  const tr = path.join(tmp, "t.jsonl");
  const sid = "11111111-2222-3333-4444-555555555555";
  const rec = (o) => JSON.stringify(o) + "\n";
  fs.writeFileSync(tr, rec({ type: "user", timestamp: "t0", message: { role: "user", content: "CAPTURE TEST" } })
    + rec({ type: "assistant", timestamp: "2026-01-01T00:00:01.000Z", message: { model: "test-model", role: "assistant", content: [{ type: "tool_use", name: "Bash" }] } })
    + rec({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "x" }] } })
    + rec({ type: "assistant", timestamp: "2026-01-01T00:00:02.000Z", message: { model: "test-model", role: "assistant", content: [{ type: "thinking", thinking: "SECRET THOUGHT" }, { type: "text", text: "Final answer." }] } }));
  const base = { session_id: sid, transcript_path: tr, cwd: tmp };
  await logPrompt({ ...base, prompt: "CAPTURE TEST - selftest\nline two" });
  await logResponse(base);
  await logResponse(base); // idempotent
  await logPrompt({ ...base, prompt: "second prompt" });
  const f = findLog(process.env.AGENT_LOGS_DIR, sid);
  const out = fs.readFileSync(f, "utf8");
  const ok = [
    /^---\nsession_id: 11111111-2222/.test(out),
    /total_exchanges: 2/.test(out),
    /\[LOG_ENTRY type=PROMPT num=1 session=11111111\]/.test(out),
    /\[LOG_ENTRY type=RESPONSE num=1 session=11111111\]/.test(out),
    /\[LOG_ENTRY type=PROMPT num=2 /.test(out),
    /CAPTURE TEST - selftest\nline two/.test(out),
    /Final answer\./.test(out),
    !/SECRET THOUGHT|tool_use/.test(out),
    (out.match(/type=RESPONSE/g) || []).length === 1,
  ];
  fs.rmSync(tmp, { recursive: true, force: true });
  if (ok.every(Boolean)) console.log("capture selftest: OK");
  else { console.error("capture selftest: FAILED", ok); process.exit(1); }
}

try {
  if (mode === "selftest") await selftest();
  else {
    const p = readStdin();
    if (p.session_id) {
      if (mode === "prompt") await logPrompt(p);
      else if (mode === "response") await logResponse(p);
    }
  }
} catch (e) {
  try {
    const d = logsDir(process.cwd());
    fs.mkdirSync(d, { recursive: true });
    fs.appendFileSync(path.join(d, ".capture-errors.log"), `${new Date().toISOString()} ${mode}: ${e?.stack || e}\n`);
  } catch { /* never break the session */ }
  if (mode === "selftest") process.exit(1);
}
