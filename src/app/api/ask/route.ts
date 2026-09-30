import { askAcrossMeetings } from "@/lib/ai/ask-graph";
import { toAIError } from "@/lib/ai/core/errors";
import { aiStatus, apiError } from "@/lib/api";
import { getSearchIndex } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 500) return apiError(400, "bad_request", "Ask a question between 3 and 500 characters.");
  try {
    return Response.json(await askAcrossMeetings(await getSearchIndex(), question));
  } catch (e) {
    const err = toAIError(e);
    return apiError(aiStatus(err.code), err.code, err.message);
  }
}
