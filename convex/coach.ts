"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callOpenRouter, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an academic writing coach for Open Polytechnic of New Zealand students. The student will paste a draft (or part of one) and optionally the assignment brief it relates to.

Give specific, useful feedback — not generic "consider strengthening your argument" advice. Point at concrete sentences, name the issue, suggest what to do. Be direct and constructive.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "overallSummary": "string — 2-3 sentences on the draft's strongest and weakest aspects",
  "scores": {
    "structure": { "score": number 1-5, "feedback": "string" },
    "argument": { "score": number 1-5, "feedback": "string" },
    "evidenceUse": { "score": number 1-5, "feedback": "string" },
    "citationDensity": { "score": number 1-5, "feedback": "string — flag any paragraphs of pure assertion with no source" },
    "tone": { "score": number 1-5, "feedback": "string — academic register, NZ English, no Oxford commas" }
  },
  "missingElements": ["string — things the brief asks for that the draft hasn't covered"],
  "specificImprovements": [
    {
      "where": "string — quote 5-15 words from the draft so the student can find the spot",
      "issue": "string — what's wrong",
      "suggestion": "string — what to change it to or how to think about it"
    }
  ],
  "nzEnglishFlags": ["string — list of US-spelled words found in the draft, with NZ replacement"],
  "oxfordCommaFlags": ["string — list of phrases that contain an Oxford comma, with corrected version"]
}

Hard rules:
- Use NZ English in your feedback (organise, behaviour, analyse, colour, recognise, programme).
- Do NOT use the Oxford comma yourself.
- Score 5 = excellent for an undergraduate Open Polytech assignment, 1 = needs major rework.
- Be specific — quote text from the draft when pointing things out.
- Limit specificImprovements to the 5 highest-impact items.`;

const buildPrompt = (draft: string, brief: string | undefined): string => {
  const parts: string[] = [];
  if (brief && brief.trim()) {
    parts.push(`ASSIGNMENT BRIEF (for context):\n${brief.trim()}`);
  }
  parts.push(`DRAFT TO REVIEW:\n${draft.trim()}`);
  return parts.join("\n\n");
};

export const coach = action({
  args: {
    draft: v.string(),
    brief: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.draft.trim();
    if (trimmed.length < 100) {
      throw new Error("Please paste at least 100 characters of draft.");
    }
    if (trimmed.length > 30000) {
      throw new Error("Draft is very long — please trim to under 30000 characters or split into sections.");
    }

    const raw = await callOpenRouter({
      model: args.model,
      responseFormatJson: true,
      temperature: 0.3,
      maxTokens: 3500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(trimmed, args.brief) },
      ],
    });

    return safeJsonParse(raw);
  },
});
