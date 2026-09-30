export const apiError = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

export const aiStatus = (code: string) =>
  code === "no_key" ? 503 : code === "auth" ? 502 : code === "rate_limit" ? 429 : code === "empty" ? 422 : 502;

export type Ctx<P extends Record<string, string>> = { params: Promise<P> };
