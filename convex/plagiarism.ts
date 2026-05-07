"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callOpenRouter, safeJsonParse } from "./openrouter";

// Plagiarism Self-Check. NOT a real plagiarism checker — we cannot query
// Turnitin's database. This flags 6-12 word phrases that LOOK plagiarised
// (templated phrasing, likely-verbatim runs, common cliches, uncited
// claims) so the student can manually verify with a Google search and
// either rewrite or properly cite before submission.

const SYSTEM_PROMPT = `You are a writing tutor helping a student self-check their draft for phrasing that would likely be flagged by a Turnitin-style similarity check.

You CANNOT query a plagiarism database. You are spotting phrases that LOOK plagiarised — templated boilerplate, likely-verbatim runs from textbook-style sources, fixed phrases lifted from a brief, common cliches and uncited factual claims that read as copy-pasted.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "summary": "string — 2-3 sentences. Be honest: this is a self-check, not a real plagiarism checker. State what it can and can't do.",
  "phrases": [
    {
      "phrase": "string — an EXACT 6-12 word run copied verbatim from the draft (no paraphrasing, no ellipsis, no edits)",
      "risk": "low" | "medium" | "high",
      "reason": "string — 1-2 sentences on why this would flag (e.g. reads as textbook boilerplate, fixed wording from the assignment brief, distinctive enough that natural authorship is unlikely, uncited factual claim)",
      "category": "templated" | "verbatim-likely" | "common-cliche" | "uncited-claim" | "other"
    }
  ],
  "overallRisk": "low" | "medium" | "high",
  "advice": ["string — concrete action items the student should take (rewrite in own words, add a citation, paraphrase and cite, etc.)"]
}

How to choose phrases:
- Each phrase MUST be 6-12 words, copied verbatim from the draft.
- Prefer phrases distinctive enough that a Google search in quotes would plausibly find a hit.
- Skip ordinary connective prose ("on the other hand", "as a result of") unless it's part of a longer templated stretch.
- Flag uncited factual claims that read as lifted (statistics, definitions, quotes without attribution).
- Aim for 5-15 phrases on a typical draft. If the draft genuinely looks clean, return fewer (or none) and say so.

Hard rules:
- Use NZ English (organise, behaviour, analyse, colour) in your prose.
- Do NOT use the Oxford comma.
- Be honest about limits — this is NOT a real plagiarism checker. Say so in the summary.
- Never invent phrases the student didn't write. Every phrase must be a verbatim run from the draft.`;

export const selfCheck = action({
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
        "Please paste at least 200 characters of draft — short snippets aren't enough to spot risky phrasing."
      );
    }
    if (trimmed.length > 50000) {
      throw new Error("Text too long — trim to 50000 characters or fewer.");
    }
    const raw = await callOpenRouter({
      model: args.model ?? "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: 3500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
    });
    return safeJsonParse(raw);
  },
});
