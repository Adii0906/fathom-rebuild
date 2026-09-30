import Link from "next/link";
import { CheckSquare, Clock, Loader2, Star, TriangleAlert } from "lucide-react";
import { AvatarStack } from "@/components/meeting/avatar";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import type { MeetingSummary } from "@/lib/summary";
import { TEMPLATES } from "@/lib/templates";

export function MeetingRow({ m, compact = false }: { m: MeetingSummary; compact?: boolean }) {
  return (
    <Link
      href={`/meetings/${m.id}`}
      className="group block rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold leading-snug group-hover:text-primary">{m.title}</h3>
        <div className="flex items-center gap-1.5">
          {m.status === "processing" && <Badge variant="amber"><Loader2 className="size-3 animate-spin" />Processing</Badge>}
          {m.status === "failed" && <Badge variant="rose"><TriangleAlert className="size-3" />Needs retry</Badge>}
          <Badge variant="muted">{TEMPLATES[m.template].label}</Badge>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="size-3" /><LocalTime iso={m.startsAt} /> · {formatDuration(m.durationSec)}</span>
        <AvatarStack participants={m.participants} max={compact ? 3 : 5} />
        <span>{m.participants.length} people</span>
      </div>
      {!compact && <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-foreground/75">{m.preview}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CheckSquare className="size-3.5" />{m.counts.openActions}/{m.counts.actions} open actions</span>
        <span className="inline-flex items-center gap-1"><Star className="size-3.5" />{m.counts.highlights} highlights</span>
      </div>
    </Link>
  );
}
