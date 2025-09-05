import OpenAI from "openai";

let openai: OpenAI | null = null;

// Only initialize OpenAI if API key is provided
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
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
    "You are a smart home device analytics assistant for Tuya Smart Life devices.",
    "You have access to real-time device data including power consumption, status, and user specifications.",
    "Answer questions using ONLY the JSON context data provided by the server.",
    "Provide specific details like device names, power readings, online/offline status, and energy consumption.",
    "Format electrical measurements clearly (Watts, Amps, Volts, kWh).",
    "If a device is offline or has no data, mention that specifically.",
    "Give practical insights and recommendations when appropriate.",
    "Use bullet points and clear formatting for easy reading."
  ].join(" ");
}

export async function askLLM({ question, context }: { question: string; context: any }): Promise<string> {
  if (!openai) {
    throw new Error("OpenAI not configured. Please set OPENAI_API_KEY environment variable.");
  }

  console.log("[AI] Processing question:", question);
  console.log("[AI] Using model:", MODEL, "with max tokens:", MAX_TOKENS);

  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: sysPrompt() },
      {
        role: "user",
        content:
          "Question:\n" + question +
          "\n\nContext JSON (compact):\n" + JSON.stringify(context).slice(0, 120_000),
      },
    ],
    max_completion_tokens: MAX_TOKENS,
  });

  let answer = resp.choices?.[0]?.message?.content?.trim() ?? "";
  console.log("[AI] Response length:", answer.length, "chars");
  
  if (!answer) {
    console.warn("[AI] Empty content from model, using fallback.");
    answer = "I could not generate a response. Please try again.";
  }
  return answer;
}