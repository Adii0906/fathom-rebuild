"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { mmss, splitForHighlight } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Participant, Segment } from "@/lib/types";
import { Avatar, speakerIndex } from "./avatar";

export interface Mark {
  kind: "you" | "ai" | "decision" | "action";
  label: string;
}

interface RowProps {
  seg: Segment;
  name: string;
  who: number;
  active: boolean;
  marks: Mark[] | undefined;
  query: string;
  readOnly: boolean;
  onSeek: (t: number) => void;
  onCompose: (segmentId: number) => void;
}

const MARK_STYLE: Record<Mark["kind"], string> = {
  you: "bg-amber-100 text-amber-900",
  ai: "bg-amber-50 text-amber-800",
  decision: "bg-violet-100 text-violet-900",
  action: "bg-sky-100 text-sky-900",
};

const Row = memo(function Row({ seg, name, who, active, marks, query, readOnly, onSeek, onCompose }: RowProps) {
  const pieces = useMemo(() => splitForHighlight(seg.text, query), [seg.text, query]);
  const starred = marks?.some((m) => m.kind === "you" || m.kind === "ai");
  return (
    <div
      data-seg={seg.id}
      className={cn(
        "group relative flex gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 transition-colors hover:bg-muted/60",
        active && "border-primary bg-accent/70 hover:bg-accent/70",
      )}
    >
      <button
        type="button"
        onClick={() => onSeek(seg.start)}
        className="mt-0.5 h-6 shrink-0 self-start rounded-md px-1.5 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Jump to ${mmss(seg.start)}`}
      >
        {mmss(seg.start)}
      </button>
      <Avatar name={name} index={who} size="sm" className="mt-0.5" />
      <div
        className="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onSeek(seg.start)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSeek(seg.start);
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold">{name}</span>
          {marks?.map((m, i) => (
            <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-1.5 text-[10px] font-medium leading-4", MARK_STYLE[m.kind])} title={m.label}>
              {(m.kind === "you" || m.kind === "ai") && <Star className="size-2.5 fill-current" />}
              {m.kind === "decision" ? "Decision" : m.kind === "action" ? "Action" : m.kind === "you" ? m.label : "Highlight"}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">
          {pieces.map((p, i) => (p.hit ? <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit">{p.t}</mark> : <span key={i}>{p.t}</span>))}
        </p>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onCompose(seg.id)}
          className={cn(
            "mt-0.5 size-7 shrink-0 self-start rounded-md text-muted-foreground transition hover:bg-amber-100 hover:text-amber-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            starred ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
          )}
          aria-label="Highlight this moment"
          title="Highlight this moment"
        >
          <Star className={cn("mx-auto size-4", starred && "fill-amber-400 text-amber-500")} />
        </button>
      )}
    </div>
  );
});

function Composer({ seg, onCancel, onSave }: { seg: Segment; onCancel: () => void; onSave: (title: string, note: string) => Promise<void> }) {
  const [title, setTitle] = useState(() => seg.text.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:!?]+$/, ""));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), []);

  const submit = async () => {
    if (!title.trim()) return setError("Add a title so you can find this later.");
    setBusy(true);
    setError(null);
    try {
      await onSave(title.trim(), note.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the highlight.");
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="mx-3 mb-2 ml-[4.25rem] space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 animate-fade-in">
      <div className="flex items-center justify-between text-xs font-medium text-amber-900">
        <span className="flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-500" /> Highlight at {mmss(seg.start)}</span>
        <button type="button" onClick={onCancel} className="rounded p-0.5 hover:bg-amber-100" aria-label="Cancel"><X className="size-3.5" /></button>
      </div>
      <Input
        autoFocus value={title} maxLength={80} placeholder="Title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        aria-label="Highlight title"
      />
      <Textarea value={note} maxLength={500} rows={2} placeholder="Add a note (optional)" onChange={(e) => setNote(e.target.value)} aria-label="Highlight note" />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save highlight"}</Button>
      </div>
    </div>
  );
}

interface Props {
  segments: Segment[];
  participants: Participant[];
  activeIndex: number;
  onSeek: (t: number) => void;
  marks: Map<number, Mark[]>;
  readOnly: boolean;
  onCreateHighlight: (segmentId: number, title: string, note: string) => Promise<void>;
  /** bump `n` to open the composer for a segment from outside (player button) */
  composeRequest: { segmentId: number; n: number } | null;
  className?: string;
}

function TranscriptImpl({ segments, participants, activeIndex, onSeek, marks, readOnly, onCreateHighlight, composeRequest, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<number | null>(null);
  const q = query.trim();

  const names = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants]);
  const visible = useMemo(() => {
    if (q.length < 2) return segments;
    const words = q.toLowerCase().split(/\s+/);
    return segments.filter((s) => {
      const t = `${names.get(s.speakerId) ?? ""} ${s.text}`.toLowerCase();
      return words.every((w) => t.includes(w));
    });
  }, [segments, q, names]);

  useEffect(() => {
    if (composeRequest) setComposer(composeRequest.segmentId);
  }, [composeRequest]);

  // Keep the spoken line in view (inside the scroll box only, never scrolling the page).
  useEffect(() => {
    if (!follow || q.length >= 2) return;
    const c = box.current;
    const el = c?.querySelector<HTMLElement>(`[data-seg="${segments[activeIndex]?.id}"]`);
    if (!c || !el) return;
    const top = el.offsetTop - c.clientHeight / 3;
    c.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeIndex, follow, q, segments]);

  const handleSeek = useCallback((t: number) => {
    setFollow(true);
    onSeek(t);
  }, [onSeek]);
  const openComposer = useCallback((id: number) => setComposer(id), []);

  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <CardHeader className="items-center">
        <CardTitle>Transcript <span className="ml-1 font-normal text-muted-foreground">· {segments.length} segments</span></CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find in transcript" className="h-8 w-36 pl-8 text-xs sm:w-48" aria-label="Find in transcript" />
          </div>
          <Button
            size="sm" variant={follow ? "secondary" : "outline"}
            onClick={() => setFollow((f) => !f)} aria-pressed={follow}
            title="Keep the current line in view"
          >
            <ArrowDownToLine /> <span className="hidden sm:inline">Follow</span>
          </Button>
        </div>
      </CardHeader>
      <div
        ref={box}
        className="scroll-thin relative max-h-[60vh] min-h-[320px] flex-1 overflow-y-auto px-2 pb-3 lg:max-h-[calc(100vh-26rem)]"
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
      >
        {visible.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No lines match &ldquo;{q}&rdquo;.</p>}
        {visible.map((s) => (
          <div key={s.id}>
            <Row
              seg={s}
              name={names.get(s.speakerId) ?? s.speakerId}
              who={speakerIndex(participants, s.speakerId)}
              active={s.id === activeIndex}
              marks={marks.get(s.id)}
              query={q.length >= 2 ? q : ""}
              readOnly={readOnly}
              onSeek={handleSeek}
              onCompose={openComposer}
            />
            {composer === s.id && !readOnly && (
              <Composer
                seg={s}
                onCancel={() => setComposer(null)}
                onSave={async (title, note) => {
                  await onCreateHighlight(s.id, title, note);
                  setComposer(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export const Transcript = memo(TranscriptImpl);
