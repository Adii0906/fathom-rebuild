# Cadence: meeting intelligence

A Fathom-style meeting assistant built for a 24-hour assignment: record → transcript → AI summary, decisions, action items and highlights, plus search and "ask across all meetings" with cited answers.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS + shadcn/ui · LangChain + **LangGraph** · **Groq** · optional Supabase/Postgres.

> The real meeting-capture layer (Zoom/Meet/Teams bot) is **intentionally stubbed**. See [Capture layer](#capture-layer-intentionally-stubbed).

---

## Run it locally

Prerequisites: **Node 20.9+** (Node 22 recommended) and a free [Groq API key](https://console.groq.com/keys).

```bash
git clone https://github.com/Adii0906/fathom-rebuild && cd fathom-rebuild
git checkout claude/happy-hopper-jytoyu      # until this is merged to main

npm install

cp .env.example .env.local                   # then edit it
#   GROQ_API_KEY=gsk_...                     (required for AI generation, never commit this)

npm run dev                                  # http://localhost:3000
```

The app is fully populated on first load, because the seed data needs no API key or database. `GROQ_API_KEY` is only used when you:

- switch a meeting to a template that hasn't been generated yet,
- import a meeting, or
- use **Ask AI**.

Missing or invalid keys produce a clear in-page error with a retry button; nothing crashes.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | for AI features | Server-side only. Never exposed to the browser, never prefixed `NEXT_PUBLIC_`. |
| `GROQ_MODEL` | no | Default `llama-3.3-70b-versatile`. On Groq's free tier use `llama-3.1-8b-instant` if you hit tokens-per-minute limits. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | no | Persist highlights / action state / imports in Postgres. Without them a JSON file store is used (`./.data`). |

`.env*` files are git-ignored (except `.env.example`).

### Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # 39 logic + API tests, no install needed beyond Node 22.7+
```

---

## Feature map

| Area | What works |
|---|---|
| **Dashboard** | Meeting / action / highlight / decision counts, recent meetings, open action items (deep-linked to the moment), upcoming calendar, Ask box, global search, Import button |
| **Meetings** | 8 seeded meetings; filter by text, template, participant, date range; sort |
| **Meeting detail** | Player, timestamped transcript, summary, key points, decisions, questions, risks, action items, highlights, participants (with talk-time) |
| **Transcript ↔ player** | Click any line, timestamp, action, decision or highlight to jump to that time. Active line follows playback. Timeline is coloured by speaker with highlight markers. Deep links: `/meetings/<id>?t=<seconds>` |
| **Templates** | General, Sales Call, Product Meeting, Engineering Sync, Customer Discovery, Interview. Each changes the prompt, summary style, focus and the **extra sections** produced (e.g. *Buying signals / Objections* vs *Strengths / Concerns*). Generated on demand with live progress; results are cached per template |
| **Highlights & actions** | Star any line (or "Highlight moment" while playing), add title + note, edit/delete, revisit and jump. Tick action items off (persisted), filter by owner |
| **Search** | Transcripts, action items, decisions, highlights, summaries. Live dropdown + full results page with filters. Every result opens the meeting at the timestamp |
| **Ask across meetings** | Retrieve → Groq → answer with `[n]` citation chips and source cards (meeting + timestamp) |
| **Sharing** | `/meetings/share/<id>` is public, read-only and has no app chrome. Summary, transcript, highlights, actions and recording/player all work without any session |
| **Calendar** | Month grid + agenda; recorded vs scheduled; select a day; upcoming events link into Import |
| **Import** | Paste / upload `.txt` `.vtt` `.srt` → Processing → LangGraph analysis (live step list) → Meeting created. Includes a one-click sample |

---

## Architecture

```
src/
  app/
    (app)/                     # pages inside the app shell
      page.tsx                 #   dashboard
      meetings/, meetings/[id] #   list + detail
      calendar/ search/ ask/ import/
    meetings/share/[id]/       # PUBLIC read-only share page (no shell)
    api/                       # route handlers (see below)
  components/
    meeting/                   # player, transcript, insights, meeting-view
    ui/                        # shadcn/ui primitives
  lib/
    seed/                      # flagship + 7 meetings, authored as data
    ai/core/                   # prompts, JSON parse/retry, grounding checks, node bodies (pure, tested)
    ai/analysis-graph.ts       # LangGraph: meeting analysis
    ai/ask-graph.ts            # LangGraph: ask across meetings
    ai/model.ts                # ChatGroq wrapper (the only place the key is read)
    retrieval.ts               # BM25 search + retrieval + synonyms
    transcript-parse.ts        # [mm:ss] / VTT / SRT / plain parsing
    store.ts                   # file or Supabase key-value persistence
tests/                         # node:test suites
supabase/schema.sql            # one table
```

**Data model.** Seed meetings are code (`lib/seed`), so the app never depends on a database to look full. Mutable state (your highlights, completed actions, regenerated analyses, imported meetings) lives in a tiny key-value store: JSON files locally, or one Postgres table (`kv`) on Supabase, accessed through Supabase's REST API with the service-role key **on the server only**. Seed dates are relative to "today", so the calendar and dashboard always look current.

### API routes

| Route | Purpose |
|---|---|
| `POST /api/meetings/[id]/analyze` | Runs the LangGraph workflow and streams one SSE event per node (`step` → `done` / `error`) |
| `POST /api/import` | Parses a transcript and creates a `processing` meeting |
| `POST /api/ask` | Ask-across-meetings graph |
| `GET /api/search?q=` | Search across everything |
| `POST /api/meetings/[id]/highlights`, `PATCH/DELETE …/[hid]` | Highlight CRUD (timestamp is resolved from the transcript server-side) |
| `PATCH /api/meetings/[id]/actions/[actionId]` | Complete / reopen an action item |

### LangGraph: meeting analysis

```
START → analyze → summarize → extractDecisions → extractActions → pickHighlights → finalize → END
```

| Node | Output |
|---|---|
| `analyze` | topics, key points, questions, risks, **template-specific sections** |
| `summarize` | summary in the template's style, written from the *verified* analysis only (cheap, no re-send of the transcript) |
| `extractDecisions` | things actually agreed, with owner |
| `extractActions` | commitments with owner and spoken deadline |
| `pickHighlights` | the 3-6 moments that matter |
| `finalize` | assembles the `Analysis`, sorted by time |

Every node calls Groq through LangChain's `ChatGroq` and must return JSON. The node functions live in `lib/ai/core/nodes.ts` (framework-free, tested with a fake model); `analysis-graph.ts` wires them into a `StateGraph`. The route streams the graph's `updates` so the UI shows **real** progress, not a fake spinner.

### LangGraph: ask across meetings

```
START → retrieve ─┬─ sources found ──→ generate → verify → END
                  └─ nothing relevant → empty ─────────────→ END
```

1. **retrieve**: BM25 over transcript turns, action items, decisions, highlights and summaries (with a small synonym map, so *SSO* also finds *SAML / Okta*). Low-scoring matches are discarded.
2. **generate**: Groq answers **only** from the numbered sources and must cite `[S#]`.
3. **verify**: citations to sources that weren't provided are stripped; an answer with no valid citation is **not** shown as grounded.
4. **empty**: if retrieval finds nothing relevant, **the model is never called**, so it cannot invent an answer.

### How the model is kept from inventing things

- Every extracted item must cite a transcript segment (`[s12 04:31]`). Items citing a non-existent segment are **dropped**.
- Timestamps come from the transcript segment, **never from the model**.
- Owners must be a real participant, otherwise `Unassigned`. Deadlines only if spoken.
- "Verbatim quotes" (Customer Discovery) are kept only if they literally appear in the cited line.
- Ask answers are citation-checked (above); not-found is a first-class, visible state.
- Invalid JSON gets one corrective retry; short 429s are waited out; other failures become typed, user-readable errors (`no_key`, `auth`, `rate_limit`, `bad_output`, …).

### Groq notes

Default model `llama-3.3-70b-versatile` for extraction quality. A one-hour meeting is ~13k tokens and the workflow makes ~4 full-transcript calls, so the **free tier's tokens-per-minute limit can trigger 429s**. The app waits out short limits automatically; for long transcripts on the free tier set `GROQ_MODEL=llama-3.1-8b-instant`, or use a paid tier. Transcripts above ~100k characters (~2 h) are rejected with a clear message rather than silently truncated.

---

## Seed data

| Meeting | Template | Notes |
|---|---|---|
| **Acme Enterprise Product Review** (flagship) | Product | **~62 min · 8 participants · 152 transcript segments** · 14 action items · 3 decisions · 5 highlights · 3 questions · 5 risks |
| Weekly Engineering Sync | Engineering | webhook incident, SAML status, latency |
| Discovery Call: Brightwave Logistics | Customer Discovery | customer pains on onboarding / SSO, verbatim quotes |
| Northstar Bank: Demo & Pricing | Sales Call | buying signals, objections, competitors |
| Q4 Roadmap Planning | Product | prioritisation trade-offs |
| Interview: Senior Frontend Engineer | Interview | strengths / concerns with evidence |
| Helix Health Onboarding Retro | General | customer onboarding feedback |
| Weekly Leadership Sync | General | pipeline, hiring, account health |

Plus 6 upcoming calendar events. Seed meetings are authored as a script plus tagged analysis; the builder computes timestamps from word counts and resolves every reference to a real segment, and the tests fail if any reference is dangling. The seed analyses are hand-written (they carry `model: "seed"` and are labelled "Sample analysis" in the UI); regenerating with Groq replaces them.

The content is deliberately cross-referenced so the sample questions work: *"What did customers say about onboarding?"*, *"Which meetings mentioned SSO?"*, *"What action items are assigned to Aditya?"*

---

## Capture layer (intentionally stubbed)

**Tradeoff.** A production meeting bot (Zoom/Meet/Teams SDKs, OAuth, media ingestion, diarised streaming ASR) is weeks of work and orthogonal to the product's intelligence layer, so it is stubbed, as the assignment allows.

**What stands in for it:**

```
Import Meeting  →  Processing  →  LangGraph analysis (Groq)  →  Meeting created
 (paste/upload)   (parse + store)   (live step list)             (opens detail page)
```

The downstream pipeline is the same one a real capture would feed: a transcript with speakers and timestamps goes in; analysis, search and Ask all work on it.

**Recording playback.** The seed meetings have transcripts but no audio files, so the player runs a **simulated timeline clock** (labelled "Simulated recording"). Transcript click-to-seek, the active-line follow, the speaker timeline and deep links all behave exactly as they would with audio; the "read aloud" toggle uses the browser's speech synthesis so jumps are audible too. When an imported meeting has a **Recording URL**, the player uses a real `<audio>` element instead (and falls back to the simulated clock if the file fails to load).

---

## Sharing

`/meetings/share/<meeting-id>` is a normal public route: no auth, no app shell, `noindex`, read-only (no highlight creation or action toggling). The **Copy share link** button on any meeting produces it.

> **Security note.** This build has **no authentication** by design (single demo workspace), and share links use the meeting id. Anyone with the app URL can browse meetings. Before a real deployment add auth (e.g. Supabase Auth) and unguessable share tokens, and scope `kv` rows per user.

---

## Deployment (Vercel)

1. Push the repo to GitHub and import it in Vercel (framework: Next.js, no config needed).
2. Set environment variables: `GROQ_API_KEY`, optionally `GROQ_MODEL`, and (recommended) `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `supabase/schema.sql` in your Supabase project's SQL editor.
4. Deploy. The analyze and ask routes set `maxDuration = 60`. On Vercel's Hobby plan that's the cap; an analysis of a typical meeting finishes well inside it, very long transcripts on slow models may not.

**Without Supabase on Vercel**, state falls back to `/tmp`, which is per-instance and ephemeral: seeded meetings still always appear, but highlights/imports may not persist between requests. Use Supabase for anything beyond a demo.

**Verify after deploy:** dashboard shows 8 meetings, open the flagship (152 segments), click a transcript line and confirm the player jumps, open `/meetings/share/acme-enterprise-product-review` in an incognito window, run *Ask AI*.

---

## Testing

`npm test` runs 39 tests with Node's built-in runner (no install needed beyond Node 22.7+):

- **Seed integrity:** ≥8 meetings, flagship size, monotonic timestamps, every AI reference resolves to a real segment.
- **Parsing:** bracket/trailing timestamps, VTT, SRT, continuation lines, empty input.
- **Retrieval/search:** SSO across meetings, action items by owner, off-topic returns nothing.
- **AI grounding:** hallucinated citations/owners/quotes are dropped, JSON retry, 429 wait, template-specific prompts, Ask citation verification.
- **API routes** (real handlers): import → analyze SSE stream → status transitions, template switching produces different output, failure → `failed` → retry, highlight CRUD (server-resolved time), action toggle, search, ask.
- **Transcript → timestamp:** every analysis timestamp maps back to its segment via the same function the player uses.

The LangGraph wiring and `ChatGroq` call are exercised in tests through a shim that runs the same node functions with a fake model; the real `@langchain/*` packages are only exercised when you run the app with a key.

### Manual QA checklist

- [ ] Dashboard: counts, recent meetings, open actions, search, Import, calendar card
- [ ] Meetings: filters and sort
- [ ] Flagship: play, click transcript lines, click action/decision/highlight timestamps, scrub the timeline, try 2× speed
- [ ] Switch template → progress steps → different sections; switch back (instant, cached)
- [ ] Star a line, add title/note, edit, delete, reload (persists)
- [ ] Tick an action item, reload (persists)
- [ ] Search `SSO`; click a transcript result → opens at the moment
- [ ] Ask the three sample questions; click a citation; ask something unrelated (should say not found)
- [ ] Remove `GROQ_API_KEY`, switch template → clear error + retry
- [ ] Import the sample → processing steps → meeting opens
- [ ] `/meetings/share/acme-enterprise-product-review` in an incognito window
- [ ] Phone width: nav drawer, stacked layout, calendar dots

---

## Known limitations

- No auth / multi-tenancy (see Sharing).
- Retrieval is lexical (BM25 + synonyms), not embeddings; good at this scale, and answers are still citation-verified.
- Speaker identity comes from the transcript text; there is no diarisation.
- Dates on seed data are relative to the current day; times render in the viewer's timezone (calendar days are grouped in UTC).
- Only light theme.
- `.agent-logs/` is not touched or ignored by this project.
