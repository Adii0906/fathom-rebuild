"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, PlayCircle, Plus, Users, Video } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dayKey, formatDuration } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function EventCard({ e, isPast }: { e: CalendarEvent; isPast: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{e.title}</p>
        {e.meetingId ? <Badge><PlayCircle className="size-3" />Recorded</Badge> : <Badge variant="sky">{isPast ? "Not recorded" : "Scheduled"}</Badge>}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="size-3" /><LocalTime iso={e.startsAt} variant="time" /> · {formatDuration(e.durationSec)}</span>
        <span className="inline-flex items-center gap-1"><Video className="size-3" />{e.platform}</span>
        <span className="inline-flex items-center gap-1"><Users className="size-3" />{e.attendees.length}</span>
      </p>
    </>
  );
  return e.meetingId ? (
    <Link href={`/meetings/${e.meetingId}`} className="block rounded-lg border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>
  ) : (
    <div className="rounded-lg border bg-card p-3">
      {body}
      <Button asChild size="sm" variant="outline" className="mt-2.5">
        <Link href={`/import?title=${encodeURIComponent(e.title)}`}><Plus /> Import transcript</Link>
      </Button>
    </div>
  );
}

export function CalendarView({ events, nowIso }: { events: CalendarEvent[]; nowIso: string }) {
  const now = new Date(nowIso);
  const todayKey = dayKey(nowIso);
  const [cursor, setCursor] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const [selected, setSelected] = useState(todayKey);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(e.startsAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  // 6 weeks starting on the Sunday on/before the 1st; Date.UTC normalises month overflow for us.
  const cells = useMemo(() => {
    const lead = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(Date.UTC(cursor.y, cursor.m, 1 - lead + i));
      return { key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === cursor.m };
    });
  }, [cursor]);

  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));
  const move = (delta: number) => setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const dayEvents = (byDay.get(selected) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = events.filter((e) => new Date(e.startsAt) > now).slice(0, 5);
  const selectedLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${selected}T12:00:00Z`));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => { setCursor({ y: now.getUTCFullYear(), m: now.getUTCMonth() }); setSelected(todayKey); }}>Today</Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => move(1)} aria-label="Next month"><ChevronRight /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-y bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const key = c.key;
            const list = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSel = key === selected;
            return (
              <button
                key={i} type="button" onClick={() => setSelected(key)}
                aria-label={`${key}${list.length ? `, ${list.length} meetings` : ""}`} aria-pressed={isSel}
                className={cn(
                  "relative min-h-[64px] border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[104px]",
                  (i + 1) % 7 === 0 && "border-r-0",
                  !c.inMonth && "bg-muted/30 text-muted-foreground/60",
                  isSel && "bg-accent/60 hover:bg-accent/60",
                )}
              >
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground")}>{c.day}</span>
                <span className="mt-1 hidden space-y-1 sm:block">
                  {list.slice(0, 2).map((e) => (
                    <span key={e.id} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium", e.meetingId ? "bg-primary/10 text-primary" : "bg-sky-100 text-sky-900")}>{e.title}</span>
                  ))}
                  {list.length > 2 && <span className="block px-1.5 text-[11px] text-muted-foreground">+{list.length - 2} more</span>}
                </span>
                <span className="mt-1 flex gap-0.5 sm:hidden">{list.slice(0, 3).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", e.meetingId ? "bg-primary" : "bg-sky-500")} />)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 p-3 text-xs text-muted-foreground sm:px-5">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Recorded</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" />Scheduled</span>
        </div>
      </Card>

      <aside className="space-y-6">
        <Card>
          <CardHeader><CardTitle>{selectedLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {dayEvents.length === 0 ? <p className="text-sm text-muted-foreground">No meetings on this day.</p> : dayEvents.map((e) => <EventCard key={e.id} e={e} isPast={new Date(e.startsAt) <= now} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Coming up</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled.</p> : (
              <ul className="divide-y">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => { setSelected(dayKey(e.startsAt)); const d = new Date(e.startsAt); setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); }} className="block w-full py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <p className="truncate text-sm font-medium hover:text-primary">{e.title}</p>
                      <p className="text-xs text-muted-foreground"><LocalTime iso={e.startsAt} variant="datetime" /></p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="text-xs leading-relaxed text-muted-foreground">Live recording bots for Zoom, Meet and Teams are intentionally stubbed. Use <Link href="/import" className="font-medium text-primary hover:underline">Import meeting</Link> to push a transcript through the same analysis pipeline.</p>
      </aside>
    </div>
  );
}
