import { runAnalysis } from "@/lib/ai/analysis-graph";
import { toAIError } from "@/lib/ai/core/errors";
import { apiError, type Ctx } from "@/lib/api";
import { getMeeting, saveAnalysis, updateImport } from "@/lib/store";
import { isTemplateId } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs the LangGraph workflow and streams one SSE event per finished node. */
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { template?: unknown } | null;
  if (!body || !isTemplateId(body.template)) return apiError(400, "bad_request", "Unknown template.");
  const template = body.template;
  const meeting = await getMeeting(id);
  if (!meeting) return apiError(404, "not_found", "Meeting not found.");

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (o: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        } catch {
          open = false; // client went away; keep analysing so the result is still saved
        }
      };
      try {
        const analysis = await runAnalysis(
          { title: meeting.title, template, participants: meeting.participants, segments: meeting.segments },
          (e) => send({ type: "step", ...e }),
        );
        await saveAnalysis(id, analysis);
        if (meeting.source === "import" && meeting.status !== "ready")
          await updateImport(id, { status: "ready", error: undefined, defaultTemplate: template });
        send({ type: "done", analysis });
      } catch (e) {
        const err = toAIError(e);
        if (meeting.source === "import" && meeting.status !== "ready")
          await updateImport(id, { status: "failed", error: err.message }).catch(() => undefined);
        send({ type: "error", code: err.code, message: err.message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
