export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
};

export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, "0")}m` : `${h}h`;
}

const UTC = "UTC";
/** Deterministic (server === client) date formatting; <LocalTime> upgrades to the viewer's zone. */
export function formatDate(iso: string, variant: "date" | "datetime" | "time" | "day" = "date", timeZone: string | undefined = UTC): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    variant === "time" ? { hour: "numeric", minute: "2-digit", timeZone }
    : variant === "day" ? { weekday: "short", month: "short", day: "numeric", timeZone }
    : variant === "datetime" ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }
    : { month: "short", day: "numeric", year: "numeric", timeZone };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

/** YYYY-MM-DD in UTC; the calendar groups by this. */
export const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Distinct, accessible-on-white pairs (bg / text / solid). */
export const SPEAKER_PALETTE = [
  { bg: "bg-emerald-100", text: "text-emerald-800", solid: "bg-emerald-500" },
  { bg: "bg-sky-100", text: "text-sky-800", solid: "bg-sky-500" },
  { bg: "bg-violet-100", text: "text-violet-800", solid: "bg-violet-500" },
  { bg: "bg-amber-100", text: "text-amber-800", solid: "bg-amber-500" },
  { bg: "bg-rose-100", text: "text-rose-800", solid: "bg-rose-500" },
  { bg: "bg-teal-100", text: "text-teal-800", solid: "bg-teal-500" },
  { bg: "bg-indigo-100", text: "text-indigo-800", solid: "bg-indigo-500" },
  { bg: "bg-orange-100", text: "text-orange-800", solid: "bg-orange-500" },
] as const;

/** Split text into pieces, flagging the ones that match a query word (for <mark>). */
export function splitForHighlight(text: string, query: string): { t: string; hit: boolean }[] {
  const words = query.toLowerCase().match(/[a-z0-9][a-z0-9'-]+/g)?.filter((w) => w.length > 1) ?? [];
  if (!words.length) return [{ t: text, hit: false }];
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const exact = new RegExp(`^(?:${alt})$`, "i");
  return text.split(new RegExp(`(${alt})`, "gi")).filter(Boolean).map((t) => ({ t, hit: exact.test(t) }));
}
