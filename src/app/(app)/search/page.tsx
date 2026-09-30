import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, FileText, Gavel, Search, Sparkles, Star, Video } from "lucide-react";
import { EmptyState } from "@/components/states";
import { SearchBox } from "@/components/search-box";
import { mmss, splitForHighlight } from "@/lib/format";
import { search } from "@/lib/retrieval";
import { getSearchIndex } from "@/lib/store";
import type { SearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const KINDS: { id: SearchHit["kind"]; label: string; icon: typeof Video }[] = [
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "action", label: "Action items", icon: CheckSquare },
  { id: "decision", label: "Decisions", icon: Gavel },
  { id: "highlight", label: "Highlights", icon: Star },
  { id: "meeting", label: "Meetings & summaries", icon: Video },
];
const SUGGESTIONS = ["SSO", "onboarding", "audit log", "pricing", "Aditya", "data residency"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const kind = KINDS.find((k) => k.id === sp.kind)?.id;
  const all = q.length >= 2 ? search(await getSearchIndex(), q, 80) : [];
  const counts = new Map<string, number>();
  for (const h of all) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const hits = kind ? all.filter((h) => h.kind === kind) : all;
  const href = (k?: string) => `/search?q=${encodeURIComponent(q)}${k ? `&kind=${k}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Across meetings, transcripts, action items, decisions and highlights.</p>
      </div>
      <div className="max-w-2xl"><SearchBox key={q} autoFocus={!q} initialQuery={q} /></div>

      {q.length < 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Try:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{s}</Link>)}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href()} className={cn("rounded-full border px-3 py-1 text-xs font-medium", !kind ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>All · {all.length}</Link>
            {KINDS.filter((k) => counts.get(k.id)).map((k) => (
              <Link key={k.id} href={href(k.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", kind === k.id ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>
                <k.icon className="size-3" />{k.label} · {counts.get(k.id)}
              </Link>
            ))}
            <Link href={`/ask?q=${encodeURIComponent(q)}`} className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><Sparkles className="size-3.5" />Ask AI about &ldquo;{q}&rdquo;</Link>
          </div>

          {hits.length === 0 ? (
            <EmptyState icon={Search} title={`No results for “${q}”`}>Try a different word, or ask a question with Ask AI.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {hits.map((h, i) => {
                const K = KINDS.find((k) => k.id === h.kind)!;
                return (
                  <li key={i}>
                    <Link
                      href={`/meetings/${h.meetingId}${h.at !== undefined ? `?t=${h.at}` : ""}`}
                      className="block rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80"><K.icon className="size-3" />{K.label}</span>
                        <span className="font-medium text-foreground/80">{h.meetingTitle}</span>
                        {h.at !== undefined && <span className="tabular-nums">▶ {mmss(h.at)}</span>}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed">
                        {splitForHighlight(h.snippet, q).map((p, j) => p.hit ? <mark key={j} className="rounded bg-amber-200/70 px-0.5 text-inherit">{p.t}</mark> : <span key={j}>{p.t}</span>)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
