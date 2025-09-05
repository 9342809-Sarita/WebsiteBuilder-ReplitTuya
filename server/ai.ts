// server/ai.ts
import OpenAI from "openai";

let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
export const MAX_TOKENS = Number(process.env.MAX_TOKENS || "512");

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "create_alert",
      description: "Create an alert rule for a device",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          deviceName: { type: "string", description: "Human-friendly device name, not ID" },
          metric: { type: "string", enum: ["powerW","voltageV","currentA","pfEst"] },
          op: { type: "string", enum: [">",">=","<","<=","==","!="] },
          threshold: { type: "number" },
          durationS: { type: "integer", minimum: 0 }
        },
        required: ["deviceName","metric","op","threshold","durationS"]
      }
    }
  }
];

// Downsample helper (if you pass graphs/series)
export function samplePoints<T>(points: T[], N = 800): T[] {
  if (!Array.isArray(points) || points.length <= N) return points;
  const step = points.length / N;
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)]);
  return out;
}

function sysPrompt(): string {
  return [
    "You are a smart home device analytics assistant for Tuya Smart Life devices.",
    "Use ONLY the server-provided JSON context for factual device data.",
    "Leverage previous turns from this session to keep continuity.",
    "Be concise; show units (W, A, V, kWh). Note offline/no-data states.",
    "IF the user asks to create/delete an alert rule, call the appropriate tool.",
  ].join(" ");
}

export async function askLLMWithHistory({
  history,
  userContent,
}: {
  history: { role: "user" | "assistant"; content: string }[];
  userContent: string;
}): Promise<string> {
  if (!openai) throw new Error("OpenAI not configured. Set OPENAI_API_KEY.");

  const trimmed = history.slice(-24); // keep last ~12 exchanges

  const messages = [
    { role: "system" as const, content: sysPrompt() },
    ...trimmed,
    { role: "user" as const, content: userContent },
  ];

  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages,
    max_completion_tokens: MAX_TOKENS,
    tools,
    tool_choice: "auto",
  });

  const choice = resp.choices?.[0];
  const msg = choice?.message;
  const answer = (msg?.content ?? "").trim();

  let tool: null | { name: string; args: any } = null;
  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0];
    if (tc.type === "function" && tc.function) {
      tool = { name: tc.function.name || "", args: JSON.parse(tc.function.arguments || "{}") };
    }
  }

  return JSON.stringify({ answer, tool });
}