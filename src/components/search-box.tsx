"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { mmss } from "@/lib/format";
import type { SearchHit } from "@/lib/types";

const KIND: Record<SearchHit["kind"], string> = { meeting: "Meeting", transcript: "Transcript", action: "Action", highlight: "Highlight", decision: "Decision" };

export function SearchBox({ autoFocus = false, initialQuery = "" }: { autoFocus?: boolean; initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false); // stays closed until the user types, even with an initial query
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`, { signal: ctl.signal });
        const j = await r.json();
        setHits(j.hits ?? []);
      } catch {
        /* aborted or offline: keep the previous results */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={submit} role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search meetings, transcripts, actions…"
          aria-label="Search"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </form>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border bg-card shadow-lg animate-fade-in">
          {hits.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {hits.map((h, i) => (
                <li key={i}>
                  <Link
                    href={`/meetings/${h.meetingId}${h.at !== undefined ? `?t=${h.at}` : ""}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 font-medium">{KIND[h.kind]}</span>
                      <span className="truncate">{h.meetingTitle}</span>
                      {h.at !== undefined && <span className="ml-auto tabular-nums">{mmss(h.at)}</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm">{h.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs">
            <Link href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="font-medium text-primary hover:underline">See all results</Link>
            <Link href={`/ask?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Sparkles className="size-3" />Ask AI instead</Link>
          </div>
        </div>
      )}
    </div>
  );
}
