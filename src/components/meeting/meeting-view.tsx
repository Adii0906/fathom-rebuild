"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clock, ExternalLink, Link2, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { AnalyzeError, streamAnalysis } from "@/lib/client/analyze";
import { formatDuration } from "@/lib/format";
import { TEMPLATES } from "@/lib/templates";
import type { Meeting, MeetingState, TemplateId, UserHighlight } from "@/lib/types";
import { AvatarStack } from "./avatar";
import { Insights, type GenState } from "./insights";
import { PlayerCard } from "./player-card";
import { Transcript, type Mark } from "./transcript";
import { usePlayer } from "./use-player";

interface Props {
  meeting: Meeting;
  state: MeetingState;
  readOnly?: boolean;
  /** deep link (?t=) in seconds */
  initialTime?: number;
  /** deep link (?template=) */
  initialTemplate?: TemplateId;
}

async function api(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data;
}

export function MeetingView({ meeting, state, readOnly = false, initialTime, initialTemplate }: Props) {
  const firstTemplate = useMemo<TemplateId>(() => {
    if (initialTemplate && meeting.analyses[initialTemplate]) return initialTemplate;
    if (meeting.analyses[meeting.defaultTemplate]) return meeting.defaultTemplate;
    return (Object.keys(meeting.analyses)[0] as TemplateId | undefined) ?? meeting.defaultTemplate;
  }, [meeting, initialTemplate]);

  const [analyses, setAnalyses] = useState(meeting.analyses);
  const [template, setTemplate] = useState<TemplateId>(firstTemplate);
  const [gen, setGen] = useState<GenState>({ status: "idle" });
  const [mine, setMine] = useState<UserHighlight[]>(state.userHighlights);
  const [done, setDone] = useState<Record<string, boolean>>(state.completedActions);
  const [composeReq, setComposeReq] = useState<{ segmentId: number; n: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const player = usePlayer({
    duration: meeting.durationSec,
    audioUrl: meeting.audioUrl,
    segments: meeting.segments,
    participants: meeting.participants,
  });
  const { seek, activeIndex } = player;

  // Deep link from search / highlights: jump to the moment (paused) and scroll to it.
  useEffect(() => {
    if (initialTime !== undefined && Number.isFinite(initialTime)) seek(initialTime);
  }, [initialTime, seek]);

  const jump = useCallback((t: number) => seek(t, { play: true }), [seek]);

  const analysis = analyses[template];

  const generate = useCallback(async (t: TemplateId) => {
    setGen({ status: "running", template: t, step: 0 });
    try {
      const a = await streamAnalysis(meeting.id, t, (e) => setGen({ status: "running", template: t, step: e.index }));
      setAnalyses((prev) => ({ ...prev, [t]: a }));
      setGen({ status: "idle" });
    } catch (e) {
      setGen({ status: "error", template: t, message: e instanceof Error ? e.message : "Analysis failed.", code: e instanceof AnalyzeError ? e.code : undefined });
    }
  }, [meeting.id]);

  const changeTemplate = useCallback((t: TemplateId) => {
    setTemplate(t);
    setGen({ status: "idle" });
    if (!analyses[t] && !readOnly) void generate(t);
  }, [analyses, readOnly, generate]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const createHighlight = useCallback(async (segmentId: number, title: string, note: string) => {
    const data = await api(`/api/meetings/${meeting.id}/highlights`, { method: "POST", json: { segmentId, title, note } });
    setMine((m) => [...m, data.highlight as UserHighlight]);
  }, [meeting.id]);

  const editHighlight = useCallback(async (id: string, patch: { title: string; note: string }) => {
    await api(`/api/meetings/${meeting.id}/highlights/${id}`, { method: "PATCH", json: patch });
    setMine((m) => m.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, [meeting.id]);

  const deleteHighlight = useCallback(async (id: string) => {
    const prev = mine;
    setMine((m) => m.filter((h) => h.id !== id));
    try {
      await api(`/api/meetings/${meeting.id}/highlights/${id}`, { method: "DELETE" });
    } catch (e) {
      setMine(prev);
      flash(e instanceof Error ? e.message : "Couldn't delete the highlight.");
    }
  }, [meeting.id, mine, flash]);

  const toggleAction = useCallback(async (id: string, value: boolean) => {
    setDone((d) => ({ ...d, [id]: value }));
    try {
      await api(`/api/meetings/${meeting.id}/actions/${id}`, { method: "PATCH", json: { done: value } });
    } catch (e) {
      setDone((d) => ({ ...d, [id]: !value }));
      flash(e instanceof Error ? e.message : "Couldn't update the action item.");
    }
  }, [meeting.id, flash]);

  const highlightNow = useCallback(() => setComposeReq((r) => ({ segmentId: activeIndex, n: (r?.n ?? 0) + 1 })), [activeIndex]);

  const marks = useMemo(() => {
    const m = new Map<number, Mark[]>();
    const add = (id: number, mark: Mark) => m.set(id, [...(m.get(id) ?? []), mark]);
    for (const h of mine) add(h.segmentId, { kind: "you", label: h.title });
    if (analysis) {
      for (const h of analysis.highlights) add(h.segmentId, { kind: "ai", label: h.title });
      for (const d of analysis.decisions) add(d.segmentId, { kind: "decision", label: d.text });
      for (const x of analysis.actionItems) add(x.segmentId, { kind: "action", label: x.text });
    }
    return m;
  }, [mine, analysis]);

  const markers = useMemo(
    () => [...mine.map((h) => ({ at: h.at, title: h.title })), ...(analysis?.highlights ?? []).map((h) => ({ at: h.at, title: h.title }))],
    [mine, analysis],
  );

  const copyLink = async () => {
    const url = `${window.location.origin}/meetings/share/${meeting.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        {!readOnly && (
          <Link href="/meetings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> All meetings
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold leading-tight sm:text-[28px]">{meeting.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /><LocalTime iso={meeting.startsAt} /> · {formatDuration(meeting.durationSec)}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{meeting.participants.length} participants</span>
              <AvatarStack participants={meeting.participants} max={6} size="md" />
              {meeting.source === "import" && <Badge variant="sky">Imported</Badge>}
              {meeting.tags.filter((t) => t !== "Imported").map((t) => <Badge key={t} variant="muted">{t}</Badge>)}
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={copyLink} aria-live="polite">
                {copied ? <Check className="text-primary" /> : <Link2 />} {copied ? "Link copied" : "Copy share link"}
              </Button>
              <Button variant="ghost" size="icon" asChild title="Open public share page" aria-label="Open public share page">
                <Link href={`/meetings/share/${meeting.id}`} target="_blank"><ExternalLink /></Link>
              </Button>
            </div>
          )}
        </div>
        {meeting.status === "failed" && !analysis && gen.status !== "running" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-destructive" />
            <span className="flex-1">{meeting.error ?? "Analysis failed for this meeting."} The transcript is still available.</span>
            {!readOnly && <Button size="sm" variant="outline" onClick={() => generate(template)}><RefreshCw /> Retry {TEMPLATES[template].label} analysis</Button>}
          </div>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 lg:col-start-1">
          <PlayerCard meeting={meeting} player={player} markers={markers} readOnly={readOnly} onHighlightNow={highlightNow} />
        </div>
        <Insights
          className="scroll-thin lg:sticky lg:top-4 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
          meeting={meeting}
          analyses={analyses}
          template={template}
          onTemplateChange={changeTemplate}
          gen={gen}
          onGenerate={() => generate(template)}
          userHighlights={mine}
          done={done}
          onToggleAction={toggleAction}
          onSeek={jump}
          readOnly={readOnly}
          onEditHighlight={editHighlight}
          onDeleteHighlight={deleteHighlight}
          onHighlightNow={highlightNow}
        />
        <Transcript
          className="lg:col-span-7 lg:col-start-1"
          segments={meeting.segments}
          participants={meeting.participants}
          activeIndex={activeIndex}
          onSeek={jump}
          marks={marks}
          readOnly={readOnly}
          onCreateHighlight={createHighlight}
          composeRequest={composeReq}
        />
      </div>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg animate-fade-in">{toast}</div>
      )}
    </div>
  );
}
