import { apiError } from "@/lib/api";
import { createImport, newImportId } from "@/lib/store";
import { isTemplateId } from "@/lib/templates";
import { parseTranscript } from "@/lib/transcript-parse";
import type { Meeting } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Capture layer (stubbed by design): instead of a Zoom/Meet/Teams bot, meetings enter as a pasted or
 * uploaded transcript. This creates the meeting in "processing"; the client then streams the LangGraph
 * analysis from /api/meetings/[id]/analyze, which flips the meeting to "ready".
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof b?.title === "string" ? b.title.trim() : "";
  const transcript = typeof b?.transcript === "string" ? b.transcript : "";
  if (!title || title.length > 120) return apiError(400, "bad_request", "Give the meeting a title (max 120 characters).");
  if (!isTemplateId(b?.template)) return apiError(400, "bad_request", "Choose a template.");
  if (transcript.length > 400_000) return apiError(413, "too_large", "Transcript is too large (max 400 KB).");

  let parsed;
  try {
    parsed = parseTranscript(transcript);
  } catch (e) {
    return apiError(400, "bad_transcript", e instanceof Error ? e.message : "Couldn't read that transcript.");
  }
  if (parsed.segments.length < 3) return apiError(400, "bad_transcript", "A transcript needs at least 3 lines of speech.");

  const when = typeof b?.startsAt === "string" && !Number.isNaN(Date.parse(b.startsAt)) ? new Date(b.startsAt) : new Date();
  const audioUrl = typeof b?.audioUrl === "string" && /^https?:\/\//i.test(b.audioUrl.trim()) ? b.audioUrl.trim() : undefined;

  const meeting: Meeting = {
    id: newImportId(title),
    title,
    startsAt: when.toISOString(),
    durationSec: parsed.durationSec,
    participants: parsed.participants,
    segments: parsed.segments,
    source: "import",
    status: "processing",
    defaultTemplate: b.template,
    analyses: {},
    audioUrl,
    tags: ["Imported"],
  };
  await createImport(meeting);
  return Response.json({ id: meeting.id, segments: parsed.segments.length, participants: parsed.participants.length }, { status: 201 });
}
