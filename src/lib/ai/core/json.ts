import { AIError, retryAfterSeconds, toAIError } from "./errors";

/** One LLM round-trip: system + user prompt in, raw text out. The graph supplies the ChatGroq-backed one. */
export type Complete = (system: string, user: string) => Promise<string>;

export function extractJSON(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(t.slice(start, end + 1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Call the model, parse + validate JSON, retry once with the validation error, and ride out short 429s. */
export async function callJSON<T>(
  complete: Complete,
  system: string,
  user: string,
  validate: (raw: unknown) => T,
  opts: { retries?: number; maxWaitMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  const maxWait = opts.maxWaitMs ?? 20_000;
  let prompt = user;
  let lastErr = "";
  for (let attempt = 0, rl = 0; attempt <= retries; ) {
    let text: string;
    try {
      text = await complete(system, prompt);
    } catch (e) {
      const wait = retryAfterSeconds(e);
      if (wait !== undefined && wait * 1000 <= maxWait && rl < 2) {
        rl++;
        await sleep(wait * 1000 + 250);
        continue; // rate-limit waits don't consume a validation retry
      }
      throw toAIError(e);
    }
    try {
      return validate(extractJSON(text));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      prompt = `${user}\n\nYour previous reply was rejected: ${lastErr}. Reply with ONLY one valid JSON object that follows the schema exactly.`;
      attempt++;
    }
  }
  throw new AIError("bad_output", `The model did not return valid output (${lastErr}).`);
}
