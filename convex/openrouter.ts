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

export async function callOpenRouter(args: CallOpenRouterArgs): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set on this Convex deployment. Run: npx convex env set OPENROUTER_API_KEY <key>"
    );
  }

  const body: Record<string, unknown> = {
    // Default model: DeepSeek V3.1 (via OpenRouter alias). Cheap, strong on
    // structured-output academic tasks, NZ English-friendly when prompted.
    model: args.model ?? "deepseek/deepseek-chat",
    messages: args.messages,
    temperature: args.temperature ?? 0.3,
    max_tokens: args.maxTokens ?? 2000,
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
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content");
  }
  return content;
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
