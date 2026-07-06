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
import { logErrors } from "./errorLog";

const SYSTEM_PROMPT = `You are an experienced NZ academic editor marking Open Polytechnic undergraduate essays in APA 7. Catch real errors, explain briefly, output JSON only.

OUTPUT (JSON, no markdown):
{
  "summary": "2-3 sentence honest overall",
  "totalIssues": number,
  "byCategory": { "spelling": n, "grammar": n, "punctuation": n, "tereo": n, "style": n, "structure": n },
  "issues": [{
    "category": "spelling"|"grammar"|"punctuation"|"tereo"|"style"|"structure",
    "severity": "high"|"medium"|"low",
    "where": "5-15 word VERBATIM quote from draft (must appear exactly, character-for-character)",
    "correctedSpan": "string — the same quote rewritten with the fix applied, character-for-character. ONLY populate for mechanical fixes (spelling, tereo macrons + plurals, Oxford comma removal, missing apostrophes, italicised te reo). For grammar/style/structure issues, leave as null — those need student judgement. The client uses this for find-and-replace, so it MUST be the verbatim corrected version of the where field with same surrounding words.",
    "problem": "what's wrong, 1 sentence",
    "suggestion": "the fix with corrected text in 'quotes' (for human reading)",
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

Punctuation: NO Oxford comma. NZ date format (7 May 2026, not May 7 2026). Apostrophes for possession (today's, people's). Comma before non-restrictive "which". Em dashes (—) are not NZ style AND are a classic AI tell — flag every em dash in the draft and correct it to a spaced en dash ( – ), a comma or a restructured sentence.

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
- Use NZ English in your own prose; NO Oxford commas in your output; NEVER use em dashes (—) in your output — use a spaced en dash ( – ) or restructure
- BE THOROUGH on spelling and te reo Māori — find EVERY US spelling and EVERY missing macron in the draft. These are mechanical and the cap doesn't apply: catch them all.
- For grammar/style/structure, cap at 40 issues (prioritise high-severity).
- Be honest about weak structure. Don't pad praise.

CORRECTEDSPAN RULES (per-issue, much faster than rebuilding the whole draft):
- For mechanical fixes only — set "correctedSpan" to the verbatim quote with the fix applied.
- Examples:
    where: "todays rapidly evolving healthcare"
    correctedSpan: "today's rapidly evolving healthcare"

    where: "many Maori practitioners use"
    correctedSpan: "many Māori practitioners use"

    where: "biological, psychological, and social factors"
    correctedSpan: "biological, psychological and social factors"

    where: "Some Maoris feel this model"
    correctedSpan: "Some Māori feel this model"

- For grammar/style/structure issues, set "correctedSpan" to null. Those require student judgement; we don't auto-replace them.
- The "where" string MUST appear in the draft EXACTLY, character-for-character. Don't paraphrase it. The client does plain find-and-replace, so the find target has to match.`;

// Chunk-mode prompt: just issues, no structure notes (those are done
// separately by analyseStructure). Smaller schema = Flash handles it
// reliably even at 4000 maxTokens. We tell the model this is one
// section so it doesn't critique structure or write a summary.
const CHUNK_SYSTEM_PROMPT = `You are an experienced NZ academic editor checking ONE SECTION of an Open Polytechnic undergraduate essay. Catch real errors, output JSON only.

You are NOT critiquing structure — that's done separately on the full draft. Focus only on sentence-level issues:
- Spelling (NZ -ise/-our/-re; see list below)
- Te reo Māori macrons and plurals
- Grammar (affect/effect, less/fewer, comma splices, agreement)
- Punctuation (no Oxford commas, apostrophes, restrictive/non-restrictive)
- Style (AI clichés, stacked transitions, intensifiers, passive overuse)

OUTPUT (JSON, no markdown):
{
  "issues": [{
    "category": "spelling"|"grammar"|"punctuation"|"tereo"|"style",
    "severity": "high"|"medium"|"low",
    "where": "5-15 word VERBATIM quote from this section (must appear exactly, character-for-character)",
    "correctedSpan": "string — verbatim quote with the fix applied. ONLY populate for mechanical fixes (spelling, tereo macrons + plurals, Oxford comma removal, missing apostrophes). For grammar/style issues, set to null.",
    "problem": "what's wrong, 1 sentence",
    "suggestion": "the fix with corrected text in 'quotes'",
    "rule": "1-sentence rule"
  }]
}

KEY GOTCHAS:

Spelling: -ise (organise, analyse, recognise) NOT -ize. -our (colour, behaviour) NOT -or. -re (centre, fibre) NOT -er. judgement, grey, ageing, programme (TV/event), tyre, kerb, defence/offence/licence (n.), fulfil/instil (single-l), travelled (double-l).

Te reo Māori (HIGH severity always — be thorough):
- Flag EVERY missing macron. Common forms:
  Māori (NOT Maori), whānau (NOT whanau), hapū (NOT hapu),
  mātauranga (NOT matauranga), kōrero (NOT korero), tikanga,
  hauora, Pākehā (NOT Pakeha), Aotearoa, tāne (NOT tane),
  wāhine (NOT wahine), Te Whare Tapa Whā (NOT Wha),
  kōhanga (NOT kohanga), pōwhiri (NOT powhiri),
  kaumātua (NOT kaumatua), tūrangawaewae, tūpuna (NOT tupuna),
  tamariki, rangatahi, ngā, tēnā, taonga
- Plural rule: te reo nouns DON'T take English -s.
  "Māoris" → "Māori", "iwis" → "iwi", "hapūs" → "hapū",
  "marae's" → "marae", "whānaus" → "whānau"
- Do NOT italicise te reo in NZ academic writing.

Punctuation: NO Oxford comma. Apostrophes for possession. Comma before non-restrictive "which". Flag every em dash (—) — not NZ style and a classic AI tell; correct to a spaced en dash ( – ), a comma or a restructured sentence.

Grammar: affect (v) vs effect (n), less (uncountable) vs fewer (countable), comma splices, subject-verb agreement.

Style — AI cliché phrases to ALWAYS flag:
  "in today's rapidly evolving landscape", "rapidly evolving"
  "It is important to note", "It should be noted"
  "delve into", "delves into"
  "tapestry of", "rich tapestry"
  "navigate the complexities", "navigating the complexities"
  "multifaceted", "nuanced"
  "underscore", "underscores the importance"
  "in conclusion" (as opener)
Plus stacked transitions (Furthermore + Moreover + Additionally), passive when active is clearer, "really"/"very" intensifiers in academic prose.

OUTPUT RULES:
- "where" MUST be exact verbatim quote from THIS SECTION.
- ONLY emit issues for actual problems. NEVER emit an issue with "no change needed", "correct as is", "no issue here" or similar — if it's correct, leave it out entirely.
- DEDUPLICATE: if the same word is misspelled multiple times in this section (e.g. "Maori" appears 5×), emit ONE issue for it on the first occurrence. Don't repeat the same fix per occurrence — the student will find-and-replace.
- For grammar/style, cap at 25 issues for this section (prioritise high-severity).
- Use NZ English. NO Oxford commas in your output. NEVER use em dashes (—) in your output.
- Set "correctedSpan" to null for non-mechanical issues.
- Do NOT think out loud inside the JSON. If you're uncertain, omit the issue. Issues are for problems you're confident about.`;

// Structure-only prompt: small output, runs in parallel with chunk
// edits. Doesn't list sentence errors — those come from the chunks.
const STRUCTURE_SYSTEM_PROMPT = `You are an experienced NZ academic editor reviewing the STRUCTURE of an Open Polytechnic undergraduate APA 7 essay. Don't list sentence-level errors — those are checked separately. Output JSON only.

OUTPUT (JSON, no markdown):
{
  "summary": "2-3 sentence honest overall verdict on the draft",
  "structureNotes": {
    "introduction": "2-3 sentences on hook/context/thesis",
    "bodyParagraphs": "PEEL adherence, citations, topic sentences",
    "conclusion": "synthesises vs summarises?",
    "flow": "signposting, variety, transitions",
    "topImprovements": ["3-5 bullet points of biggest fixes"]
  }
}

KEY POINTS:
- Thesis must be arguable + specific (not "In this essay I will discuss").
- Body paragraphs need topic sentences + 1-2 citations + analysis (not just description).
- Conclusion synthesises — no new evidence, no formulaic "Further research is needed".
- Be honest about weak structure. Don't pad praise.
- Use NZ English. NO Oxford commas in your output. NEVER use em dashes (—) in your output.`;

// Shared helper: call OpenRouter with Flash → Pro fallback on
// empty/timeout errors. Used by both editChunk and analyseStructure.
async function callWithFallback(args: {
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
}): Promise<{ raw: string; modelUsed: string; usage: { inputTokens: number; outputTokens: number } }> {
  const primaryModel = "deepseek/deepseek-v4-flash";
  try {
    const r = await callOpenRouterDetailed({
      model: primaryModel,
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: args.maxTokens,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userContent },
      ],
    });
    return { raw: r.content, modelUsed: r.modelUsed, usage: r.usage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fall back to V4 Pro on ANY error from the AI call. Auth/quota/
    // input-size errors throw before this try block — anything here
    // came from OpenRouter, so a tier-drop is the right response.
    // eslint-disable-next-line no-console
    console.warn(
      `nzEditor: primary ${primaryModel} failed (${msg}). Falling back to deepseek-v4-pro.`,
    );
    const r = await callOpenRouterDetailed({
      model: "deepseek/deepseek-v4-pro",
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: args.maxTokens,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userContent },
      ],
    });
    return { raw: r.content, modelUsed: r.modelUsed, usage: r.usage };
  }
}

// Edit ONE chunk. Client splits the draft at paragraph boundaries and
// calls this in parallel for each chunk. Returns just an issues array.
export const editChunk = action({
  args: {
    text: v.string(),
    chunkIndex: v.number(),
    totalChunks: v.number(),
  },
  handler: logErrors("nzEditor.editChunk", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const userContent = `Section ${args.chunkIndex + 1} of ${args.totalChunks} of a longer essay. Find sentence-level issues only.\n\n${args.text}`;
    // 6000 tokens covers ~40-50 issues per chunk on Flash. If Flash
    // still truncates (very dense sections with missing macrons in
    // every other word), we retry on Pro with a bigger budget — Pro
    // handles 10k output reliably.
    let raw: string;
    let modelUsed: string;
    let usage: { inputTokens: number; outputTokens: number };
    {
      const r = await callWithFallback({
        systemPrompt: CHUNK_SYSTEM_PROMPT,
        userContent,
        maxTokens: 6000,
      });
      raw = r.raw;
      modelUsed = r.modelUsed;
      usage = r.usage;
    }

    let result: unknown;
    let parseErr: unknown = null;
    try {
      result = safeJsonParse(raw);
    } catch (err) {
      parseErr = err;
    }

    if (parseErr !== null) {
      const msg = parseErr instanceof Error ? parseErr.message : "";
      const isTruncation =
        msg.includes("Unterminated") ||
        msg.includes("Unexpected end") ||
        msg.includes("position");
      if (isTruncation) {
        // Retry once on Pro with a much bigger output budget. Pro is
        // slower but won't truncate at this scale.
        try {
          const retry = await callOpenRouterDetailed({
            model: "deepseek/deepseek-v4-pro",
            responseFormatJson: true,
            temperature: 0.2,
            maxTokens: 10000,
            messages: [
              { role: "system", content: CHUNK_SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          });
          result = safeJsonParse(retry.content);
          raw = retry.content;
          modelUsed = retry.modelUsed;
          usage = retry.usage;
        } catch {
          throw new Error(
            `Section ${args.chunkIndex + 1} response got cut off even after retry. Try a shorter section.`,
          );
        }
      } else {
        throw parseErr;
      }
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "nzEditor.editChunk",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  }),
});

// Analyse the WHOLE draft for structure. Runs in parallel with the
// chunk calls. Small output; Flash handles it easily.
export const analyseStructure = action({
  args: {
    text: v.string(),
  },
  handler: logErrors("nzEditor.analyseStructure", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const { raw, modelUsed, usage } = await callWithFallback({
      systemPrompt: STRUCTURE_SYSTEM_PROMPT,
      userContent: args.text,
      maxTokens: 2500,
    });

    let result: unknown;
    try {
      result = safeJsonParse(raw);
    } catch (err) {
      throw err;
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "nzEditor.analyseStructure",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  }),
});

export const edit = action({
  args: {
    text: v.string(),
    model: v.optional(v.string()),
    assignmentId: v.optional(v.id("assignments")),
  },
  handler: logErrors("nzEditor.edit", async (ctx, args) => {
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

    // Back to V4 Flash now that we've removed the bulky correctedDraft
    // field — the per-issue correctedSpan strings are tiny by
    // comparison. With smaller output, Flash handles the schema fine
    // and runs ~2x faster. Falls back to Pro if Flash hiccups.
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
      const msg = err instanceof Error ? err.message : String(err);
      // Fall back to the sibling tier on ANY error from the AI call —
      // auth/quota/input-size errors throw before this try block, so
      // anything here came from OpenRouter (rate-limits, 5xx, content
      // filters, malformed JSON, timeouts). Tier-drop beats throwing.
      const fallbackModel =
        primaryModel === "deepseek/deepseek-v4-pro"
          ? "deepseek/deepseek-v4-flash"
          : "deepseek/deepseek-v4-pro";
      // eslint-disable-next-line no-console
      console.warn(
        `nzEditor.analyseStructure: primary ${primaryModel} failed (${msg}). Falling back to ${fallbackModel}.`,
      );
      const r = await callOpenRouterDetailed({
        model: fallbackModel,
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

    // Save a compact digest into the shared assignment memory so the
    // dashboard tutor chat can answer questions about this edit. One
    // digest per (user, assignment, tool); the mutation replaces any
    // prior. Wrapped in try/catch so a memory hiccup never sinks the
    // edit result the student is waiting on.
    if (args.assignmentId) {
      try {
        const r = result as {
          summary?: string;
          totalIssues?: number;
          byCategory?: Record<string, number>;
          issues?: Array<{
            category?: string;
            severity?: string;
            where?: string;
            problem?: string;
            suggestion?: string;
          }>;
          structureNotes?: {
            topImprovements?: string[];
          };
        };

        const CATEGORY_LABELS: Record<string, string> = {
          spelling: "spelling",
          grammar: "grammar",
          punctuation: "punctuation",
          tereo: "te reo macrons",
          style: "style",
          structure: "structure",
        };

        const lines: string[] = [];
        lines.push("NZ Editor digest");
        if (typeof r.summary === "string" && r.summary.trim()) {
          lines.push("");
          lines.push(`Overall: ${r.summary.trim()}`);
        }

        const total =
          typeof r.totalIssues === "number"
            ? r.totalIssues
            : Array.isArray(r.issues)
              ? r.issues.length
              : 0;
        lines.push("");
        lines.push(`Total issues: ${total}`);

        const byCat = r.byCategory ?? {};
        const catParts = Object.entries(byCat)
          .filter(([, n]) => typeof n === "number" && n > 0)
          .map(([k, n]) => `${CATEGORY_LABELS[k] ?? k}: ${n}`);
        if (catParts.length > 0) {
          lines.push(`By category – ${catParts.join(", ")}`);
        }

        // Top issues by severity (high first), capped at 8.
        const SEV: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const ranked = (Array.isArray(r.issues) ? r.issues : [])
          .slice()
          .sort(
            (a, b) =>
              (SEV[a.severity ?? "low"] ?? 2) - (SEV[b.severity ?? "low"] ?? 2),
          )
          .slice(0, 8);
        if (ranked.length > 0) {
          lines.push("");
          lines.push("Top issues:");
          for (const i of ranked) {
            const cat = CATEGORY_LABELS[i.category ?? ""] ?? i.category ?? "issue";
            const sev = i.severity ?? "";
            const problem = (i.problem ?? "").trim();
            const where = (i.where ?? "").trim();
            const wherePart = where ? ` ("${where}")` : "";
            lines.push(`- [${cat}${sev ? "/" + sev : ""}] ${problem}${wherePart}`);
          }
        }

        const topImps = r.structureNotes?.topImprovements;
        if (Array.isArray(topImps) && topImps.length > 0) {
          lines.push("");
          lines.push("Structure – top improvements:");
          for (const t of topImps.slice(0, 5)) {
            if (typeof t === "string" && t.trim()) lines.push(`- ${t.trim()}`);
          }
        }

        let summary = lines.join("\n");
        if (summary.length > 1500) summary = summary.slice(0, 1497) + "...";

        await ctx.runMutation(internal.assignmentArtifacts.record, {
          userId,
          assignmentId: args.assignmentId,
          tool: "nzEditor",
          title: "NZ Editor",
          summary,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `nzEditor.edit: failed to record assignment digest: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return result;
  }),
});
