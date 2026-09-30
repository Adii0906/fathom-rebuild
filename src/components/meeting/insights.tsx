"use client";
import { memo, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, CircleHelp, Gavel, Lightbulb, Loader2, Pencil, RefreshCw,
  Sparkles, Star, Target, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, mmss } from "@/lib/format";
import { STEPS } from "@/lib/steps";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { Analysis, Meeting, TemplateId, UserHighlight } from "@/lib/types";
import { Avatar } from "./avatar";

export type GenState =
  | { status: "idle" }
  | { status: "running"; template: TemplateId; step: number }
  | { status: "error"; template: TemplateId; message: string; code?: string };

export function TimeChip({ at, onSeek }: { at: number; onSeek: (t: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(at)}
      className="inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`Jump to ${mmss(at)}`}
    >
      ▶ {mmss(at)}
    </button>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Lightbulb; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className="size-4 text-primary" /> {title}
        {count !== undefined && <span className="font-normal text-muted-foreground">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{children}</p>;

/* ── template picker + generation states ─────────────────────────── */

function TemplatePicker({ template, analyses, onChange, disabled, readOnly }: {
  template: TemplateId; analyses: Meeting["analyses"]; onChange: (t: TemplateId) => void; disabled: boolean; readOnly: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">AI template</span>
        <span className="text-[11px] text-muted-foreground">{TEMPLATES[template].description}</span>
      </div>
      <div role="radiogroup" aria-label="AI template" className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TEMPLATE_IDS.map((id) => {
          const has = Boolean(analyses[id]);
          const blocked = disabled || (readOnly && !has);
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === template}
              disabled={blocked}
              onClick={() => onChange(id)}
              title={readOnly && !has ? "Not generated for this meeting" : has ? "Generated" : "Generates with Groq on first use"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                id === template ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {TEMPLATES[id].label}
              {has && id !== template && <span className="size-1.5 rounded-full bg-primary/70" aria-label="generated" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ step, template }: { step: number; template: TemplateId }) {
  return (
    <Card className="space-y-3 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" /> Generating {TEMPLATES[template].label} analysis
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.id} className={cn("flex items-center gap-2 text-sm", done ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground")}>
              {done ? <CheckCircle2 className="size-4 text-primary" /> : current ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border" />}
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">LangGraph workflow running on Groq. Every item is checked against the transcript before it&apos;s shown.</p>
    </Card>
  );
}

function GenError({ message, code, onRetry }: { message: string; code?: string; onRetry: () => void }) {
  return (
    <Card className="space-y-2 border-destructive/30 bg-destructive/5 p-4" role="alert">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="size-4" /> Couldn&apos;t generate this analysis</div>
      <p className="text-sm text-foreground/80">{message}</p>
      {code === "no_key" && <p className="text-xs text-muted-foreground">Create <code className="rounded bg-muted px-1">.env.local</code> with <code className="rounded bg-muted px-1">GROQ_API_KEY=…</code> and restart <code className="rounded bg-muted px-1">npm run dev</code>.</p>}
      <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw /> Try again</Button>
    </Card>
  );
}

/* ── tabs ────────────────────────────────────────────────────────── */

function SummaryTab({ a, onSeek }: { a: Analysis; onSeek: (t: number) => void }) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-[15px] leading-relaxed">{a.summary}</p>
        <div className="flex flex-wrap gap-1.5">{a.topics.map((t) => <Badge key={t} variant="muted">{t}</Badge>)}</div>
      </section>

      <Section icon={Lightbulb} title="Key points" count={a.keyPoints.length}>
        {a.keyPoints.length === 0 ? <Empty>No key points were found.</Empty> : (
          <ul className="space-y-2">
            {a.keyPoints.map((k, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="flex-1">{k.text} </span><TimeChip at={k.at} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Gavel} title="Decisions" count={a.decisions.length}>
        {a.decisions.length === 0 ? <Empty>No decisions were made in this meeting.</Empty> : (
          <ul className="space-y-2">
            {a.decisions.map((d) => (
              <li key={d.id} className="rounded-lg border bg-violet-50/50 p-3 text-sm leading-relaxed">
                <div>{d.text}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  {d.owner && <Badge variant="violet">Owner: {d.owner}</Badge>}
                  <TimeChip at={d.at} onSeek={onSeek} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {a.sections.map((s) => (
        <Section key={s.key} icon={Target} title={s.title} count={s.items.length}>
          {s.items.length === 0 ? <Empty>Nothing in the transcript for this.</Empty> : (
            <ul className="space-y-2">
              {s.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span className="flex-1">{s.key === "quotes" ? <q className="italic">{it.text}</q> : it.text} </span>
                  <TimeChip at={it.at} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      <Section icon={CircleHelp} title="Questions" count={a.questions.length}>
        {a.questions.length === 0 ? <Empty>No open questions.</Empty> : (
          <ul className="space-y-2">
            {a.questions.map((q) => (
              <li key={q.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <Badge variant={q.answered ? "default" : "amber"} className="mt-0.5">{q.answered ? "Answered" : "Open"}</Badge>
                <span className="flex-1">{q.text}{q.askedBy && <span className="text-muted-foreground"> — {q.askedBy}</span>} </span>
                <TimeChip at={q.at} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={AlertTriangle} title="Risks" count={a.risks.length}>
        {a.risks.length === 0 ? <Empty>No risks were raised.</Empty> : (
          <ul className="space-y-2">
            {a.risks.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm leading-relaxed">
                <Badge variant={r.severity === "high" ? "rose" : r.severity === "medium" ? "amber" : "muted"} className="mt-0.5 capitalize">{r.severity}</Badge>
                <span className="flex-1">{r.text} </span><TimeChip at={r.at} onSeek={onSeek} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ActionsTab({ a, done, onToggle, onSeek, readOnly, participants }: {
  a: Analysis; done: Record<string, boolean>; onToggle: (id: string, v: boolean) => void; onSeek: (t: number) => void; readOnly: boolean; participants: Meeting["participants"];
}) {
  const [owner, setOwner] = useState<string>("all");
  const owners = useMemo(() => [...new Set(a.actionItems.map((x) => x.owner))], [a.actionItems]);
  const shown = a.actionItems.filter((x) => owner === "all" || x.owner === owner);
  const completed = a.actionItems.filter((x) => done[x.id]).length;
  const pct = a.actionItems.length ? (completed / a.actionItems.length) * 100 : 0;

  if (a.actionItems.length === 0) return <Empty>No action items were assigned in this meeting.</Empty>;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{completed}</span> of {a.actionItems.length} complete</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by owner">
        {["all", ...owners].map((o) => (
          <button key={o} type="button" onClick={() => setOwner(o)} aria-pressed={owner === o}
            className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", owner === o ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>
            {o === "all" ? `Everyone · ${a.actionItems.length}` : `${o} · ${a.actionItems.filter((x) => x.owner === o).length}`}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {shown.map((x) => {
          const idx = participants.findIndex((p) => p.name === x.owner);
          const isDone = Boolean(done[x.id]);
          return (
            <li key={x.id} className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors", isDone && "bg-muted/50")}>
              <Checkbox
                checked={isDone} disabled={readOnly} className="mt-0.5"
                onCheckedChange={(v) => onToggle(x.id, v === true)}
                aria-label={`Mark "${x.text}" ${isDone ? "incomplete" : "complete"}`}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className={cn("text-sm leading-relaxed", isDone && "text-muted-foreground line-through")}>{x.text}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {idx >= 0 ? <Avatar name={x.owner} index={idx} size="sm" className="ring-0" /> : null}{x.owner}
                  </span>
                  {x.due && <Badge variant="outline"><CalendarClock className="size-3" />{x.due}</Badge>}
                  <TimeChip at={x.at} onSeek={onSeek} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HighlightRow({ h, onSeek, onEdit, onDelete, readOnly }: {
  h: UserHighlight; onSeek: (t: number) => void; readOnly: boolean;
  onEdit: (id: string, patch: { title: string; note: string }) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(h.title);
  const [note, setNote] = useState(h.note);
  const [busy, setBusy] = useState(false);
  if (editing)
    return (
      <li className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <Textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" disabled={busy || !title.trim()} onClick={async () => { setBusy(true); try { await onEdit(h.id, { title: title.trim(), note: note.trim() }); setEditing(false); } finally { setBusy(false); } }}>Save</Button>
        </div>
      </li>
    );
  return (
    <li className="group rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-start gap-2">
        <Star className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{h.title}</span><Badge variant="amber">Yours</Badge><TimeChip at={h.at} onSeek={onSeek} /></div>
          {h.note && <p className="mt-1 text-sm text-foreground/80">{h.note}</p>}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-0.5">
            <button type="button" onClick={() => setEditing(true)} className="rounded p-1.5 text-muted-foreground hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Edit highlight"><Pencil className="size-3.5" /></button>
            <button type="button" onClick={() => onDelete(h.id)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Delete highlight"><Trash2 className="size-3.5" /></button>
          </div>
        )}
      </div>
    </li>
  );
}

function HighlightsTab({ a, mine, onSeek, readOnly, onEdit, onDelete, onHighlightNow }: {
  a: Analysis | undefined; mine: UserHighlight[]; onSeek: (t: number) => void; readOnly: boolean;
  onEdit: (id: string, patch: { title: string; note: string }) => Promise<void>; onDelete: (id: string) => Promise<void>; onHighlightNow: () => void;
}) {
  const sorted = [...mine].sort((x, y) => x.at - y.at);
  return (
    <div className="space-y-6">
      <Section icon={Star} title="Your highlights" count={sorted.length}>
        {sorted.length === 0 ? (
          <Empty>{readOnly ? "No highlights were saved on this meeting." : "Star any transcript line, or use “Highlight moment” while playing, to save it here with a note."}</Empty>
        ) : (
          <ul className="space-y-2">{sorted.map((h) => <HighlightRow key={h.id} h={h} onSeek={onSeek} onEdit={onEdit} onDelete={onDelete} readOnly={readOnly} />)}</ul>
        )}
        {!readOnly && <Button size="sm" variant="outline" onClick={onHighlightNow}><Star className="text-amber-500" /> Highlight current moment</Button>}
      </Section>
      <Section icon={Sparkles} title="AI highlights" count={a?.highlights.length ?? 0}>
        {!a || a.highlights.length === 0 ? <Empty>No AI highlights for this template yet.</Empty> : (
          <ul className="space-y-2">
            {a.highlights.map((h) => (
              <li key={h.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{h.title}</span><Badge>AI</Badge><TimeChip at={h.at} onSeek={onSeek} /></div>
                {h.note && <p className="mt-1 text-sm text-foreground/80">{h.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function PeopleTab({ meeting, onSeek }: { meeting: Meeting; onSeek: (t: number) => void }) {
  const stats = useMemo(() => {
    const talk = new Map<string, number>();
    const first = new Map<string, number>();
    for (const s of meeting.segments) {
      talk.set(s.speakerId, (talk.get(s.speakerId) ?? 0) + (s.end - s.start));
      if (!first.has(s.speakerId)) first.set(s.speakerId, s.start);
    }
    const total = [...talk.values()].reduce((a, b) => a + b, 0) || 1;
    return { talk, first, total };
  }, [meeting.segments]);
  return (
    <ul className="space-y-3">
      {meeting.participants.map((p, i) => {
        const share = ((stats.talk.get(p.id) ?? 0) / stats.total) * 100;
        return (
          <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Avatar name={p.name} index={i} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <span className="text-xs tabular-nums text-muted-foreground">{Math.round(share)}% talk time</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{p.role}{p.org ? ` · ${p.org}` : ""}</div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} /></div>
            </div>
            {stats.first.has(p.id) && <TimeChip at={stats.first.get(p.id)!} onSeek={onSeek} />}
          </li>
        );
      })}
    </ul>
  );
}

/* ── panel ───────────────────────────────────────────────────────── */

interface Props {
  meeting: Meeting;
  analyses: Meeting["analyses"];
  template: TemplateId;
  onTemplateChange: (t: TemplateId) => void;
  gen: GenState;
  onGenerate: () => void;
  userHighlights: UserHighlight[];
  done: Record<string, boolean>;
  onToggleAction: (id: string, v: boolean) => void;
  onSeek: (t: number) => void;
  readOnly: boolean;
  onEditHighlight: (id: string, patch: { title: string; note: string }) => Promise<void>;
  onDeleteHighlight: (id: string) => Promise<void>;
  onHighlightNow: () => void;
  className?: string;
}

function InsightsImpl(p: Props) {
  const a = p.analyses[p.template];
  const running = p.gen.status === "running" && p.gen.template === p.template;
  const failed = p.gen.status === "error" && p.gen.template === p.template ? p.gen : null;
  const openActions = a ? a.actionItems.filter((x) => !p.done[x.id]).length : 0;
  const highlightCount = (a?.highlights.length ?? 0) + p.userHighlights.length;

  return (
    <Card className={cn("p-4 sm:p-5", p.className)}>
      <TemplatePicker template={p.template} analyses={p.analyses} onChange={p.onTemplateChange} disabled={p.gen.status === "running"} readOnly={p.readOnly} />

      <Tabs defaultValue="summary" className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="actions">Actions{a && openActions > 0 ? <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{openActions}</span> : null}</TabsTrigger>
          <TabsTrigger value="highlights">Highlights{highlightCount > 0 ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">{highlightCount}</span> : null}</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          {running && p.gen.status === "running" && <Progress step={p.gen.step} template={p.template} />}
          {failed && <GenError message={failed.message} code={failed.code} onRetry={p.onGenerate} />}
          {!running && !failed && !a && (
            <Card className="space-y-2 border-dashed p-4 text-center">
              <Sparkles className="mx-auto size-5 text-primary" />
              <p className="text-sm font-medium">No {TEMPLATES[p.template].label} analysis yet</p>
              <p className="text-xs text-muted-foreground">{p.meeting.status === "failed" && p.meeting.error ? p.meeting.error : "Generate it from the transcript with Groq."}</p>
              {!p.readOnly && <Button size="sm" onClick={p.onGenerate}><Sparkles /> Generate analysis</Button>}
            </Card>
          )}
          {a && !running && (
            <div className="space-y-4">
              <SummaryTab a={a} onSeek={p.onSeek} />
              <p className="flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
                <Check className="size-3" /> {a.model === "seed" ? "Sample analysis" : `Generated by ${a.model}`} · {formatDate(a.generatedAt, "datetime")} UTC · citations checked against transcript
                {!p.readOnly && a.model !== "seed" && <button type="button" onClick={p.onGenerate} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"><RefreshCw className="size-3" />Regenerate</button>}
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="actions">
          {a ? <ActionsTab a={a} done={p.done} onToggle={p.onToggleAction} onSeek={p.onSeek} readOnly={p.readOnly} participants={p.meeting.participants} /> : <Empty>Generate an analysis to see action items.</Empty>}
        </TabsContent>
        <TabsContent value="highlights">
          <HighlightsTab a={a} mine={p.userHighlights} onSeek={p.onSeek} readOnly={p.readOnly} onEdit={p.onEditHighlight} onDelete={p.onDeleteHighlight} onHighlightNow={p.onHighlightNow} />
        </TabsContent>
        <TabsContent value="people"><PeopleTab meeting={p.meeting} onSeek={p.onSeek} /></TabsContent>
      </Tabs>
    </Card>
  );
}

export const Insights = memo(InsightsImpl);
