# CAPTURE-TEST

**Status: capture installed, canaries NOT YET RUN.** The sections marked PENDING must be filled in by the author with real output from a local run. Nothing below is simulated.

## 1. Tool and model

- **Tool:** Claude Code (the app was first built in a Claude Code cloud session; the author runs and continues it locally with Claude Code).
- **Model:** `claude-sonnet-5-5`, which both plans and executes. There is no separate planner model.
- **Hook / lifecycle mechanism available:** yes. Claude Code supports hooks configured in `.claude/settings.json`. `UserPromptSubmit` fires on every prompt (payload includes the prompt text), and `Stop` fires at end of turn (payload includes `transcript_path`).

## 2. Mechanism

- **Config file changed:** `.claude/settings.json` (wires `UserPromptSubmit` and `Stop`)
- **Script:** `.claude/hooks/capture.mjs` (Node, no dependencies)
  - `prompt` mode appends the verbatim prompt, a UTC timestamp and the model name.
  - `response` mode reads the session transcript and appends the turn's **final** assistant text only (no thinking, no tool calls, no intermediate steps).
  - It never blocks or fails a session; errors go to `.agent-logs/.capture-errors.log`.
- **Output:** `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`, in the format from the assignment brief.
- `.agent-logs/` is not git-ignored.

Verified so far (by the assistant, in a sandbox, not a substitute for the canaries below):
- `node .claude/hooks/capture.mjs selftest` passes: front matter, `PROMPT`/`RESPONSE` entries, `total_exchanges`, multi-line prompts preserved, thinking and tool calls excluded, idempotent on repeated `Stop`.
- The response parser was run against a real Claude Code session transcript (output discarded) and extracted the model name and final text correctly.

## 3. Canary results

Run these locally after pulling this branch, then paste the raw entries here.

1. In the repo, open Claude Code and send: `CAPTURE TEST — 8x assignment, <your name>`
2. Confirm both the prompt and the response appear in `.agent-logs/`.
3. Exit, start a **second, new** session, send another canary, and confirm it lands too (a new file or the same hook firing again).

**Log file path the canaries landed in:** PENDING

**Canary 1 (raw):** PENDING

**Canary 2 (raw, second session):** PENDING

## 4. What did not work / disclosure

- **The capture setup was installed after the build, not before.** The assignment's capture instructions were provided after the application had already been built in a Claude Code cloud session, so that earlier session has **no automatic capture**. No logs for it were written by hand or reconstructed, and none will be.
- The app code was committed before this hook existed; commit order shows that.
- Hook behaviour on the author's OS (Windows paths in `$CLAUDE_PROJECT_DIR`, shell used to run the hook command) is unverified until the canaries above are run. If the command fails, check `.agent-logs/.capture-errors.log`.
