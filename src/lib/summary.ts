import type { ActionItem, Analysis, Meeting, MeetingState, Participant, TemplateId } from "./types";

/** The analysis used for counts and previews: the meeting's own template, else whatever exists. */
export function primaryAnalysis(m: Meeting): Analysis | undefined {
  return m.analyses[m.defaultTemplate] ?? Object.values(m.analyses).find(Boolean);
}

export interface MeetingSummary {
  id: string;
  title: string;
  startsAt: string;
  durationSec: number;
  participants: Participant[];
  tags: string[];
  status: Meeting["status"];
  source: Meeting["source"];
  template: TemplateId;
  preview: string;
  counts: { actions: number; openActions: number; highlights: number; decisions: number };
}

/** Slim, serialisable row for lists and the dashboard (no transcript). */
export function summarize(m: Meeting, st: MeetingState): MeetingSummary {
  const a = primaryAnalysis(m);
  const actions = a?.actionItems ?? [];
  const aiHighlights = a?.highlights.length ?? 0;
  return {
    id: m.id,
    title: m.title,
    startsAt: m.startsAt,
    durationSec: m.durationSec,
    participants: m.participants,
    tags: m.tags,
    status: m.status,
    source: m.source,
    template: a?.template ?? m.defaultTemplate,
    preview: a?.summary ?? (m.status === "failed" ? m.error ?? "Analysis failed." : "Analysing…"),
    counts: {
      actions: actions.length,
      openActions: actions.filter((x) => !st.completedActions[x.id]).length,
      highlights: aiHighlights + st.userHighlights.length,
      decisions: a?.decisions.length ?? 0,
    },
  };
}

export interface OpenAction extends ActionItem {
  meetingId: string;
  meetingTitle: string;
}

export function openActionsOf(items: { meeting: Meeting; state: MeetingState }[]): OpenAction[] {
  return items
    .flatMap(({ meeting, state }) =>
      (primaryAnalysis(meeting)?.actionItems ?? [])
        .filter((a) => !state.completedActions[a.id])
        .map((a) => ({ ...a, meetingId: meeting.id, meetingTitle: meeting.title })),
    );
}

export function totalsOf(rows: MeetingSummary[]) {
  return rows.reduce(
    (t, r) => ({
      meetings: t.meetings + 1,
      actions: t.actions + r.counts.actions,
      openActions: t.openActions + r.counts.openActions,
      highlights: t.highlights + r.counts.highlights,
      decisions: t.decisions + r.counts.decisions,
      seconds: t.seconds + r.durationSec,
    }),
    { meetings: 0, actions: 0, openActions: 0, highlights: 0, decisions: 0, seconds: 0 },
  );
}
