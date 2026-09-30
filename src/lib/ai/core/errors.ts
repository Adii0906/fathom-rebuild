export type AIErrorCode = "no_key" | "auth" | "rate_limit" | "bad_output" | "upstream" | "empty";

export class AIError extends Error {
  code: AIErrorCode;
  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.name = "AIError";
    this.code = code;
  }
}

/** Turn whatever the Groq/LangChain stack throws into an error we can show to a user. */
export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  const err = e as { status?: number; message?: string; error?: { message?: string } };
  const msg = err?.error?.message ?? err?.message ?? String(e);
  if (err?.status === 401 || /invalid api key|unauthorized/i.test(msg))
    return new AIError("auth", "Groq rejected the API key. Check GROQ_API_KEY in .env.local.");
  if (err?.status === 429 || /rate limit|too many requests/i.test(msg))
    return new AIError("rate_limit", "Groq rate limit reached. Wait a few seconds and retry, or set GROQ_MODEL to a model with a higher limit.");
  return new AIError("upstream", `The AI service failed: ${msg.slice(0, 200)}`);
}

/** Seconds Groq asks us to wait ("Please try again in 7.5s"), if present. */
export function retryAfterSeconds(e: unknown): number | undefined {
  const msg = (e as { message?: string })?.message ?? "";
  const m = msg.match(/try again in ([\d.]+)\s*(ms|s)/i);
  if (!m) return undefined;
  return m[2].toLowerCase() === "ms" ? parseFloat(m[1]) / 1000 : parseFloat(m[1]);
}
