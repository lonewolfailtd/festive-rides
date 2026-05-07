"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

// Calibrated AI-text detection. The prompt asks the model to evaluate whether
// the draft was likely written by a human or by a large language model
// (ChatGPT, Claude, Gemini, etc.) using a mix of explicit AI tells and
// statistical-style heuristics. Returns paragraph-level breakdown so the
// student can rewrite specific passages.

const SYSTEM_PROMPT = `You are an expert AI-text detector evaluating a student's draft to predict what tools like Turnitin, GPTZero, Copyleaks or Originality.ai would flag.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "overallScore": number (0-100, % likely written by an LLM),
  "verdict": "Mostly human" | "Mixed" | "Likely AI" | "Heavily AI",
  "summary": "string — 2-3 sentence honest assessment, including caveats about detector reliability",
  "paragraphs": [
    {
      "preview": "string — first 80-120 characters of the paragraph",
      "score": number (0-100),
      "reason": "string — what made you score it this way (1 sentence)"
    }
  ],
  "tells": ["string — specific phrases or patterns in this draft that read as AI"],
  "humanTells": ["string — specific phrases or patterns that read as authentically human (errors, voice, idiosyncrasies)"],
  "naturalisationTips": ["string — concrete edits the student can make to sound more human, where applicable"],
  "calibration": "string — short note on what this score might map to in real detectors (Turnitin/GPTZero), with caveats"
}

Heuristics to weigh:
- Sentence length variance (humans vary; LLMs are more uniform)
- Repetitive transitions ("Furthermore", "Moreover", "Additionally", "In conclusion" overused)
- Generic hedging filler ("It is important to note", "navigating the complexities of", "in today's rapidly evolving landscape")
- Vocabulary tells: "multifaceted", "nuanced", "comprehensive", "delve", "tapestry", "underscore"
- Symmetric structure: tidy 3-point patterns; preview-elaborate-summarise rhythm; perfect topic sentences
- Lack of personal voice, lived examples, hedged opinions
- Em-dashes in LLM-typical positions
- Lexical density consistent across paragraphs (humans drift; LLMs don't)

Calibration:
- 0-30 = "Mostly human" — voice, variance, errors all present
- 30-50 = "Mixed" — some sections feel polished/AI-like, others feel human
- 50-70 = "Likely AI" — most sections read as AI, some human edits
- 70-100 = "Heavily AI" — nearly all of the draft reads as raw LLM output

Hard rules:
- Use NZ English (organise, behaviour, analyse, colour) in your prose.
- Do NOT use the Oxford comma.
- Be honest about detector limits — real tools have 5-15% false-positive rates. Always include this caveat in the calibration note.
- Score paragraphs independently; don't average to fit a vibe.`;

export const check = action({
  args: {
    text: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.text.trim();
    if (trimmed.length < 200) {
      throw new Error(
        "Please paste at least 200 characters — short snippets aren't enough to detect AI patterns reliably."
      );
    }
    if (trimmed.length > 50000) {
      throw new Error("Text too long — trim to 50000 characters or fewer.");
    }
    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      // Use DeepSeek V4 Pro for detection — 1.6T MoE, strong on voice/style
      // analysis, ~1/7 the price of Claude Sonnet 4.6 for comparable quality.
      model: args.model ?? "deepseek/deepseek-v4-pro",
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: 3500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
    });
    const parsed = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "aiChecker.check",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return parsed;
  },
});

const HUMANISE_PROMPT = `You are an academic writing coach helping a student rewrite a passage to sound more human and less like AI-generated text — without changing the meaning, evidence or argument.

Hard rules:
- Preserve every fact, claim and citation exactly. Don't add new sources or remove existing ones.
- Vary sentence length — mix short, medium, long.
- Replace generic AI fillers ("It is important to note", "navigating the complexities of", "multifaceted") with direct phrasing.
- Cut transition stacks (Furthermore / Moreover / Additionally lined up).
- Use one or two specific examples, observations or qualifications that read as a real student's voice.
- Allow minor honest hedging ("seems to suggest", "I think this matters because").
- Use NZ English (organise, behaviour, analyse, colour).
- Do NOT use the Oxford comma.

Output ONLY JSON:
{
  "rewrite": "the full rewritten passage",
  "changes": ["short bullet list of 3-6 things you changed"]
}`;

export const humanise = action({
  args: {
    text: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.text.trim();
    if (trimmed.length < 50) {
      throw new Error("Paste at least 50 characters to rewrite.");
    }
    if (trimmed.length > 8000) {
      throw new Error("Passage is too long — trim to 8000 characters or fewer.");
    }
    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model: args.model ?? "deepseek/deepseek-v4-pro",
      responseFormatJson: true,
      temperature: 0.6,
      maxTokens: 2500,
      messages: [
        { role: "system", content: HUMANISE_PROMPT },
        { role: "user", content: trimmed },
      ],
    });
    const parsed = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "aiChecker.humanise",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return parsed;
  },
});
