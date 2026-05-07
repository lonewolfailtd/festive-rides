"use node";

// Shared OpenRouter helper. Other action files import callOpenRouter to make
// chat completions without juggling keys, headers or response parsing.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

export interface CallOpenRouterArgs {
  model?: string;
  messages: OpenRouterMessage[];
  responseFormatJson?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CallOpenRouterResult {
  content: string;
  modelUsed: string;
  usage: OpenRouterUsage;
}

// Backwards-compatible: callOpenRouter still returns the content string only,
// for the few places that don't need usage tracking. callOpenRouterDetailed
// returns the full result including usage so callers can record it for
// rate limiting and spend cap enforcement.
export async function callOpenRouter(args: CallOpenRouterArgs): Promise<string> {
  const r = await callOpenRouterDetailed(args);
  return r.content;
}

export async function callOpenRouterDetailed(
  args: CallOpenRouterArgs,
): Promise<CallOpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set on this Convex deployment. Run: npx convex env set OPENROUTER_API_KEY <key>"
    );
  }

  const model = args.model ?? "deepseek/deepseek-v4-flash";
  const body: Record<string, unknown> = {
    model,
    messages: args.messages,
    temperature: args.temperature ?? 0.3,
    max_tokens: args.maxTokens ?? 2000,
    // Ask OpenRouter to include usage in the response (it's there by default
    // on most providers, but we make it explicit).
    usage: { include: true },
  };
  if (args.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://festiverides.online/uni",
      "X-Title": "Uni Citation Tool",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content");
  }

  return {
    content,
    modelUsed: model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export function safeJsonParse<T = unknown>(raw: string): T {
  // Some models occasionally wrap JSON in markdown fences. Strip them.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Could not parse model output as JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
