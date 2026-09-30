import { apiError, type Ctx } from "@/lib/api";
import { addUserHighlight, getMeeting } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { segmentId?: unknown; title?: unknown; note?: unknown } | null;
  const meeting = await getMeeting(id);
  if (!meeting) return apiError(404, "not_found", "Meeting not found.");
  const seg = typeof b?.segmentId === "number" ? meeting.segments[b.segmentId] : undefined;
  const title = typeof b?.title === "string" ? b.title.trim() : "";
  const note = typeof b?.note === "string" ? b.note.trim() : "";
  if (!seg) return apiError(400, "bad_request", "Pick a transcript moment to highlight.");
  if (!title || title.length > 80) return apiError(400, "bad_request", "Give the highlight a title (max 80 characters).");
  if (note.length > 500) return apiError(400, "bad_request", "Notes are limited to 500 characters.");
  // The timestamp comes from the transcript segment, never from the client.
  return Response.json({ highlight: await addUserHighlight(id, { segmentId: seg.id, at: seg.start, title, note }) }, { status: 201 });
}
