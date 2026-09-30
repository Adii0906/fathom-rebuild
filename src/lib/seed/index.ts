import type { CalendarEvent, Meeting } from "../types";
import { buildMeeting } from "./build";
import { acme } from "./acme";
import { engSync, brightwave, northstar } from "./others-a";
import { roadmap, interview, helix, leadership } from "./others-b";

const drafts = [acme, engSync, brightwave, northstar, roadmap, interview, helix, leadership];

export function seedMeetings(now: Date = new Date()): Meeting[] {
  return drafts.map((d) => buildMeeting(d, now));
}

/** Upcoming (not yet recorded) events, so the calendar always has a future. */
export function seedUpcoming(now: Date = new Date()): CalendarEvent[] {
  const at = (days: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setUTCHours(h, m, 0, 0);
    return new Date(d.getTime() + days * 86400_000).toISOString();
  };
  return [
    { id: "up-1", title: "Guided Setup Pilot Kickoff (Acme UK)", startsAt: at(1, 10), durationSec: 2700, attendees: ["Marcus Bell", "Jonas Weber", "Aditya Sharma"], platform: "Zoom" },
    { id: "up-2", title: "Weekly Engineering Sync", startsAt: at(1, 9, 30), durationSec: 1800, attendees: ["Aditya Sharma", "Nina Petrov", "Leo Tan", "Sara Mehta"], platform: "Google Meet" },
    { id: "up-3", title: "Northstar Bank: Pilot Scoping", startsAt: at(3, 15), durationSec: 3600, attendees: ["Dana Whitfield", "Elena Rossi", "Sofia Alvarez"], platform: "Microsoft Teams" },
    { id: "up-4", title: "Weekly Leadership Sync", startsAt: at(2, 8, 30), durationSec: 1800, attendees: ["Priya Raman", "Aditya Sharma", "Marcus Bell", "Dana Whitfield"], platform: "Google Meet" },
    { id: "up-5", title: "Acme: EU Residency Architecture", startsAt: at(6, 14), durationSec: 3600, attendees: ["Sofia Alvarez", "Grace Liu", "Helen Carter"], platform: "Zoom" },
    { id: "up-6", title: "Interview: Backend Engineer", startsAt: at(5, 13), durationSec: 2700, attendees: ["Aditya Sharma", "Nina Petrov"], platform: "Google Meet" },
  ];
}

/** Recorded meetings appear on the calendar too. */
export function eventsFor(meetings: Meeting[], now: Date = new Date()): CalendarEvent[] {
  const past: CalendarEvent[] = meetings.map((m, i) => ({
    id: `ev-${m.id}`,
    title: m.title,
    startsAt: m.startsAt,
    durationSec: m.durationSec,
    attendees: m.participants.map((p) => p.name),
    meetingId: m.id,
    platform: (["Zoom", "Google Meet", "Microsoft Teams"] as const)[i % 3],
  }));
  return [...past, ...seedUpcoming(now)].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
