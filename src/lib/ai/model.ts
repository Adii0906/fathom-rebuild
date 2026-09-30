import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AIError } from "./core/errors";
import type { Complete } from "./core/json";

/**
 * Model is configurable: llama-3.3-70b-versatile gives the best extraction quality;
 * on Groq's free tier its tokens-per-minute cap is low, so llama-3.1-8b-instant is a
 * reasonable fallback (`GROQ_MODEL=llama-3.1-8b-instant`).
 */
export const groqModel = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/** Returns a `Complete` backed by ChatGroq. The key is read server-side only. */
export function groqComplete(): Complete {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    throw new AIError("no_key", "GROQ_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.");
  const model = new ChatGroq({
    apiKey,
    model: groqModel(),
    temperature: 0.1, // extraction, not creativity
    maxTokens: 3000,
    maxRetries: 1, // our callJSON handles 429 waits and validation retries
  });
  return async (system, user) => {
    const res = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
    return typeof res.content === "string"
      ? res.content
      : res.content.map((p) => ("text" in p && typeof p.text === "string" ? p.text : "")).join("");
  };
}
