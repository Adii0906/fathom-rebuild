export type TemplateId =
  | "general"
  | "sales"
  | "product"
  | "engineering"
  | "discovery"
  | "interview";

export interface Participant {
  id: string;
  name: string;
  role: string;
  org?: string;
}

export interface Segment {
  id: number;
  speakerId: string;
  /** seconds from start of recording */
  start: number;
  end: number;
  text: string;
}

/** Every AI-derived item points at a transcript segment so it can be verified and deep-linked. */
export interface Ref {
  segmentId: number;
  /** seconds; resolved from the segment, never trusted from the model */
  at: number;
}

export interface KeyPoint extends Ref {
  text: string;
}
export interface Decision extends Ref {
  id: string;
  text: string;
  owner?: string;
}
export interface ActionItem extends Ref {
  id: string;
  text: string;
  owner: string;
  due?: string;
}
export interface Highlight extends Ref {
  id: string;
  title: string;
  note: string;
}
export interface Question extends Ref {
  id: string;
  text: string;
  askedBy?: string;
  answered: boolean;
}
export interface Risk extends Ref {
  id: string;
  text: string;
  severity: "low" | "medium" | "high";
}
export interface TemplateSection {
  key: string;
  title: string;
  items: KeyPoint[];
}

export interface Analysis {
  template: TemplateId;
  generatedAt: string;
  /** "seed" for hand-authored data, otherwise the Groq model id */
  model: string;
  summary: string;
  topics: string[];
  keyPoints: KeyPoint[];
  decisions: Decision[];
  actionItems: ActionItem[];
  highlights: Highlight[];
  questions: Question[];
  risks: Risk[];
  sections: TemplateSection[];
}

export type MeetingStatus = "ready" | "processing" | "failed";

export interface Meeting {
  id: string;
  title: string;
  startsAt: string; // ISO
  durationSec: number;
  participants: Participant[];
  segments: Segment[];
  source: "seed" | "import";
  status: MeetingStatus;
  error?: string;
  defaultTemplate: TemplateId;
  analyses: Partial<Record<TemplateId, Analysis>>;
  /** Real recording, when one exists. Otherwise the player runs a simulated timeline. */
  audioUrl?: string;
  tags: string[];
}

/** User-created highlight (as opposed to AI highlights inside an Analysis). */
export interface UserHighlight extends Ref {
  id: string;
  title: string;
  note: string;
  createdAt: string;
}

/** Mutable per-meeting state layered over the (immutable) seed meeting. */
export interface MeetingState {
  userHighlights: UserHighlight[];
  completedActions: Record<string, boolean>;
  analyses: Partial<Record<TemplateId, Analysis>>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  durationSec: number;
  attendees: string[];
  /** set when the event has a recorded meeting */
  meetingId?: string;
  platform: "Zoom" | "Google Meet" | "Microsoft Teams";
}

export interface SearchHit {
  kind: "meeting" | "transcript" | "action" | "highlight" | "decision";
  meetingId: string;
  meetingTitle: string;
  at?: number;
  snippet: string;
  score: number;
}
