import Link from "next/link";
import { ArrowRight, CalendarDays, CheckSquare, Clock, Plus, Sparkles, Star, Video } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { MeetingRow } from "@/components/meeting-row";
import { AskLauncher } from "@/components/ask-launcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import { formatDuration, mmss } from "@/lib/format";
import { getCalendarEvents, listBundles } from "@/lib/store";
import { openActionsOf, summarize, totalsOf } from "@/lib/summary";

export const dynamic = "force-dynamic";

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Video; label: string; value: string | number; hint: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="size-4" />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}

export default async function Dashboard() {
  const bundles = await listBundles();
  const rows = bundles.map((b) => summarize(b.meeting, b.state));
  const t = totalsOf(rows);
  const open = openActionsOf(bundles).slice(0, 7);
  const now = Date.now();
  const upcoming = (await getCalendarEvents()).filter((e) => !e.meetingId && new Date(e.startsAt).getTime() > now).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything your meetings decided, promised and flagged, in one place.</p>
        </div>
        <Button asChild><Link href="/import"><Plus /> Import meeting</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Video} label="Meetings" value={t.meetings} hint={`${Math.round(t.seconds / 3600)} hours recorded`} />
        <Stat icon={CheckSquare} label="Action items" value={t.actions} hint={`${t.openActions} still open`} />
        <Stat icon={Star} label="Highlights" value={t.highlights} hint="AI picks + your own" />
        <Stat icon={Sparkles} label="Decisions" value={t.decisions} hint="Captured automatically" />
      </div>

      <AskLauncher />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent meetings</h2>
            <Link href="/meetings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Video} title="No meetings yet">Import a transcript to create your first meeting.</EmptyState>
          ) : (
            <div className="space-y-3">{rows.slice(0, 5).map((m) => <MeetingRow key={m.id} m={m} />)}</div>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="size-4 text-primary" /> Open action items</CardTitle><Badge variant="muted">{t.openActions}</Badge></CardHeader>
            <CardContent>
              {open.length === 0 ? <p className="text-sm text-muted-foreground">Nothing open. Nice.</p> : (
                <ul className="divide-y">
                  {open.map((a) => (
                    <li key={a.id} className="py-2.5 first:pt-0">
                      <Link href={`/meetings/${a.meetingId}?t=${a.at}`} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <p className="line-clamp-2 text-sm leading-snug hover:text-primary">{a.text}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{a.owner}</span>
                          {a.due && <span>· due {a.due}</span>}
                          <span className="truncate">· {a.meetingTitle} @ {mmss(a.at)}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> Upcoming</CardTitle><Link href="/calendar" className="text-xs font-medium text-primary hover:underline">Calendar</Link></CardHeader>
            <CardContent>
              {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming meetings.</p> : (
                <ul className="space-y-3">
                  {upcoming.map((e) => (
                    <li key={e.id} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Clock className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground"><LocalTime iso={e.startsAt} /> · {formatDuration(e.durationSec)} · {e.platform}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
