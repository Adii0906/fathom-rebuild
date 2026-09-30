"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { AnalyzeError, streamAnalysis } from "@/lib/client/analyze";
import { SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "@/lib/sample-transcript";
import { STEPS } from "@/lib/steps";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase =
  | { name: "form" }
  | { name: "uploading" }
  | { name: "analysing"; id: string; step: number; parsed: { segments: number; participants: number } }
  | { name: "done"; id: string }
  | { name: "error"; id?: string; message: string; code?: string; parsed?: { segments: number; participants: number } };

export function ImportFlow({ initialTitle }: { initialTitle: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [template, setTemplate] = useState<TemplateId>("general");
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const file = useRef<HTMLInputElement>(null);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 400_000) return setFormError("That file is larger than 400 KB. Paste a shorter transcript or split it.");
    setTranscript(await f.text());
    setFormError(null);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  };

  const analyse = async (id: string, parsed: { segments: number; participants: number }) => {
    setPhase({ name: "analysing", id, step: 0, parsed });
    try {
      await streamAnalysis(id, template, (e) => setPhase({ name: "analysing", id, step: e.index, parsed }));
      setPhase({ name: "done", id });
      setTimeout(() => router.push(`/meetings/${id}`), 1100);
    } catch (e) {
      setPhase({ name: "error", id, parsed, message: e instanceof Error ? e.message : "Analysis failed.", code: e instanceof AnalyzeError ? e.code : undefined });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("Give the meeting a title.");
    if (transcript.trim().length < 40) return setFormError("Paste a transcript, upload a .txt/.vtt/.srt file, or use the sample.");
    setPhase({ name: "uploading" });
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), template, transcript, audioUrl: audioUrl.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error?.message ?? `Import failed (${res.status}).`);
        return setPhase({ name: "form" });
      }
      await analyse(data.id, { segments: data.segments, participants: data.participants });
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setPhase({ name: "form" });
    }
  };

  /* ── processing view ── */
  if (phase.name !== "form") {
    const parsed = phase.name === "analysing" || phase.name === "error" ? phase.parsed : undefined;
    const step = phase.name === "analysing" ? phase.step : phase.name === "done" ? STEPS.length : 0;
    const failed = phase.name === "error";
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">{phase.name === "done" ? "Meeting created" : failed ? "Import needs attention" : "Processing your meeting"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Import → processing → LangGraph analysis on Groq → meeting created.</p>
        </div>
        <Card className="p-5" role="status" aria-live="polite">
          <ol className="space-y-3">
            <Stage state={phase.name === "uploading" ? "active" : "done"} label="Transcript received" detail={parsed ? `${parsed.segments} segments · ${parsed.participants} speakers` : undefined} />
            {STEPS.map((s, i) => (
              <Stage key={s.id} state={failed && i === step ? "failed" : i < step ? "done" : i === step && phase.name === "analysing" ? "active" : "todo"} label={s.label} />
            ))}
            <Stage state={phase.name === "done" ? "done" : "todo"} label="Meeting created" />
          </ol>
        </Card>

        {failed && (
          <Card className="space-y-3 border-destructive/30 bg-destructive/5 p-4" role="alert">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="size-4" />{phase.message}</div>
            {phase.code === "no_key" && <p className="text-xs text-muted-foreground">Add <code className="rounded bg-muted px-1">GROQ_API_KEY</code> to <code className="rounded bg-muted px-1">.env.local</code> and restart the dev server, then retry.</p>}
            <div className="flex flex-wrap gap-2">
              {phase.id && phase.parsed && <Button size="sm" onClick={() => analyse(phase.id!, phase.parsed!)}><RefreshCw /> Retry analysis</Button>}
              {phase.id && <Button size="sm" variant="outline" asChild><Link href={`/meetings/${phase.id}`}>Open meeting anyway</Link></Button>}
              <Button size="sm" variant="ghost" onClick={() => setPhase({ name: "form" })}>Back to form</Button>
            </div>
          </Card>
        )}
        {phase.name === "done" && <p className="flex items-center gap-2 text-sm text-primary"><Loader2 className="size-4 animate-spin" /> Opening your meeting…</p>}
      </div>
    );
  }

  /* ── form ── */
  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" noValidate>
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">Import meeting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live capture (Zoom/Meet/Teams bots) is stubbed in this build. Bring a transcript and it runs through the same analysis pipeline a real capture would.
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium">Title</label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly product sync" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="template" className="text-sm font-medium">AI template</label>
            <Select id="template" value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)}>
              {TEMPLATE_IDS.map((t) => <option key={t} value={t}>{TEMPLATES[t].label}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground">{TEMPLATES[template].description}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="transcript" className="text-sm font-medium">Transcript</label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => { setTitle(SAMPLE_TITLE); setTranscript(SAMPLE_TRANSCRIPT); setFormError(null); }}><Wand2 /> Use sample</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()}><Upload /> Upload file</Button>
              <input ref={file} type="file" accept=".txt,.vtt,.srt,.md,text/plain" hidden onChange={(e) => readFile(e.target.files?.[0])} />
            </div>
          </div>
          <Textarea
            id="transcript" value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={12}
            placeholder={"[00:00] Maya Chen: Let's get started.\n[00:12] Jordan Blake: Quick status first…"}
            className="font-mono text-[13px] leading-relaxed"
          />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><FileText className="mt-0.5 size-3.5 shrink-0" />Formats: <code>[mm:ss] Name: text</code>, <code>Name (mm:ss): text</code>, WebVTT/SRT, or plain <code>Name: text</code> lines (timing is estimated).</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="audio" className="text-sm font-medium">Recording URL <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input id="audio" type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://…/meeting.mp3" />
          <p className="text-xs text-muted-foreground">If provided, the player uses it. Otherwise playback is simulated from the transcript timeline.</p>
        </div>

        {formError && <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0" />{formError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild><Link href="/">Cancel</Link></Button>
          <Button type="submit">Import &amp; analyse</Button>
        </div>
      </Card>
    </form>
  );
}

function Stage({ state, label, detail }: { state: "todo" | "active" | "done" | "failed"; label: string; detail?: string }) {
  return (
    <li className={cn("flex items-center gap-3 text-sm", state === "todo" && "text-muted-foreground")}>
      {state === "done" ? <CheckCircle2 className="size-5 text-primary" />
        : state === "active" ? <Loader2 className="size-5 animate-spin text-primary" />
        : state === "failed" ? <AlertTriangle className="size-5 text-destructive" />
        : <span className="size-5 rounded-full border-2" />}
      <span className={cn(state === "active" && "font-medium")}>{label}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </li>
  );
}
