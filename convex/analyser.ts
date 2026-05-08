"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an academic study coach for Open Polytechnic of New Zealand students working on assignments referenced in APA 7.

Analyse what the assignment is asking and produce a structured plan that helps the student understand the brief, plan their structure and know what kind of sources to seek. Open Polytech briefs are usually 5-8 page PDFs that contain a title page (course code, assessment number, weighting %, learning outcomes), then MULTIPLE separate tasks ("Task 1", "Task 2"...) each with their own scenario, sub-questions (a, b, c, d), word count and marks, then a marking-schedule table at the end. You MUST extract every task separately — do NOT merge them into one outline.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "summary": "string — 2-3 sentence plain-English summary of what the whole assessment is asking",
  "keyQuestion": "string — the overall question/task being asked, in one sentence",
  "courseCode": "string|null — e.g. '73195' if visible at the top of the brief",
  "assessmentNumber": "string|null — e.g. 'Assessment 3'",
  "weightingPercent": number|null,
  "totalMarks": number|null,
  "tasks": [
    {
      "taskNumber": "string — 'Task 1', 'Task 2'...",
      "scenario": "string — 1-2 sentence summary of the scenario or case (NOT a verbatim copy of the brief)",
      "subQuestions": ["string — each sub-question (a, b, c, d) as a single line"],
      "conceptsRequired": ["string — explicit theories/models named in the question, e.g. 'Atkinson-Shiffrin model of memory (1968)', 'biopsychosocial model'"],
      "searchableQueries": ["string — 3-5 SHORT (5-15 word) scholarly-search phrases the student could plug into a paper search to find sources for THIS task. Each must read like a research query, NOT an instruction. Examples: 'Bandura social learning theory', 'operant conditioning language acquisition', 'biopsychosocial model chronic pain'. Do NOT include task instructions like 'select three subfields' or formatting rules like 'begin each paragraph with a heading' or meta requirements like 'include APA citations'."],
      "wordCountGuideline": number|null,
      "marks": number|null,
      "outline": ["string — bullet plan for what the answer should cover"],
      "suggestedSources": ["string — source types specific to THIS task's topic"]
    }
  ],
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
- If the brief has multiple numbered tasks, populate the "tasks" array with one object per task. If it's a single-task assessment, you may leave "tasks" as an empty array and rely on the top-level "outline".
- The top-level "outline", "wordCountSplit" and "sourceTypesNeeded" remain a synthesised view ACROSS all tasks (so the student can see the whole picture at once).
- When extracting concepts in conceptsRequired, include the year if cited in the brief (e.g. "Atkinson-Shiffrin model of memory (1968)").
- If the assignment mentions Mātauranga Māori models (Te Whare Tapa Whā, Fonofale), te reo terms (marae, karakia, whānau, hauora) or NZ-specific contexts, the top-level "sourceTypesNeeded" AND each relevant task's "suggestedSources" MUST include NZ-specific source types: Te Whatu Ora / Ministry of Health publications, Mai Journal, AlterNative: An International Journal of Indigenous Peoples, Open Polytech library Māori health resources, and Durie M.'s Whaiora and Te Pae Mahutonga. Do NOT recommend international or US sources for NZ-specific topics.
- For NZ Open Polytech psychology assignments, also recommend the Wayne Weiten Psychology textbook and NZ-context texts the course often references.
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
    assignmentId: v.optional(v.id("assignments")),
    model: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: Id<"analyses">; result: unknown }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.brief.trim();
    if (trimmed.length < 30) {
      throw new Error("Please paste the full assignment brief (at least 30 characters).");
    }
    if (trimmed.length > 12000) {
      throw new Error("Brief is very long — please trim to under 12000 characters.");
    }

    const model = args.model ?? "deepseek/deepseek-v4-flash";
    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model,
      responseFormatJson: true,
      temperature: 0.2,
      maxTokens: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(trimmed, args.rubric, args.wordCountTarget) },
      ],
    });

    const result = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "analyser.analyse",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    // Persist alongside the assignment so the plan reloads on next visit.
    const id = await ctx.runMutation(internal.analysisStore._saveResult, {
      userId,
      assignmentId: args.assignmentId,
      brief: trimmed,
      rubric: args.rubric,
      wordCountTarget: args.wordCountTarget,
      result,
      modelUsed,
    });

    return { id, result };
  },
});

// Iterate on an existing analysis with feedback. Re-runs the AI with the
// previous result + the user's targeted feedback, then patches the analysis
// row in place (so checkboxes are preserved if applicable).
export const iterate = action({
  args: {
    id: v.id("analyses"),
    feedback: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ result: unknown }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (args.feedback.trim().length < 5) {
      throw new Error("Feedback is too short.");
    }
    const existing = (await ctx.runQuery(internal.analysisStore._getInternal, {
      id: args.id,
      userId,
    })) as
      | {
          brief: string;
          rubric?: string;
          wordCountTarget?: number;
          result: unknown;
        }
      | null;
    if (!existing) throw new Error("Analysis not found");

    const model = args.model ?? "deepseek/deepseek-v4-flash";
    const userPrompt = `${buildPrompt(existing.brief, existing.rubric, existing.wordCountTarget)}

PREVIOUS ANALYSIS (refine this — don't start from scratch):
${JSON.stringify(existing.result, null, 2)}

USER FEEDBACK:
${args.feedback.trim()}`;

    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model,
      responseFormatJson: true,
      temperature: 0.25,
      maxTokens: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const result = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "analyser.iterate",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    await ctx.runMutation(internal.analysisStore._patchResult, {
      id: args.id,
      userId,
      result,
      modelUsed,
    });
    return { result };
  },
});

// Rubric mapper — takes an existing analysis and produces a mapping from
// each rubric criterion to the specific outline sections that earn those
// marks. Helps the student see which paragraphs are doing the work for
// which marks (and which criteria are at risk of being underserved).
const RUBRIC_MAPPER_PROMPT = `You are an academic study coach. You have already analysed an assignment brief and produced an outline + rubric breakdown. Now map each rubric criterion to the specific outline sections that earn those marks.

Output ONLY valid JSON matching this schema:
{
  "mappings": [
    {
      "criterion": "string — the rubric criterion name",
      "weightPercent": number,
      "earnsMarksIn": ["string — outline section names that earn marks for this criterion"],
      "atRisk": boolean — true if no outline section meaningfully covers this criterion,
      "advice": "string — what the student should add or strengthen to lock in these marks"
    }
  ],
  "sectionLoad": [
    { "section": "string — outline section name", "criteriaCovered": ["string — criterion names"], "marksAvailable": number }
  ],
  "overallNotes": "string — 2-3 sentences on whether the outline is well-balanced or skewed"
}

Hard rules:
- Use NZ English (organise, behaviour, analyse, colour).
- Do NOT use the Oxford comma.
- Use the EXACT criterion names and section names from the analysis JSON — don't paraphrase them.
- "atRisk" should be true if a criterion has no clearly mapped section, OR if the section that maps to it isn't given enough word-count to do the criterion justice.
- "marksAvailable" sums weightPercent of every criterion that section covers.`;

export const mapRubric = action({
  args: {
    id: v.id("analyses"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ mapping: unknown }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = (await ctx.runQuery(internal.analysisStore._getInternal, {
      id: args.id,
      userId,
    })) as { result: unknown } | null;
    if (!existing) throw new Error("Analysis not found");

    const model = args.model ?? "deepseek/deepseek-v4-flash";
    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model,
      responseFormatJson: true,
      temperature: 0.15,
      maxTokens: 2000,
      messages: [
        { role: "system", content: RUBRIC_MAPPER_PROMPT },
        {
          role: "user",
          content: `EXISTING ANALYSIS:\n${JSON.stringify(existing.result, null, 2)}`,
        },
      ],
    });
    const mapping = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "analyser.mapRubric",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return { mapping };
  },
});
