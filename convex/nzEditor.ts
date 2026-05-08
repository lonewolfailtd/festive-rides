"use node";

// NZ Editor: Grammarly-style proofreader tuned to NZ English + Open
// Polytech academic conventions + Mātauranga Māori macron checking +
// essay-structure analysis. Single action — paste your draft, get back
// a categorised issue list plus structural improvement notes.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an experienced NZ academic editor marking Open Polytechnic undergraduate essays in APA 7. Catch real errors, explain briefly, output JSON only.

OUTPUT (JSON, no markdown):
{
  "summary": "2-3 sentence honest overall",
  "totalIssues": number,
  "byCategory": { "spelling": n, "grammar": n, "punctuation": n, "tereo": n, "style": n, "structure": n },
  "issues": [{
    "category": "spelling"|"grammar"|"punctuation"|"tereo"|"style"|"structure",
    "severity": "high"|"medium"|"low",
    "where": "5-15 word VERBATIM quote from draft",
    "problem": "what's wrong, 1 sentence",
    "suggestion": "the fix with corrected text in 'quotes'",
    "rule": "1-sentence rule"
  }],
  "structureNotes": {
    "introduction": "2-3 sentences on hook/context/thesis",
    "bodyParagraphs": "PEEL adherence, citations, topic sentences",
    "conclusion": "synthesises vs summarises?",
    "flow": "signposting, variety, transitions",
    "topImprovements": ["3-5 bullet points of biggest fixes"]
  }
}

KEY GOTCHAS (you already know NZ English; these are the high-payoff ones):

Spelling: -ise (organise, analyse, recognise) NOT -ize. -our (colour, behaviour) NOT -or. -re (centre, fibre) NOT -er. judgement, grey, ageing, programme (TV/event), tyre, kerb, manoeuvre, defence/offence/licence (n.), fulfil/instil (single-l), travelled/counsellor (double-l).

Te reo Māori (HIGH severity always):
- Flag missing macrons: Māori, whānau, hapū, mātauranga, kōrero, tikanga, hauora, Pākehā, Aotearoa, tāne, wāhine, kāhui, Te Whare Tapa Whā, kōhanga, pōwhiri, kaumātua, whaikōrero, tūrangawaewae, hinengaro, wairua, tamariki, rangatahi
- Plural rule: te reo nouns DON'T take English -s. Flag "Māoris", "iwis", "hapūs", "marae's"
- Italicisation: do NOT italicise te reo in NZ academic writing — flag if italicised

Punctuation: NO Oxford comma. NZ date format (7 May 2026, not May 7 2026). Apostrophes for possession (today's, people's). Comma before non-restrictive "which".

Grammar: affect (v) vs effect (n), less (uncountable) vs fewer (countable), that (restrictive) vs which (non-restrictive), comma splices, subject-verb agreement.

Style: don't flag personal preferences. DO flag stacked transitions (Furthermore + Moreover + Additionally), AI clichés ("It is important to note", "in today's rapidly evolving landscape", "delve into", "tapestry"), passive when active is clearer, "really"/"very" intensifiers.

Structure: thesis must be arguable + specific (not "In this essay I will discuss"). Body paragraphs need topic sentences + 1-2 citations + analysis (not just description). Conclusion synthesises (no new evidence, no formulaic "Further research is needed").

OUTPUT RULES:
- "where" MUST be exact verbatim quote
- Use NZ English in your own prose; NO Oxford commas in your output
- Cap issues at 30 (prioritise high-severity). If you'd produce more, say so in summary.
- Be honest about weak structure. Don't pad praise.`;

export const edit = action({
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
        "Paste at least 200 characters of draft so the editor has enough to work with.",
      );
    }
    if (trimmed.length > 30000) {
      throw new Error(
        "Draft is very long — trim to under 30,000 characters or split into sections.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Same fallback pattern as the AI Checker: try Flash first (fast),
    // fall back to Pro if Flash returns empty content (provider hiccup,
    // content filter, transient timeout). Empty-content failures on
    // OpenRouter for V4 Flash are rare but happen — Pro is more
    // reliable and only ~2x slower, so it's a fine safety net.
    const primaryModel = args.model ?? "deepseek/deepseek-v4-flash";
    let raw: string;
    let modelUsed: string;
    let usage: { inputTokens: number; outputTokens: number };
    try {
      const r = await callOpenRouterDetailed({
        model: primaryModel,
        responseFormatJson: true,
        temperature: 0.2,
        // 6000 tokens fits ~30 capped issues + structureNotes comfortably.
        // Bigger budgets made the model produce excess output and slowed
        // wall-clock time to several minutes.
        maxTokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      });
      raw = r.content;
      modelUsed = r.modelUsed;
      usage = r.usage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isEmptyResponse =
        msg.includes("empty response") ||
        msg.includes("no content") ||
        msg.includes("timed out");
      // Don't retry rate-limit / quota / auth errors. Don't retry if
      // they were already on Pro.
      if (!isEmptyResponse || primaryModel === "deepseek/deepseek-v4-pro") {
        throw err;
      }
      const r = await callOpenRouterDetailed({
        model: "deepseek/deepseek-v4-pro",
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      });
      raw = r.content;
      modelUsed = r.modelUsed;
      usage = r.usage;
    }

    let result: unknown;
    try {
      result = safeJsonParse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("Unterminated") ||
        msg.includes("Unexpected end") ||
        msg.includes("position")
      ) {
        throw new Error(
          "Your draft was so long that the editor's response got cut off. Try a shorter section (one chapter or 2-3 body paragraphs at a time).",
        );
      }
      throw err;
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "nzEditor.edit",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  },
});
