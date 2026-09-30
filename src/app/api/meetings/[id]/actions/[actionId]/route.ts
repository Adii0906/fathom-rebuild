import { apiError, type Ctx } from "@/lib/api";
import { getMeeting, setActionDone } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx<{ id: string; actionId: string }>) {
  const { id, actionId } = await params;
  const b = (await req.json().catch(() => null)) as { done?: unknown } | null;
  if (typeof b?.done !== "boolean") return apiError(400, "bad_request", "Expected { done: boolean }.");
  const meeting = await getMeeting(id);
  if (!meeting) return apiError(404, "not_found", "Meeting not found.");
  const exists = Object.values(meeting.analyses).some((a) => a?.actionItems.some((x) => x.id === actionId));
  if (!exists) return apiError(404, "not_found", "Action item not found.");
  await setActionDone(id, actionId, b.done);
  return Response.json({ ok: true });
}
