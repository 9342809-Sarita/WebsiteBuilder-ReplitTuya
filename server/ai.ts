import OpenAI from "openai";

let openai: OpenAI | null = null;

// Only initialize OpenAI if API key is provided
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const MAX_TOKENS = Number(process.env.MAX_TOKENS || "512");

/**
 * Helper to clamp/summarize arrays so prompts stay small.
 * Keeps at most N points uniformly sampled.
 */
export function samplePoints(points: any[] = [], N = 200): any[] {
  if (!Array.isArray(points) || points.length <= N) return points;
  const step = points.length / N;
  const out = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[Math.floor(i)]);
  }
  return out;
}

function sysPrompt(): string {
  return [
    "You are a power/energy analytics assistant for smart plugs.",
    "Answer ONLY from the JSON context provided by the server.",
    "If the context is insufficient, say what else you need (deviceIds, dates, granularity).",
    "Prefer concrete numbers, date ranges, and short bullet points.",
  ].join(" ");
}

export async function askLLM({ question, context }: { question: string; context: any }): Promise<string> {
  if (!openai) {
    throw new Error("OpenAI not configured. Please set OPENAI_API_KEY environment variable.");
  }
  
  // Use Chat Completions for widest compatibility; Responses API also OK.
  const resp = await openai.chat.completions.create({
    model: MODEL,
    // Keep costs low by avoiding long prompts; we pass compact JSON below.
    messages: [
      { role: "system", content: sysPrompt() },
      {
        role: "user",
        content:
          "Question:\n" + question +
          "\n\nContext JSON (compact):\n" + JSON.stringify(context).slice(0, 120_000)
      }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.2
  });
  return resp.choices?.[0]?.message?.content || "";
}