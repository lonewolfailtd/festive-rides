"use node";

// Submission Audit: pre-submit rubric coverage check.
//
// The student pastes (or auto-loads) their finished draft + the rubric.
// The AI judges, for each rubric criterion, whether the draft addresses
// it — and if not, names the gap in DIRECTION terms (not the missing
// words themselves). The student does the actual writing; we just
// surface what a marker would flag.
//
// Why this exists (and why it's distinct from Coach/Editor/Analyser):
//   - Analyser checks the brief BEFORE writing
//   - Editor / Coach check the prose WHILE drafting
//   - Submission Audit checks the FINISHED draft against the SPECIFIC
//     rubric the marker will use — the only artefact that actually
//     predicts the mark
//
// Single action — small structured output, one round-trip. No chunking
// because coverage is global (you can't judge "did I cite a study?" by
// looking at half the draft).

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an experienced Open Polytechnic NZ marker auditing a student's FINISHED draft against the EXACT rubric the marker will use. Your job is to HIGHLIGHT gaps and give DIRECTION — never to write the missing content for the student. They must do their own work.

OUTPUT (JSON, no markdown):
{
  "overall": {
    "predictedScoreRange": { "min": number, "max": number, "outOf": number },
    "readinessLevel": "needs-work" | "almost-there" | "submission-ready",
    "summary": "2-3 sentences honest verdict. Be specific about the biggest gaps."
  },
  "sections": [
    {
      "sectionName": "string — e.g. 'Paragraph 1: Developmental psychology' or 'Task 2: Influence on today'",
      "sectionScoreRange": { "min": number, "max": number, "outOf": number } | null,
      "criteria": [
        {
          "name": "string — e.g. 'Recent research / seminal study'",
          "bandEstimate": "string — e.g. '7.5-9.5 (mid)' or '12-15 (top)'",
          "status": "covered" | "partial" | "missing",
          "evidence": "string|null — verbatim quote from draft (5-15 words) IF status is 'covered' or 'partial'. Null for 'missing'.",
          "gap": "string|null — what's absent or under-developed. Be specific: name the rubric requirement and what the draft lacks. Null for 'covered'.",
          "direction": "string|null — DIRECTIONAL guidance only. Tell the student WHAT TYPE of content to add (e.g. 'cite a recent meta-analysis on CBT efficacy and briefly describe its findings'), NEVER write the actual sentences. Null for 'covered'.",
          "potentialMarkGain": "string|null — e.g. '+3 to +4 marks' or '+1 mark'. Null for 'covered'."
        }
      ]
    }
  ],
  "quickWins": [
    "string — single-line actionable improvements, ordered by mark impact (highest first). Each should name the section and what to add in direction terms, max 5 bullets."
  ]
}

NON-NEGOTIABLE RULES:

1. DO NOT WRITE THE MISSING CONTENT. Never produce sentences the student could paste in. Forbidden patterns:
   - "Add something like: '...'"  ✗
   - "You could write: '...'"      ✗
   - "Try this sentence: '...'"    ✗
   - "Insert: [actual prose]"      ✗

   Required pattern: name the TYPE of content + WHERE it goes.
   - "Add a citation to a recent (post-2015) study on internet-delivered CBT, and briefly describe what the study measured and what it found (1-2 sentences)." ✓
   - "Explain what 'object permanence' was tested for in the study you cited — what task did the infants perform?" ✓
   - "Add 2-3 sentences positioning Skinner's behaviourism relative to the cognitive revolution of the 1960s-70s." ✓

2. BAND ESTIMATES MUST BE RANGES, NOT EXACT NUMBERS. Use the rubric's own band labels where possible. "7.5-9.5 (mid)" not "8.5". The model isn't actually marking — it's estimating which band a marker would land in.

3. QUOTE THE EVIDENCE VERBATIM. For 'covered' or 'partial' status, quote 5-15 words from the draft EXACTLY. If you can't quote it verbatim, set status to 'missing'.

4. MATCH SECTIONS TO RUBRIC STRUCTURE. If the rubric has 3 paragraphs scored separately (e.g. P1/P2/P3 each on the same 15-mark scale), produce 3 separate sections — each with the same criteria. If the rubric has different criteria per question, produce one section per question.

5. NZ ENGLISH. Use -ise, -our, -re spellings. NO Oxford commas. Use 'whānau', 'Māori', 'Pākehā' with macrons.

6. BE HONEST. If a section is weak, say so. If the rubric requires a study and the draft has none, that's 'missing', not 'partial'. Markers don't pad praise; neither should you.

7. PREDICTED SCORE: sum the midpoints of your section band estimates. Express as a RANGE (min/max), not a single number. If you've never seen the rubric awarding more than 100 marks, the 'outOf' is what the rubric explicitly totals.

8. QUICK WINS: rank by mark impact, not by ease. The 5 things that would gain the most marks if addressed. Each should be one line + name the section + give direction (not words).`;

export const audit = action({
  args: {
    draftText: v.string(),
    rubricText: v.string(),
    briefText: v.optional(v.string()),
    // Optional name so the result UI can label what was audited.
    assignmentName: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const draft = args.draftText.trim();
    const rubric = args.rubricText.trim();
    if (draft.length < 500) {
      throw new Error(
        "Paste at least 500 characters of your finished draft so the audit has enough to judge.",
      );
    }
    if (draft.length > 40000) {
      throw new Error(
        "Draft is very long — trim to under 40,000 characters or audit one major section at a time.",
      );
    }
    if (rubric.length < 100) {
      throw new Error(
        "The rubric is too short — paste the full marking schedule (band descriptors per criterion).",
      );
    }
    if (rubric.length > 15000) {
      throw new Error(
        "Rubric is very long. Trim to the marking schedule rows / criteria descriptors only.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Pro by default: this is high-stakes (predicts the mark) and slower
    // is acceptable. Falls back to Flash if Pro hiccups.
    const primaryModel = args.model ?? "deepseek/deepseek-v4-pro";

    // Build a structured user message that keeps draft / rubric / brief
    // visually separated so the model doesn't conflate them.
    const userContent = [
      args.briefText
        ? `=== ASSIGNMENT BRIEF (context only — judge against the rubric below) ===\n${args.briefText.trim()}\n`
        : null,
      `=== RUBRIC (judge the draft against THIS, criterion by criterion) ===\n${rubric}\n`,
      `=== STUDENT DRAFT ===\n${draft}\n`,
      "Audit the draft against every rubric criterion. Remember: highlight gaps and give DIRECTION only. Never write the missing content.",
    ]
      .filter(Boolean)
      .join("\n");

    let raw: string;
    let modelUsed: string;
    let usage: { inputTokens: number; outputTokens: number };
    try {
      const r = await callOpenRouterDetailed({
        model: primaryModel,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 8000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      raw = r.content;
      modelUsed = r.modelUsed;
      usage = r.usage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isTransient =
        msg.includes("empty response") ||
        msg.includes("no content") ||
        msg.includes("timed out");
      if (!isTransient) throw err;
      // Fall back to Flash if Pro hiccups.
      const fallbackModel =
        primaryModel === "deepseek/deepseek-v4-pro"
          ? "deepseek/deepseek-v4-flash"
          : "deepseek/deepseek-v4-pro";
      const r = await callOpenRouterDetailed({
        model: fallbackModel,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 8000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
      if (msg.includes("Unterminated") || msg.includes("Unexpected end")) {
        throw new Error(
          "The audit's response got cut off. Try splitting your draft — audit one major section against the relevant rubric rows at a time.",
        );
      }
      throw err;
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "submissionAudit.audit",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  },
});
