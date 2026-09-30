import type { TemplateId } from "./types";

export interface TemplateDef {
  id: TemplateId;
  label: string;
  description: string;
  /** How the summary should read for this meeting type. */
  summaryStyle: string;
  /** What decisions / actions / highlights should prioritise. */
  focus: string;
  /** Extra sections the template adds on top of the shared ones. */
  sections: { key: string; title: string; instruction: string }[];
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  general: {
    id: "general",
    label: "General",
    description: "Balanced recap for any meeting",
    summaryStyle:
      "A neutral 3-5 sentence recap: purpose, main topics, outcomes and what happens next.",
    focus: "Capture the main topics, agreed outcomes, and clear follow-ups.",
    sections: [
      {
        key: "topics",
        title: "Topics discussed",
        instruction: "One item per distinct topic, with what was said about it.",
      },
    ],
  },
  sales: {
    id: "sales",
    label: "Sales Call",
    description: "Deal-focused: signals, objections, next steps",
    summaryStyle:
      "A deal-oriented recap: who the prospect is, their pain, budget/timeline signals, objections and agreed next step.",
    focus:
      "Prioritise buying signals, objections, pricing and budget, competitors, stakeholders and commitments on both sides.",
    sections: [
      { key: "signals", title: "Buying signals", instruction: "Moments showing intent, urgency, budget or authority." },
      { key: "objections", title: "Objections & concerns", instruction: "Concerns the prospect raised, and how (or whether) they were resolved." },
      { key: "competitors", title: "Competitors & alternatives", instruction: "Any competitor, incumbent tool or alternative mentioned. Empty if none." },
      { key: "nextsteps", title: "Mutual next steps", instruction: "Concrete steps agreed for the deal, with dates when stated." },
    ],
  },
  product: {
    id: "product",
    label: "Product Meeting",
    description: "Roadmap, priorities and tradeoffs",
    summaryStyle:
      "A product-review recap: what problem was discussed, what was prioritised or deferred, and why.",
    focus:
      "Prioritise user problems, scope and prioritisation decisions, tradeoffs, dependencies and open product questions.",
    sections: [
      { key: "problems", title: "User problems", instruction: "Problems or needs users/customers have, as stated." },
      { key: "requests", title: "Feature requests", instruction: "Specific capabilities requested, with who asked." },
      { key: "tradeoffs", title: "Prioritisation & tradeoffs", instruction: "What was prioritised, deferred or cut, and the reason given." },
    ],
  },
  engineering: {
    id: "engineering",
    label: "Engineering Sync",
    description: "Technical decisions, blockers, incidents",
    summaryStyle:
      "A terse engineering recap: status by area, blockers, technical decisions and what ships next.",
    focus:
      "Prioritise technical decisions, blockers, incidents, risks to delivery dates, and owner-assigned follow-ups.",
    sections: [
      { key: "technical", title: "Technical decisions", instruction: "Design or architecture choices made, with rationale." },
      { key: "blockers", title: "Blockers", instruction: "Anything preventing progress and what it is waiting on." },
      { key: "incidents", title: "Incidents & tech debt", instruction: "Incidents, regressions or tech debt discussed. Empty if none." },
    ],
  },
  discovery: {
    id: "discovery",
    label: "Customer Discovery",
    description: "Pains, workarounds and verbatim quotes",
    summaryStyle:
      "A research-style recap: who the customer is, their workflow, the pains they described and the strongest signals.",
    focus:
      "Prioritise customer pains, current workarounds, jobs to be done, and exact customer language. Do not pitch or infer needs the customer did not state.",
    sections: [
      { key: "pains", title: "Customer pains", instruction: "Pains in the customer's own terms." },
      { key: "workarounds", title: "Current workarounds", instruction: "How they cope today (tools, spreadsheets, manual steps)." },
      { key: "quotes", title: "Verbatim quotes", instruction: "Short exact quotes from the customer, copied word for word from the transcript." },
    ],
  },
  interview: {
    id: "interview",
    label: "Interview",
    description: "Evidence-based candidate assessment",
    summaryStyle:
      "An interview debrief: candidate background, depth shown, and an evidence-based overall impression.",
    focus:
      "Prioritise concrete evidence of skills, communication, ownership and gaps. Action items are follow-ups for the hiring team, not the candidate.",
    sections: [
      { key: "strengths", title: "Strengths", instruction: "Strengths backed by a specific example from the transcript." },
      { key: "concerns", title: "Concerns", instruction: "Gaps or unanswered questions, backed by the transcript." },
      { key: "evidence", title: "Notable answers", instruction: "The most informative answers, summarised." },
    ],
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && v in TEMPLATES;
}
