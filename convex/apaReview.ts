"use node";

// APA Reference-List Validator — paste a finished reference list, get a
// per-entry APA 7 verdict (ok / minor / major) with the specific errors and
// a corrected version. Validate-only: unlike the Bibliography Importer, it
// does NOT add anything to the student's saved references — it's the
// last-minute "is my reference list actually APA 7?" check.
//
// Driven by real marker feedback ("Most of your citations and references
// were formatted well, with only a few errors") — students lose easy
// presentation marks on small, fixable formatting slips.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an APA 7th edition referencing checker for Open Polytechnic of New Zealand students. The student pastes a finished reference list (one or more entries). Check each entry against APA 7 rules and report problems. You are validating, NOT rewriting their research — only fix formatting.

Output ONLY valid JSON (no markdown):
{
  "overall": {
    "entryCount": number,
    "cleanCount": number,
    "summary": "string — 1-2 sentences. Honest: how close is this list to APA 7?"
  },
  "entries": [
    {
      "raw": "string — the entry as the student wrote it, verbatim (trimmed)",
      "status": "ok" | "minor" | "major",
      "issues": ["string — each specific APA 7 problem. Name the rule, e.g. 'Journal volume number should be italicised', 'Author initials need full stops: J. K.', 'Use & not and before the final author', 'Title should be sentence case, not title case'. Empty array if status is ok."],
      "corrected": "string — the entry rewritten correctly in APA 7. Wrap text that must be ITALIC in *single asterisks* (e.g. *Journal of Psychology*, *24*(3)). If a required element is genuinely missing from the source data (e.g. no DOI given), do NOT invent it — keep it out and note it in issues."
    }
  ]
}

Hard rules:
- APA 7th edition only.
- Sentence case for article and book titles; title case for journal names.
- Italics: journal name + volume number; book + report titles. Mark with *asterisks*.
- Use the ampersand (&) before the final author in the reference list, not 'and'.
- DOIs as https://doi.org/... format.
- NEVER invent missing data (authors, years, DOIs). Flag the gap in issues instead.
- NZ English in your issue descriptions. Do NOT use the Oxford comma yourself.
- 'major' = would lose presentation marks or mislead a reader (wrong author order, missing year, fabricated-looking entry). 'minor' = small slips (a missing full stop, italics, sentence case). 'ok' = compliant.`;

export const review = action({
  args: {
    referenceList: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const text = args.referenceList.trim();
    if (text.length < 20) {
      throw new Error("Paste at least one full reference (20+ characters).");
    }
    if (text.length > 15000) {
      throw new Error("Reference list is very long — check it in two halves.");
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      // Flash tier — APA formatting is a well-bounded, rule-driven task; the
      // same model the Bibliography Importer uses.
      model: args.model ?? "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.1,
      maxTokens: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `=== REFERENCE LIST TO CHECK ===\n${text}\n\nCheck every entry against APA 7. Report issues + a corrected version for each.`,
        },
      ],
    });

    const parsed = safeJsonParse(raw);

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "apaReview.review",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return parsed;
  },
});
