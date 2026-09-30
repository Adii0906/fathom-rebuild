import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Analysis, Meeting, MeetingState, UserHighlight, TemplateId, CalendarEvent } from "./types";
import { eventsFor, seedMeetings } from "./seed/index";
import { buildIndex, type Index } from "./retrieval";

/* ── key/value backends ───────────────────────────────────────────── */

interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

/** Postgres via Supabase's REST API (table `kv`, see supabase/schema.sql). No SDK needed. */
class SupabaseKV implements KV {
  constructor(private url: string, private key: string) {}
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...extra };
  }
  async get<T>(key: string): Promise<T | null> {
    const r = await fetch(`${this.url}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`, { headers: this.headers(), cache: "no-store" });
    if (!r.ok) throw new Error(`Supabase read failed (${r.status})`);
    const rows = (await r.json()) as { value: T }[];
    return rows[0]?.value ?? null;
  }
  async set(key: string, value: unknown): Promise<void> {
    const r = await fetch(`${this.url}/rest/v1/kv?on_conflict=key`, {
      method: "POST",
      headers: this.headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error(`Supabase write failed (${r.status})`);
  }
}

/** JSON files on disk. Fine locally; on serverless hosts it is per-instance and ephemeral. */
class FileKV implements KV {
  private mem = new Map<string, unknown>();
  constructor(private dir: string) {}
  private file(key: string) {
    return path.join(this.dir, key.replace(/[^a-zA-Z0-9._-]/g, "_") + ".json");
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(this.file(key), "utf8")) as T;
    } catch {
      return (this.mem.get(key) as T | undefined) ?? null;
    }
  }
  async set(key: string, value: unknown): Promise<void> {
    this.mem.set(key, value);
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = this.file(key) + "." + randomUUID() + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(value));
      await fs.rename(tmp, this.file(key));
    } catch {
      /* read-only filesystem: the in-memory copy keeps this instance consistent */
    }
  }
}

let kv: KV | undefined;
export function getKV(): KV {
  if (kv) return kv;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  kv = url && key
    ? new SupabaseKV(url.replace(/\/$/, ""), key)
    : new FileKV(process.env.DATA_DIR ?? (process.env.VERCEL ? path.join(os.tmpdir(), "cadence-data") : path.join(process.cwd(), ".data")));
  return kv;
}
export const persistence = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file") as "supabase" | "file";
/** Test hook. */
export function _resetKV(next?: KV) { kv = next; }

/* ── seed cache (dates are relative to "today", so rebuild once per UTC day) ─ */

let seedCache: { day: string; meetings: Meeting[] } | undefined;
function seeds(): Meeting[] {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (seedCache?.day !== day) seedCache = { day, meetings: seedMeetings(now) };
  return seedCache.meetings;
}

/* ── meetings ─────────────────────────────────────────────────────── */

const emptyState = (): MeetingState => ({ userHighlights: [], completedActions: {}, analyses: {} });

export async function getState(id: string): Promise<MeetingState> {
  return { ...emptyState(), ...((await getKV().get<MeetingState>(`state:${id}`)) ?? {}) };
}

async function importIds(): Promise<string[]> {
  return (await getKV().get<string[]>("imports")) ?? [];
}

/** Seed + imported meetings with any regenerated analyses merged in. */
export async function listMeetings(): Promise<Meeting[]> {
  const kv = getKV();
  const imported = (await Promise.all((await importIds()).map((id) => kv.get<Meeting>(`import:${id}`)))).filter(Boolean) as Meeting[];
  const all = [...seeds(), ...imported];
  const states = await Promise.all(all.map((m) => getState(m.id)));
  return all
    .map((m, i) => ({ ...m, analyses: { ...m.analyses, ...states[i].analyses } }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const seed = seeds().find((m) => m.id === id);
  const m = seed ?? (await getKV().get<Meeting>(`import:${id}`));
  if (!m) return null;
  const st = await getState(id);
  return { ...m, analyses: { ...m.analyses, ...st.analyses } };
}

export async function listBundles(): Promise<{ meeting: Meeting; state: MeetingState }[]> {
  const meetings = await listMeetings();
  const states = await Promise.all(meetings.map((m) => getState(m.id)));
  return meetings.map((meeting, i) => ({ meeting, state: states[i] }));
}

export async function getMeetingBundle(id: string) {
  const meeting = await getMeeting(id);
  return meeting ? { meeting, state: await getState(id) } : null;
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return eventsFor(await listMeetings());
}

export async function getSearchIndex(): Promise<Index> {
  return buildIndex(await listBundles());
}

/* ── mutations ────────────────────────────────────────────────────── */

async function mutate(id: string, fn: (s: MeetingState) => void): Promise<MeetingState> {
  const s = await getState(id);
  fn(s);
  await getKV().set(`state:${id}`, s);
  return s;
}

export async function addUserHighlight(
  id: string,
  h: { segmentId: number; at: number; title: string; note: string },
): Promise<UserHighlight> {
  const hl: UserHighlight = { id: randomUUID(), createdAt: new Date().toISOString(), ...h };
  await mutate(id, (s) => void s.userHighlights.push(hl));
  return hl;
}

export async function removeUserHighlight(id: string, highlightId: string) {
  await mutate(id, (s) => void (s.userHighlights = s.userHighlights.filter((h) => h.id !== highlightId)));
}

export async function updateUserHighlight(id: string, highlightId: string, patch: { title?: string; note?: string }) {
  await mutate(id, (s) => {
    const h = s.userHighlights.find((x) => x.id === highlightId);
    if (h) Object.assign(h, patch);
  });
}

export async function setActionDone(id: string, actionId: string, done: boolean) {
  await mutate(id, (s) => {
    if (done) s.completedActions[actionId] = true;
    else delete s.completedActions[actionId];
  });
}

export async function saveAnalysis(id: string, a: Analysis) {
  await mutate(id, (s) => void (s.analyses[a.template] = a));
}

/* ── imports ──────────────────────────────────────────────────────── */

export function newImportId(title: string) {
  return `imp-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)}-${randomUUID().slice(0, 6)}`;
}

export async function createImport(m: Meeting) {
  const kv = getKV();
  await kv.set(`import:${m.id}`, m);
  const ids = await importIds();
  if (!ids.includes(m.id)) await kv.set("imports", [...ids, m.id]);
}

export async function updateImport(id: string, patch: Partial<Meeting>) {
  const kv = getKV();
  const m = await kv.get<Meeting>(`import:${id}`);
  if (!m) throw new Error("Imported meeting not found");
  await kv.set(`import:${id}`, { ...m, ...patch });
}

export type { TemplateId };
