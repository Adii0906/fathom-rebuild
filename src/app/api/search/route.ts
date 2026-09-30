import { search } from "@/lib/retrieval";
import { getSearchIndex } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 30) || 30));
  if (q.length < 2) return Response.json({ hits: [] });
  return Response.json({ hits: search(await getSearchIndex(), q, limit) });
}
