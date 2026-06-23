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
    "summary": "2-3 sentences honest verdict. Be specific about the biggest gaps.",
    "unattemptedSections": [
      {
        "sectionName": "string — a REQUIRED section the draft does not address at all",
        "marksAtStake": "number — the marks lost by leaving this section blank (its full mark value)",
        "outOf": "number — the section's total marks (same as marksAtStake for a blank section)"
      }
    ],
    "citationTypeCheck": {
      "required": "boolean — true only if the rubric explicitly calls for specific in-text citation TYPES",
      "parentheticalFound": "boolean — draft contains at least one parenthetical citation e.g. (Smith, 2020)",
      "narrativeFound": "boolean — draft contains at least one narrative/in-text citation e.g. Smith (2020) found...",
      "note": "string — DIRECTION only: which type is missing and where to add one. Empty string if both present."
    } | null
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

2. BAND ESTIMATES MUST BE RANGES, NOT EXACT NUMBERS. Use the rubric's own band labels VERBATIM where possible.
   - GOOD: "7.5-9.5 marks" or "10-11.5 marks" — straight from the rubric.
   - BAD: "8.5", "9", "Band B" (made up), "7.5-9.5 (mid)" (avoid the "(mid)" tag — it was being applied incorrectly to bands that aren't the middle of their scale, e.g. 3.5 on the 5-mark Writing rubric isn't the middle band).

3. QUOTE THE EVIDENCE VERBATIM. For 'covered' or 'partial' status, quote 5-15 words from the draft EXACTLY. If you can't quote it verbatim, set status to 'missing'.

4. MATCH SECTIONS TO RUBRIC STRUCTURE. If the rubric has 3 paragraphs scored separately (e.g. P1/P2/P3 each on the same 15-mark scale), produce 3 separate sections — each with the same criteria. If the rubric has different criteria per question, produce one section per question.

5. NZ ENGLISH. Use -ise, -our, -re spellings. NO Oxford commas. Use 'whānau', 'Māori', 'Pākehā' with macrons.

6. BE HONEST. If a section is weak, say so. If the rubric requires a study and the draft has none, that's 'missing', not 'partial'. Markers don't pad praise; neither should you. BUT also don't mark down for things the rubric doesn't ask about — judge against what the rubric actually says, not your idea of an ideal answer.

7. PREDICTED SCORE: sum the midpoints of your section band estimates. Express as a RANGE (min/max), not a single number. If you've never seen the rubric awarding more than 100 marks, the 'outOf' is what the rubric explicitly totals.

8. QUICK WINS: rank by mark impact, not by ease. The 5 things that would gain the most marks if addressed. Each should be one line + name the section + give direction (not words).

9. DO NOT THINK OUT LOUD IN THE JSON. If you're uncertain about a citation, a date, or whether something is in the reference list, EITHER omit the issue OR state it as a clear flag for the student to check — never narrate your own verification ("2021 vs 2021 — actually correct, but..."). The output must read like a marker's notes, not your reasoning process.

10. KEEP GAP + DIRECTION TIGHT. Aim for 2-3 sentences each. The student is scanning 8-15 criteria; long prose blocks per criterion buries the actionable bits.

11. UNATTEMPTED SECTIONS ARE THE #1 PRIORITY. A required section the draft does not address AT ALL — there is NO substantive content for that section's task and you cannot quote a single sentence attempting it — is "unattempted". A blank section loses EVERY mark it is worth, so this is the single biggest score lever. For each one, add an entry to overall.unattemptedSections with the marks at stake (from the rubric). STILL include the section in the 'sections' array with its criteria marked 'missing' so the per-section view is complete.
    Be strict about the threshold: "unattempted" means the section's CORE content is absent, NOT that one required part is missing. A section where the student has written real content but left out a sub-requirement (e.g. an essay with prose but no reference list, or an answer missing one citation) is PARTIAL — flag those as 'partial'/'missing' criteria within the section, NOT as an unattempted section. Only list a section here when the student clearly never attempted that task. If every required section has genuine content, return an empty array.

12. CITATION TYPE CHECK. Open Polytechnic rubrics often require BOTH a narrative/in-text citation (author named in the sentence, e.g. "Smith (2020) found...") AND a parenthetical citation (e.g. "(Smith, 2020)") — frequently for a specific pre-selected article. If the rubric calls for specific citation TYPES, set citationTypeCheck.required = true, then scan the draft and set parentheticalFound / narrativeFound honestly. In 'note', name which type is missing and where to add one — DIRECTION ONLY, never write the citation itself. If the rubric does NOT single out citation types, set citationTypeCheck to null.`;

// Result shape, mirroring the JSON the model is told to emit (see
// SYSTEM_PROMPT) and the client's AuditResult interface. Only the fields
// the digest reads are typed; everything is optional/loose because the
// model output is not schema-validated.
type AuditCriterion = {
  name?: string;
  status?: "covered" | "partial" | "missing";
};
type AuditSection = {
  sectionName?: string;
  criteria?: AuditCriterion[];
};
type AuditResultShape = {
  overall?: {
    predictedScoreRange?: { min?: number; max?: number; outOf?: number };
    readinessLevel?: string;
    summary?: string;
    unattemptedSections?: { sectionName?: string; marksAtStake?: number }[];
  };
  sections?: AuditSection[];
  quickWins?: string[];
};

// Build a compact plain-text digest (max ~1500 chars) of an audit result
// for the shared assignment memory. Reads the actual result shape: the
// predicted mark/band, counts of covered/partial/missing criteria, the
// names of partial + missing criteria, and the top quick wins / gaps.
function buildAuditDigest(raw: unknown): string {
  const r = (raw ?? {}) as AuditResultShape;
  const overall = r.overall ?? {};
  const sections = Array.isArray(r.sections) ? r.sections : [];

  const lines: string[] = ["Submission Audit"];

  const score = overall.predictedScoreRange;
  if (score && typeof score.min === "number" && typeof score.max === "number") {
    const outOf = typeof score.outOf === "number" ? ` / ${score.outOf}` : "";
    lines.push(`Predicted mark: ${score.min}-${score.max}${outOf} (rubric-compliance floor; markers typically add ~5-10).`);
  }
  if (overall.readinessLevel) {
    lines.push(`Readiness: ${overall.readinessLevel}.`);
  }

  // Coverage counts + names of the partial/missing criteria.
  let covered = 0;
  let partial = 0;
  let missing = 0;
  const partialNames: string[] = [];
  const missingNames: string[] = [];
  for (const s of sections) {
    const crits = Array.isArray(s.criteria) ? s.criteria : [];
    for (const c of crits) {
      const label = c.name ? `${c.name} (${s.sectionName ?? "section"})` : null;
      if (c.status === "covered") covered++;
      else if (c.status === "partial") {
        partial++;
        if (label) partialNames.push(label);
      } else if (c.status === "missing") {
        missing++;
        if (label) missingNames.push(label);
      }
    }
  }
  lines.push(`Criteria: ${covered} covered, ${partial} partial, ${missing} missing.`);

  const unattempted = Array.isArray(overall.unattemptedSections)
    ? overall.unattemptedSections
    : [];
  if (unattempted.length > 0) {
    const names = unattempted
      .map((u) => u.sectionName)
      .filter((n): n is string => !!n);
    lines.push(`Unattempted sections: ${names.join("; ") || unattempted.length}.`);
  }

  if (partialNames.length > 0) {
    lines.push(`Partial: ${partialNames.join("; ")}.`);
  }
  if (missingNames.length > 0) {
    lines.push(`Missing: ${missingNames.join("; ")}.`);
  }

  const quickWins = Array.isArray(r.quickWins) ? r.quickWins : [];
  if (quickWins.length > 0) {
    lines.push("Top recommendations:");
    for (const w of quickWins.slice(0, 5)) {
      if (typeof w === "string" && w.trim()) lines.push(`- ${w.trim()}`);
    }
  }

  if (overall.summary) {
    lines.push(`Verdict: ${overall.summary}`);
  }

  let digest = lines.join("\n");
  // Hard cap at ~1500 chars so the shared memory stays compact.
  const MAX = 1500;
  if (digest.length > MAX) {
    digest = digest.slice(0, MAX - 1).trimEnd() + "…";
  }
  return digest;
}

export const audit = action({
  args: {
    draftText: v.string(),
    rubricText: v.string(),
    briefText: v.optional(v.string()),
    // Optional name so the result UI can label what was audited.
    assignmentName: v.optional(v.string()),
    // When set, a compact digest of the result is saved into the shared
    // assignment memory so the dashboard tutor chat can answer questions
    // about this audit.
    assignmentId: v.optional(v.id("assignments")),
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
    if (rubric.length > 25000) {
      throw new Error(
        "Rubric is very long. Trim to the marking schedule rows / criteria descriptors only.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Gemini 2.5 Pro by default: this is the one tool that literally
    // predicts the student's mark, so judgement quality matters most
    // here. Gemini's calibration is closer to a real marker than
    // DeepSeek's, and it pushes back on weak claims more honestly.
    // Falls back to Gemini Flash on transient errors (much cheaper,
    // still capable on this structured-JSON task).
    const primaryModel = args.model ?? "google/gemini-2.5-pro";

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
        maxTokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      raw = r.content;
      modelUsed = r.modelUsed;
      usage = r.usage;
    } catch (err) {
      // Fall back to Flash on ANY error from the AI call. We're already
      // past input validation and auth/quota gates, so anything thrown
      // here came from OpenRouter — rate limits (429), provider down
      // (500/503), model overloaded, content filter, malformed JSON, or
      // timeouts. None of these are user-fixable; silently dropping a
      // model tier is better than throwing in the student's face.
      // (Earlier version only retried on three specific error strings
      // and missed everything else.)
      const msg = err instanceof Error ? err.message : String(err);
      // Symmetric fallback within the same model family (Gemini or
      // DeepSeek) so output style stays consistent.
      const fallbackModel =
        primaryModel === "google/gemini-2.5-pro"
          ? "google/gemini-2.5-flash"
          : primaryModel === "google/gemini-2.5-flash"
            ? "google/gemini-2.5-pro"
            : primaryModel === "deepseek/deepseek-v4-pro"
              ? "deepseek/deepseek-v4-flash"
              : "deepseek/deepseek-v4-pro";
      // eslint-disable-next-line no-console
      console.warn(
        `submissionAudit.audit: primary ${primaryModel} failed (${msg}). Falling back to ${fallbackModel}.`,
      );
      const r = await callOpenRouterDetailed({
        model: fallbackModel,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 6000,
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

    // Save a compact digest of this audit into the shared assignment
    // memory so the dashboard tutor chat can answer questions about it.
    // Wrapped in try/catch: a digest failure must never break the audit.
    if (args.assignmentId) {
      try {
        const summary = buildAuditDigest(result);
        await ctx.runMutation(internal.assignmentArtifacts.record, {
          userId,
          assignmentId: args.assignmentId,
          tool: "submissionAudit",
          title: "Submission Audit",
          summary,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `submissionAudit.audit: failed to record assignment artifact: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return result;
  },
});
