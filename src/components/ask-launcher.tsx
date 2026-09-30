"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const EXAMPLE_QUESTIONS = [
  "What did customers say about onboarding?",
  "Which meetings mentioned SSO?",
  "What action items are assigned to Aditya?",
];

export function AskLauncher() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (question: string) => router.push(`/ask?q=${encodeURIComponent(question)}&go=1`);
  return (
    <div className="rounded-xl border bg-gradient-to-br from-accent/70 to-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Ask across all your meetings</div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) go(q.trim()); }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask a question"
          placeholder="e.g. What did customers say about onboarding?"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={q.trim().length < 3} className="h-10">Ask <ArrowRight /></Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((x) => (
          <button key={x} type="button" onClick={() => go(x)} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{x}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Answers only use what was said, and every claim links to the meeting and timestamp.</p>
    </div>
  );
}
