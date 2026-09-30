import { apiError, type Ctx } from "@/lib/api";
import { getMeeting, removeUserHighlight, updateUserHighlight } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx<{ id: string; hid: string }>) {
  const { id, hid } = await params;
  if (!(await getMeeting(id))) return apiError(404, "not_found", "Meeting not found.");
  const b = (await req.json().catch(() => null)) as { title?: unknown; note?: unknown } | null;
  const patch: { title?: string; note?: string } = {};
  if (typeof b?.title === "string") {
    const t = b.title.trim();
    if (!t || t.length > 80) return apiError(400, "bad_request", "Title must be 1-80 characters.");
    patch.title = t;
  }
  if (typeof b?.note === "string") {
    if (b.note.length > 500) return apiError(400, "bad_request", "Notes are limited to 500 characters.");
    patch.note = b.note.trim();
  }
  await updateUserHighlight(id, hid, patch);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx<{ id: string; hid: string }>) {
  const { id, hid } = await params;
  if (!(await getMeeting(id))) return apiError(404, "not_found", "Meeting not found.");
  await removeUserHighlight(id, hid);
  return Response.json({ ok: true });
}
