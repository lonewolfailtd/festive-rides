"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callOpenRouter, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an academic study coach for Open Polytechnic of New Zealand students working on assignments referenced in APA 7.

Analyse what the assignment is asking and produce a structured plan that helps the student understand the brief, plan their structure, and know what kind of sources to seek.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "summary": "string — 2-3 sentence plain-English summary of what the assignment is asking",
  "keyQuestion": "string — the actual question/task being asked, in one sentence",
  "taskVerbs": [{ "verb": "string", "meaning": "string — what this verb requires the student to actually do" }],
  "rubricBreakdown": [{ "criterion": "string", "weightPercent": number, "focus": "string — what the marker is looking for" }],
  "wordCountSplit": [{ "section": "string", "words": number, "purpose": "string" }],
  "outline": [{ "section": "string", "bullets": ["string"] }],
  "sourceTypesNeeded": ["string — e.g. 'peer-reviewed journal articles in [field]', 'NZ government reports', 'Stats NZ data', 'Mātauranga Māori sources'"],
  "researchKeywords": ["string — 5-10 search terms the student can use to find sources"],
  "warnings": ["string — anything ambiguous, missing or that the student should clarify with their tutor"]
}

Hard rules:
- Use NZ English spelling (organise, behaviour, analyse, colour, recognise, programme).
- Do NOT use the Oxford comma in lists ("X, Y and Z" not "X, Y, and Z").
- If no rubric is provided, infer typical Open Polytech weighting from the brief.
- If no word count is provided, estimate a reasonable target and note it in "warnings".
- Use academic tone; address the student in second person ("you").
- Be specific to the brief — generic advice is useless.`;

const buildPrompt = (
  brief: string,
  rubric: string | undefined,
  wordCountTarget: number | undefined
): string => {
  const parts: string[] = [];
  parts.push(`ASSIGNMENT BRIEF:\n${brief.trim()}`);
  if (rubric && rubric.trim()) {
    parts.push(`MARKING RUBRIC:\n${rubric.trim()}`);
  }
  if (wordCountTarget) {
    parts.push(`WORD COUNT TARGET: ${wordCountTarget} words`);
  }
  return parts.join("\n\n");
};

export const analyse = action({
  args: {
    brief: v.string(),
    rubric: v.optional(v.string()),
    wordCountTarget: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.brief.trim();
    if (trimmed.length < 30) {
      throw new Error("Please paste the full assignment brief (at least 30 characters).");
    }
    if (trimmed.length > 12000) {
      throw new Error("Brief is very long — please trim to under 12000 characters.");
    }

    const raw = await callOpenRouter({
      model: args.model,
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(trimmed, args.rubric, args.wordCountTarget) },
      ],
    });

    return safeJsonParse(raw);
  },
});
