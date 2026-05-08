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
  },
  "correctedDraft": "string — the WHOLE draft with ONLY mechanical fixes applied: NZ spellings, te reo macrons, removed Oxford commas, missing apostrophes, italics removed from te reo. Do NOT rewrite for grammar or style — leave grammar/style/structure issues UNCHANGED so the student does that thinking themselves. Preserve paragraph breaks. If no mechanical fixes apply, repeat the original draft verbatim."
}

KEY GOTCHAS (you already know NZ English; these are the high-payoff ones):

Spelling: -ise (organise, analyse, recognise) NOT -ize. -our (colour, behaviour) NOT -or. -re (centre, fibre) NOT -er. judgement, grey, ageing, programme (TV/event), tyre, kerb, manoeuvre, defence/offence/licence (n.), fulfil/instil (single-l), travelled/counsellor (double-l).

Te reo Māori (HIGH severity always — be thorough, don't stop at 1 or 2):
- Flag EVERY missing macron in the draft. Common words and their correct forms:
  Māori (NOT Maori), whānau (NOT whanau), hapū (NOT hapu), iwi,
  mātauranga (NOT matauranga), kōrero (NOT korero), tikanga,
  hauora, Pākehā (NOT Pakeha), Aotearoa, tāne (NOT tane),
  wāhine (NOT wahine), kāhui (NOT kahui), Te Whare Tapa Whā (NOT Wha),
  kōhanga (NOT kohanga), pōwhiri (NOT powhiri),
  kaumātua (NOT kaumatua), whaikōrero, tūrangawaewae (NOT turangawaewae),
  hinengaro, wairua, tamariki, rangatahi, mōteatea, whānui, ngā, tēnā,
  Māoritanga, ahi kā, tūpuna (NOT tupuna), atua, taonga
- Plural rule: te reo nouns DON'T take English -s. Flag every instance:
  "Māoris" → "Māori", "iwis" → "iwi", "hapūs" → "hapū",
  "marae's" → "marae", "whānaus" → "whānau"
- Italicisation: do NOT italicise te reo in NZ academic writing — flag if italicised

Punctuation: NO Oxford comma. NZ date format (7 May 2026, not May 7 2026). Apostrophes for possession (today's, people's). Comma before non-restrictive "which".

Grammar: affect (v) vs effect (n), less (uncountable) vs fewer (countable), that (restrictive) vs which (non-restrictive), comma splices, subject-verb agreement.

Style: don't flag personal preferences. DO flag stacked transitions (Furthermore + Moreover + Additionally), AI clichés. Specific cliché phrases to ALWAYS flag when present:
  "in today's rapidly evolving landscape", "rapidly evolving"
  "It is important to note", "It should be noted"
  "delve into", "delves into"
  "tapestry of", "rich tapestry"
  "navigate the complexities", "navigating the complexities"
  "multifaceted", "nuanced"
  "underscore", "underscores the importance"
  "in conclusion" (as conclusion opener — it's a tell, not a connector)
Plus: passive when active is clearer, "really"/"very" intensifiers in academic prose.

Structure: thesis must be arguable + specific (not "In this essay I will discuss"). Body paragraphs need topic sentences + 1-2 citations + analysis (not just description). Conclusion synthesises (no new evidence, no formulaic "Further research is needed").

OUTPUT RULES:
- "where" MUST be exact verbatim quote
- Use NZ English in your own prose; NO Oxford commas in your output
- BE THOROUGH on spelling and te reo Māori — find EVERY US spelling and EVERY missing macron in the draft. These are mechanical and the cap doesn't apply: catch them all.
- For grammar/style/structure, cap at 40 issues (prioritise high-severity).
- Be honest about weak structure. Don't pad praise.

CORRECTEDDRAFT RULES:
- Apply ALL mechanical fixes you found in your issues list to the draft text:
    spelling (US → NZ): every "organize" → "organise", "color" → "colour", etc
    te reo macrons: every "Maori" → "Māori", "whanau" → "whānau", etc
    te reo plurals: every "Maoris" → "Māori"
    Oxford commas removed
    italicised te reo: italics stripped (output the bare word)
    missing apostrophes (today's, people's)
- Do NOT change anything else. Leave grammar errors (affect/effect, less/fewer), weak topic sentences, missing thesis statements, AI clichés, passive voice etc UNTOUCHED. The student needs to fix those themselves.
- Preserve original paragraph breaks (use \\n\\n between paragraphs).
- If the draft has zero mechanical issues, output it verbatim.`;

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

    // V4 Pro is the default for the NZ Editor specifically. The
    // schema (array of 30 issue objects, each with 5 fields including
    // verbatim quotes) is complex enough that Flash's smaller model
    // routinely hangs or returns empty content via OpenRouter's
    // JSON-mode enforcement. Pro handles it reliably in 30-60s. The
    // fallback path stays for resilience: if Pro hiccups, retry once.
    const primaryModel = args.model ?? "deepseek/deepseek-v4-pro";
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
        maxTokens: 9000,
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
      // they were already on Flash (already the fallback target if Pro
      // failed; second-tier fallback to Flash makes sense as a last
      // resort even though it's less reliable).
      if (!isEmptyResponse) {
        throw err;
      }
      const fallbackModel =
        primaryModel === "deepseek/deepseek-v4-pro"
          ? "deepseek/deepseek-v4-flash"
          : "deepseek/deepseek-v4-pro";
      const r = await callOpenRouterDetailed({
        model: fallbackModel,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 9000,
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
