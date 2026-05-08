"use node";

// Quick Import: one-shot action for the dashboard drop-zone.
//
// The student drags a brief PDF/DOCX in (extracted to text client-side)
// and we:
//   1. Run the Analyser system prompt to extract structured fields
//      (courseCode, assessmentNumber, weighting, totalMarks, tasks, etc.)
//   2. Find or create the matching course (by courseCode case-insensitive)
//   3. Create a new assignment linked to the course, with sensible name +
//      brief + word count target inferred from the per-task guidelines
//   4. Save the analysis row linked to the assignment
//   5. Return everything the client needs to navigate / set active
//
// All the heavy lifting reuses the existing analyser prompt — we just
// wrap it with the extra "create the row" plumbing so the student doesn't
// have to manually create an assignment first.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an academic study coach for Open Polytechnic of New Zealand students. The student has uploaded an assignment brief and wants you to set up their workspace automatically.

Open Polytech briefs typically have a title page (course code like "73195", assessment number like "Assessment 3", a weighting %, learning outcomes), then MULTIPLE separate tasks ("Task 1", "Task 2"...) each with their own scenario, sub-questions (a, b, c, d), word count and marks, then a marking-schedule table at the end.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "summary": "string — 2-3 sentence plain-English summary of what the whole assessment is asking",
  "keyQuestion": "string — the overall question/task being asked, in one sentence",
  "courseCode": "string|null — e.g. '73195' if visible at the top of the brief",
  "courseName": "string|null — e.g. 'General and Applied Psychology' if visible",
  "assessmentNumber": "string|null — e.g. 'Assessment 3' or '3'",
  "weightingPercent": number|null,
  "totalMarks": number|null,
  "totalWordCount": number|null,
  "dueDateIso": "string|null — if the brief mentions a submission deadline ('Due: 23 May 2026', 'Submit by Friday 5 June', 'Submission deadline: 14/03/2026'), return it as a yyyy-mm-dd string in NZ time. Use 4-digit year. If unclear or absent, return null. Don't guess.",
  "tasks": [
    {
      "taskNumber": "string — 'Task 1', 'Task 2'...",
      "scenario": "string — 1-2 sentence summary of the scenario or case (NOT a verbatim copy)",
      "subQuestions": ["string — each sub-question (a, b, c, d) as a single line"],
      "conceptsRequired": ["string — explicit theories/models named, e.g. 'Atkinson-Shiffrin model of memory (1968)'"],
      "searchableQueries": ["string — 3-5 SHORT (5-15 word) scholarly-search phrases for THIS task. Must read like research queries (e.g. 'Bandura social learning theory', 'operant conditioning language acquisition'), NOT task instructions ('select three subfields') or formatting ('include APA citations')."],
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
  "sourceTypesNeeded": ["string"],
  "researchKeywords": ["string"],
  "warnings": ["string — anything ambiguous, missing or that the student should clarify with their tutor"]
}

Hard rules:
- NZ English (organise, behaviour, analyse, colour, recognise, programme).
- Do NOT use the Oxford comma.
- If multiple numbered tasks exist, populate the "tasks" array with one object per task.
- "totalWordCount" is the SUM of per-task wordCountGuideline values, or null if neither is given.
- For Mātauranga Māori topics (Te Whare Tapa Whā, Fonofale, marae, karakia, whānau, hauora), recommend NZ sources only: Te Whatu Ora / Ministry of Health, Mai Journal, AlterNative: An International Journal of Indigenous Peoples, Open Polytech library Māori health resources, Durie's Whaiora and Te Pae Mahutonga.
- Address the student in second person ("you").`;

// Format a course code (e.g. "73195" or "PSY 108") into a stable
// uppercase no-spaces form for matching against existing courses.
function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

interface QuickImportResult {
  assignmentId: Id<"assignments">;
  courseId: Id<"courses"> | null;
  analysisId: Id<"analyses">;
  courseCode: string | null;
  assessmentNumber: string | null;
  taskCount: number;
  weightingPercent: number | null;
  isNewCourse: boolean;
  dueDateDetected: boolean;
}

// Pick the next unused colour from the palette so each new course is
// visually distinct from the existing ones. Falls back to the first
// colour if the user already has 6+ courses (and so all colours are
// used) — duplicates are fine at that point.
function pickCourseColour(existingColours: (string | undefined | null)[]): string {
  const ORDER = ["sky", "emerald", "amber", "rose", "violet", "slate"];
  const used = new Set(existingColours.filter((c): c is string => !!c));
  for (const c of ORDER) {
    if (!used.has(c)) return c;
  }
  return ORDER[0];
}

// Parse the AI's "yyyy-mm-dd" due-date string into an epoch-ms timestamp
// at 23:59 NZ time on that day. Returns undefined if invalid.
function parseDueDateIso(iso: string | null | undefined): number | undefined {
  if (!iso || typeof iso !== "string") return undefined;
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2024 || y > 2030 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  // Treat as local NZ time at end of day so a "due Friday" doesn't go
  // overdue at midnight. The Convex server runs in UTC; local Date
  // construction here approximates NZ but the action runs server-side
  // so we treat the date as a wall-clock day, end of NZ-ish.
  const ts = new Date(y, mo - 1, d, 23, 59, 0).getTime();
  return Number.isFinite(ts) ? ts : undefined;
}

export const importBrief = action({
  args: {
    text: v.string(),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<QuickImportResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const trimmed = args.text.trim();
    if (trimmed.length < 100) {
      throw new Error(
        "That doesn't look like a full assignment brief. Try pasting more of the document.",
      );
    }
    if (trimmed.length > 14000) {
      throw new Error(
        "Brief is too long — trim to under 14,000 characters or just keep the first few pages.",
      );
    }

    // Quota gate (rate limit + spend cap)
    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const model = "deepseek/deepseek-v4-flash";
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model,
      responseFormatJson: true,
      temperature: 0.2,
      // 5-task NZ Open Polytech briefs (with scenario + subQuestions +
      // searchableQueries + outline + suggestedSources per task PLUS
      // top-level fields) routinely exceed 6000 tokens. Bumped to 12000
      // so we don't truncate mid-JSON. V4 Flash's 1M context handles
      // this fine cost-wise; output tokens are the variable.
      maxTokens: 12000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `ASSIGNMENT BRIEF:\n${trimmed}` },
      ],
    });

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "quickImport.importBrief",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    let result: {
      courseCode?: string | null;
      courseName?: string | null;
      assessmentNumber?: string | null;
      weightingPercent?: number | null;
      totalMarks?: number | null;
      totalWordCount?: number | null;
      dueDateIso?: string | null;
      tasks?: { wordCountGuideline?: number | null }[];
    };
    try {
      result = safeJsonParse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // The most common parse failure is truncation from hitting the
      // output token limit on a long brief. Give the user a concrete
      // workaround instead of the raw "Unterminated string" parser
      // error from JSON.parse.
      if (
        msg.includes("Unterminated") ||
        msg.includes("Unexpected end") ||
        msg.includes("position")
      ) {
        throw new Error(
          "The brief was so long that the AI's response got cut off mid-output. Try trimming the brief to just the assignment instructions (drop the marking schedule and any title-page boilerplate) and re-import.",
        );
      }
      throw err;
    }

    // ---- Find or create the course --------------------------------------
    // Use the existing public courses CRUD — actions inherit the user's
    // auth context so the mutations' getAuthUserId works correctly.
    let courseId: Id<"courses"> | null = null;
    let isNewCourse = false;
    if (result.courseCode) {
      const wantedCode = normaliseCode(result.courseCode);
      const existingCourses = (await ctx.runQuery(api.courses.list, {})) as {
        _id: Id<"courses">;
        code: string;
        colour?: string;
      }[];
      const match = existingCourses.find(
        (c) => normaliseCode(c.code) === wantedCode,
      );
      if (match) {
        courseId = match._id;
      } else {
        // Pick the next unused palette colour so this new course is
        // visually distinct from the existing ones.
        const colour = pickCourseColour(existingCourses.map((c) => c.colour));
        courseId = (await ctx.runMutation(api.courses.create, {
          code: result.courseCode,
          name: result.courseName ?? result.courseCode,
          colour,
        })) as Id<"courses">;
        isNewCourse = true;
      }
    }

    // ---- Compute a sensible assignment name + word count target --------
    const namePieces: string[] = [];
    if (result.assessmentNumber) namePieces.push(result.assessmentNumber);
    if (!result.assessmentNumber && result.courseCode) namePieces.push("Imported brief");
    if (namePieces.length === 0) namePieces.push("Imported assignment");
    const assignmentName = namePieces.join(" ");

    // Word count target: prefer explicit totalWordCount, else sum of task
    // guidelines, else null.
    let wordCountTarget: number | null = null;
    if (typeof result.totalWordCount === "number" && result.totalWordCount > 0) {
      wordCountTarget = result.totalWordCount;
    } else if (Array.isArray(result.tasks)) {
      const sum = result.tasks.reduce(
        (acc, t) => acc + (typeof t.wordCountGuideline === "number" ? t.wordCountGuideline : 0),
        0,
      );
      if (sum > 0) wordCountTarget = sum;
    }

    // ---- Parse due date if the AI extracted one ------------------------
    const dueDate = parseDueDateIso(result.dueDateIso);

    // ---- Create the assignment -----------------------------------------
    const assignmentId = (await ctx.runMutation(api.assignments.create, {
      name: assignmentName,
      courseCode: result.courseCode ?? undefined,
      courseId: courseId ?? undefined,
      wordCountTarget: wordCountTarget ?? undefined,
      brief: trimmed,
      dueDate,
    })) as Id<"assignments">;

    // ---- Save the analysis row attached to the new assignment ----------
    const analysisId = await ctx.runMutation(
      internal.analysisStore._saveResult,
      {
        userId,
        assignmentId,
        brief: trimmed,
        rubric: undefined,
        wordCountTarget: wordCountTarget ?? undefined,
        result,
        modelUsed,
      },
    );

    return {
      assignmentId,
      courseId,
      analysisId,
      courseCode: result.courseCode ?? null,
      assessmentNumber: result.assessmentNumber ?? null,
      taskCount: result.tasks?.length ?? 0,
      weightingPercent: result.weightingPercent ?? null,
      isNewCourse,
      dueDateDetected: dueDate !== undefined,
    };
  },
});
