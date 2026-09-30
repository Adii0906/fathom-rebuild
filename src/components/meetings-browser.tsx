"use client";
import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { MeetingRow } from "@/components/meeting-row";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { MeetingSummary } from "@/lib/summary";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/templates";

const RANGES = [
  { id: "all", label: "Any time", days: Infinity },
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

export function MeetingsBrowser({ meetings, nowIso }: { meetings: MeetingSummary[]; nowIso: string }) {
  const [q, setQ] = useState("");
  const [template, setTemplate] = useState("all");
  const [person, setPerson] = useState("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("all");
  const [sort, setSort] = useState<"new" | "old" | "long">("new");

  const people = useMemo(() => [...new Set(meetings.flatMap((m) => m.participants.map((p) => p.name)))].sort(), [meetings]);

  const shown = useMemo(() => {
    const now = new Date(nowIso).getTime();
    const days = RANGES.find((r) => r.id === range)!.days;
    const term = q.trim().toLowerCase();
    const list = meetings.filter((m) => {
      if (template !== "all" && m.template !== template) return false;
      if (person !== "all" && !m.participants.some((p) => p.name === person)) return false;
      if (Number.isFinite(days) && now - new Date(m.startsAt).getTime() > days * 86400_000) return false;
      if (!term) return true;
      const hay = `${m.title} ${m.tags.join(" ")} ${m.participants.map((p) => p.name).join(" ")} ${m.preview}`.toLowerCase();
      return term.split(/\s+/).every((w) => hay.includes(w));
    });
    return list.sort((a, b) =>
      sort === "long" ? b.durationSec - a.durationSec
      : sort === "old" ? a.startsAt.localeCompare(b.startsAt)
      : b.startsAt.localeCompare(a.startsAt));
  }, [meetings, q, template, person, range, sort, nowIso]);

  const filtered = q || template !== "all" || person !== "all" || range !== "all";
  const reset = () => { setQ(""); setTemplate("all"); setPerson("all"); setRange("all"); };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_11rem_10rem_10rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title, person, tag…" aria-label="Filter meetings" className="h-10 sm:col-span-2 lg:col-span-1" />
        <Select value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Template" className="h-10">
          <option value="all">All templates</option>
          {TEMPLATE_IDS.map((t) => <option key={t} value={t}>{TEMPLATES[t].label}</option>)}
        </Select>
        <Select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Participant" className="h-10">
          <option value="all">Anyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} aria-label="Date range" className="h-10">
          {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="h-10">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="long">Longest first</option>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">{shown.length} of {meetings.length} meetings</p>
      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="No meetings match those filters">
          <Button variant="outline" size="sm" className="mt-3" onClick={reset}>Clear filters</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">{shown.map((m) => <MeetingRow key={m.id} m={m} />)}</div>
      )}
      {filtered && shown.length > 0 && <div className="text-center"><Button variant="ghost" size="sm" onClick={reset}>Clear filters</Button></div>}
    </div>
  );
}
