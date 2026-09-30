"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Loader2, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { EXAMPLE_QUESTIONS } from "@/components/ask-launcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mmss } from "@/lib/format";
import type { AskResult } from "@/lib/ai/core/ask-core";

interface Turn {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  result?: AskResult;
  error?: { code?: string; message: string };
}

/** Turn "[S1, S2]" markers into chips that scroll to the matching source card. */
function Answer({ text, turnId, known }: { text: string; turnId: number; known: Set<string> }) {
  const parts = text.split(/(\[S\d+(?:\s*,\s*S\d+)*\])/g);
  return (
    <p className="whitespace-pre-line text-[15px] leading-relaxed">
      {parts.map((p, i) => {
        const m = p.match(/^\[(S\d+(?:\s*,\s*S\d+)*)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        return (
          <span key={i} className="mx-0.5 inline-flex gap-0.5 align-baseline">
            {m[1].split(/\s*,\s*/).filter((s) => known.has(s)).map((s) => (
              <a key={s} href={`#src-${turnId}-${s}`} className="rounded bg-accent px-1 text-[11px] font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground">{s.slice(1)}</a>
            ))}
          </span>
        );
      })}
    </p>
  );
}

export function AskClient({ initialQuestion, autoRun }: { initialQuestion: string; autoRun: boolean }) {
  const [q, setQ] = useState(initialQuestion);
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(1);
  const ran = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  const ask = useCallback(async (question: string) => {
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question, status: "loading" }]);
    setQ("");
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? `Request failed (${res.status})`), { code: data?.error?.code });
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "done", result: data as AskResult } : x)));
    } catch (e) {
      const err = e as Error & { code?: string };
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "error", error: { code: err.code, message: err.message || "Couldn't reach the server." } } : x)));
    }
  }, []);

  useEffect(() => {
    if (autoRun && initialQuestion.length >= 3 && !ran.current) {
      ran.current = true;
      void ask(initialQuestion);
    }
  }, [autoRun, initialQuestion, ask]);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns]);

  const busy = turns.some((t) => t.status === "loading");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 3 && !busy) void ask(q.trim());
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-[28px]"><Sparkles className="size-6 text-primary" /> Ask across meetings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Retrieves the most relevant moments from every meeting, then answers using only those, citing meeting and timestamp.</p>
      </div>

      {turns.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Try asking</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {EXAMPLE_QUESTIONS.map((x) => (
              <button key={x} type="button" onClick={() => ask(x)} className="rounded-xl border bg-card px-3.5 py-2 text-left text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{x}</button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6" aria-live="polite">
        {turns.map((t) => (
          <div key={t.id} className="space-y-3 animate-fade-in">
            <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{t.question}</div></div>

            {t.status === "loading" && (
              <Card className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching your meetings and checking the answer…</div>
                <div className="skeleton h-3 w-11/12" /><div className="skeleton h-3 w-9/12" />
              </Card>
            )}

            {t.status === "error" && t.error && (
              <Card className="space-y-2 border-destructive/30 bg-destructive/5 p-4" role="alert">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="size-4" /> Couldn&apos;t answer that</div>
                <p className="text-sm">{t.error.message}</p>
                {t.error.code === "no_key" && <p className="text-xs text-muted-foreground">Add <code className="rounded bg-muted px-1">GROQ_API_KEY</code> to <code className="rounded bg-muted px-1">.env.local</code> and restart the dev server.</p>}
                <Button size="sm" variant="outline" onClick={() => ask(t.question)}>Try again</Button>
              </Card>
            )}

            {t.status === "done" && t.result && (
              <Card className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  {t.result.grounded
                    ? <Badge><ShieldCheck className="size-3" />Grounded in {t.result.citations.length} source{t.result.citations.length === 1 ? "" : "s"}</Badge>
                    : <Badge variant="muted">Not found in your meetings</Badge>}
                </div>
                <Answer text={t.result.answer} turnId={t.id} known={new Set(t.result.citations.map((c) => c.sid))} />
                {t.result.citations.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Sources</p>
                    <ul className="space-y-2">
                      {t.result.citations.map((c) => (
                        <li key={c.sid} id={`src-${t.id}-${c.sid}`} className="scroll-mt-24">
                          <Link href={`/meetings/${c.meetingId}${c.at !== undefined ? `?t=${c.at}` : ""}`} className="flex gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-accent text-[11px] font-semibold text-accent-foreground">{c.sid.slice(1)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 text-xs"><span className="font-medium">{c.meetingTitle}</span><span className="capitalize text-muted-foreground">{c.kind}</span>{c.at !== undefined && <span className="tabular-nums text-primary">▶ {mmss(c.at)}</span>}</span>
                              <span className="mt-1 flex gap-1.5 text-sm text-foreground/75"><Quote className="mt-0.5 size-3 shrink-0 text-muted-foreground" /><span className="line-clamp-3">{c.snippet}</span></span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="sticky bottom-4 flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-lg">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} aria-label="Your question"
          placeholder="Ask about decisions, customers, action items…"
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        <Button type="submit" size="icon" className="rounded-xl" disabled={q.trim().length < 3 || busy} aria-label="Ask">{busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}</Button>
      </form>
    </div>
  );
}
