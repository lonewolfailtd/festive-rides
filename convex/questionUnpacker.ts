"use node";

// Question Unpacker — given a single assignment question (plus optional
// brief/course context), return a structured "how to think about this"
// scaffold. Sits between Assignment Analyser (whole-brief planner) and
// Article Q&A / Coach (later-stage tools): the moment when the student
// has read the question and is asking themselves "where do I even
// start?".
//
// Hard product principle: NEVER drafts the student's answer. Output is
// scaffolding to help them think — command-word decode, scope, hidden
// assumptions, approach options with trade-offs, sources to find,
// Socratic prompts. Stops short of an outline on purpose. If the
// student wants an outline, that's what the Assignment Analyser is for.
//
// Two actions exposed:
//   - extractTasks({ briefText }) — Flash-tier task: list the discrete
//     tasks/questions in a pasted brief. Reused from Article Q&A
//     pattern but slimmed: we only need the task list here, not
//     per-task questions.
//   - unpack({ question, briefContext?, courseContext? }) — Pro-tier
//     task: the actual decode. Worth the premium model because the
//     output drives how the student spends hours of effort.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";
import { logErrors } from "./errorLog";

// =============================================================
// extractTasks — Flash-tier
// =============================================================

const EXTRACT_TASKS_PROMPT = `You are reading an Open Polytechnic NZ assignment brief. Identify every distinct task or question the student needs to complete.

Return JSON in this exact shape (no markdown):
{
  "tasks": [
    {
      "label": "string — short identifier the student will see in a picker, e.g. 'Task 1: Critique the research article' or 'Question 3a'. Keep under 80 chars.",
      "fullText": "string — the VERBATIM question text from the brief, including any scenario or context paragraph that introduces it. This is what gets unpacked, so include enough that the unpacker doesn't need the rest of the brief."
    }
  ]
}

Rules:
- Each task should be self-contained when read alone.
- If a task has multiple sub-questions ("a", "b", "c"), list each sub-question as its own task — the student picks one to unpack at a time.
- If the brief includes a scenario paragraph that applies to several questions, REPEAT it in each task's fullText so each one stands alone.
- Skip formatting/admin instructions ("submit as Word doc", "use APA 7", "word limit 1500").
- Use NZ English. No Oxford commas.
- If you can't find any tasks, return { "tasks": [] }.`;

export const extractTasks = action({
  args: {
    briefText: v.string(),
  },
  handler: logErrors("questionUnpacker.extractTasks", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const brief = args.briefText.trim();
    if (brief.length < 100) {
      throw new Error(
        "Assignment brief is too short — please paste at least 100 characters of the brief.",
      );
    }
    // Hard cap rather than silently truncating — a sliced brief loses
    // tasks off the end and the student never finds out.
    if (brief.length > 30000) {
      throw new Error(
        "Assignment brief is too long (>30000 chars). Trim to just the assessment you're working on and try again.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const r = await callOpenRouterDetailed({
      model: "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.1,
      maxTokens: 4000,
      messages: [
        { role: "system", content: EXTRACT_TASKS_PROMPT },
        {
          role: "user",
          content: `=== ASSIGNMENT BRIEF ===\n${brief}\n\nList every distinct task or sub-question.`,
        },
      ],
    });

    if (!r.content || !r.content.trim()) {
      throw new Error(
        "Couldn't extract tasks — the AI returned an empty response. Try again or paste a question manually.",
      );
    }

    const parsed = safeJsonParse(r.content) as {
      tasks?: Array<{ label?: string; fullText?: string }>;
    };

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "questionUnpacker.extractTasks",
      model: r.modelUsed,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
    });

    // Filter out malformed entries before returning.
    const tasks = (parsed.tasks ?? [])
      .map((t) => ({
        label: (t.label ?? "").trim(),
        fullText: (t.fullText ?? "").trim(),
      }))
      .filter((t) => t.label.length > 0 && t.fullText.length > 0);

    return { tasks };
  }),
});

// =============================================================
// unpack — Pro-tier (Gemini 2.5 Pro)
// =============================================================

const UNPACK_SYSTEM_PROMPT = `You are coaching an Open Polytechnic NZ student through a single assignment question. They have read the question; they are stuck on "where do I even start?". Your job is to help them THINK about the question — not to answer it, not to outline an essay, not to write any sentences they could paste.

OUTPUT (JSON, no markdown):
{
  "plainEnglish": {
    "inPlainWords": "string — 2-3 sentences. Re-state the WHOLE question in plain, everyday language, as if explaining it to a friend who has not done the course. Strip ALL academic jargon. Start with 'This question is asking you to...'. This is for a student who read the question and genuinely did not understand what it wants.",
    "jargonTerms": [
      {
        "term": "string — a word or phrase IN THE QUESTION that a confused student might not understand (academic, technical, or discipline jargon)",
        "meaning": "string — a simple, everyday-language definition. 1 sentence. No jargon used to explain jargon."
      }
    ],
    "steps": [
      "string — the question broken into the concrete things the student must PRODUCE, in order. Each step is one deliverable, e.g. 'Describe Erikson's theory in your own words' or 'Give one real-life example of the theory'. DIRECTIONAL only — say WHAT to produce, never write it for them. 3-6 steps."
    ]
  },
  "commandWord": {
    "verb": "string — the primary command verb identified ('analyse', 'discuss', 'evaluate', 'compare', 'explain', 'critique', etc). Use NZ English spelling.",
    "meaning": "string — 1-2 sentences explaining what this verb means in academic writing at Bachelor level. Concrete, not abstract.",
    "markerImplication": "string — 1-2 sentences on what a marker is looking for when they see this verb. What separates a high mark from a low mark on this command."
  },
  "scopeAndTopic": {
    "topic": "string — what the question is actually about, in plain English. One sentence.",
    "inScope": ["string — concrete things this question IS asking you to address"],
    "outOfScope": ["string — common scope-creep traps. Things students often write about that are tangentially related but waste word count"]
  },
  "hiddenAssumptions": [
    {
      "assumption": "string — a concept, term, or framework the question takes for granted that the student must define or unpack BEFORE they can answer well",
      "whyItMatters": "string — 1 sentence on why ignoring this assumption produces a weak answer"
    }
  ],
  "approachOptions": [
    {
      "name": "string — short label, e.g. 'Compare two theories', 'Case-study one in depth', 'Chronological development'",
      "howItWorks": "string — 2-3 sentences describing the approach without writing any of the actual answer",
      "strengths": ["string — short bullet points"],
      "tradeOffs": ["string — short bullet points on what's harder about this approach"]
    }
  ],
  "evidenceNeeded": {
    "sourceTypes": ["string — what kinds of sources you need (peer-reviewed empirical studies, theoretical/conceptual papers, NZ government reports, etc)"],
    "specificEvidence": ["string — concrete kinds of evidence the answer should rest on: numbers, case studies, named theories, comparative data"],
    "searchQueries": ["string — 4-6 short scholarly-database search queries (5-12 words each) the student can run on Source Finder. Vary the angles."]
  },
  "socraticPrompts": [
    "string — open-ended question the student should sit with BEFORE writing. The point is to surface their own position. 4-6 of these."
  ],
  "warningFlags": [
    "string — common ways students fluff this question or lose marks. Empty array if none stand out."
  ]
}

NON-NEGOTIABLE RULES:

1. NEVER WRITE THE ANSWER. No thesis statements. No topic sentences. No paragraph drafts. No "you could argue that..." with a position attached. If you find yourself writing prose the student could paste, STOP — that violates the tool's purpose. This applies to plainEnglish.steps too: "Describe the theory" is fine; describing the theory for them is not.

0. PLAIN ENGLISH FIRST. The plainEnglish block is for a student who is stuck on COMPREHENSION — they don't yet understand what the question is even asking. Write it at the reading level of a first-year student who finds academic phrasing intimidating. Short sentences. Everyday words. The 'inPlainWords' restatement and 'steps' checklist must make a confused student go "oh — THAT'S all it wants". Only list jargonTerms that actually appear in the question and could genuinely confuse someone; if the question has no real jargon, return an empty array.

2. NO OUTLINES. We deliberately do NOT produce a section-by-section outline. The Assignment Analyser does that. The Question Unpacker stops at "here is how to think about this" so the student keeps ownership of structure.

3. SCAFFOLD, DON'T SCRIPT. Approach options describe HOW you could attack the question — not WHAT you'd say. "You could compare Theory A and Theory B" is fine. "Theory A is better than Theory B because X" is forbidden.

4. CONCRETE OVER ABSTRACT. "Define what 'effective' means in this context" beats "consider the scope of the question". The student should be able to act on every item.

5. NZ ENGLISH. -ise / -our / -re spellings. NO Oxford commas. Use 'whānau', 'Māori', 'Pākehā' with macrons where relevant. Open Polytech house style.

6. STAY ON THE QUESTION. If a brief context paragraph is provided, use it to ground your answer in the right discipline — but don't drift to unpack the WHOLE assignment. Unpack THIS question.

7. CALIBRATE FOR BACHELOR LEVEL. The student is undergraduate. Don't assume PhD-level priors. But don't talk down either — explain hidden assumptions clearly, name the framework, and trust them to look up the rest.

8. APPROACH OPTIONS: aim for 2-3. More than 3 dilutes the choice. Each should be genuinely different in shape, not paraphrases of each other.

9. SOCRATIC PROMPTS must be questions the student can actually answer from their own thinking before doing research. "What do YOU think 'effective' means here?" beats "What does the literature say about effectiveness?"`;

export const unpack = action({
  args: {
    question: v.string(),
    briefContext: v.optional(v.string()),
    courseContext: v.optional(v.string()),
    model: v.optional(v.string()),
    assignmentId: v.optional(v.id("assignments")),
  },
  handler: logErrors("questionUnpacker.unpack", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const question = args.question.trim();
    if (question.length < 15) {
      throw new Error(
        "The question is too short — please paste the full question including any scenario or context.",
      );
    }
    if (question.length > 6000) {
      throw new Error(
        "The question is unusually long (>6000 chars). Trim to just the question + immediate scenario.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Default to Gemini 2.5 Pro — this is high-stakes coaching output
    // that shapes hours of student work. Flash is a fallback if the
    // primary model errors. Both go through OpenRouter for billing.
    const primaryModel = args.model ?? "google/gemini-2.5-pro";

    const userParts: string[] = [];
    if (args.courseContext?.trim()) {
      userParts.push(`=== COURSE CONTEXT ===\n${args.courseContext.trim()}`);
    }
    if (args.briefContext?.trim()) {
      // Cap brief context — only here to ground the question, not be
      // unpacked itself.
      const ctxCapped =
        args.briefContext.trim().length > 8000
          ? args.briefContext.trim().slice(0, 8000)
          : args.briefContext.trim();
      userParts.push(`=== ASSIGNMENT CONTEXT (for grounding only — do NOT unpack the whole brief) ===\n${ctxCapped}`);
    }
    userParts.push(`=== THE QUESTION TO UNPACK ===\n${question}`);
    userParts.push(
      "Help the student understand this question. Decode the command word, define scope, surface hidden assumptions, give 2-3 approach options with trade-offs, list what evidence to find, and pose Socratic prompts they can sit with. Do NOT write any of the answer.",
    );

    let r;
    try {
      r = await callOpenRouterDetailed({
        model: primaryModel,
        responseFormatJson: true,
        temperature: 0.4,
        maxTokens: 8000,
        messages: [
          { role: "system", content: UNPACK_SYSTEM_PROMPT },
          { role: "user", content: userParts.join("\n\n") },
        ],
      });
    } catch (err) {
      // Fallback to Flash if Pro errors (rate limits, transient issues).
      const fallback =
        primaryModel === "google/gemini-2.5-pro"
          ? "google/gemini-2.5-flash"
          : "google/gemini-2.5-pro";
      r = await callOpenRouterDetailed({
        model: fallback,
        responseFormatJson: true,
        temperature: 0.4,
        maxTokens: 8000,
        messages: [
          { role: "system", content: UNPACK_SYSTEM_PROMPT },
          { role: "user", content: userParts.join("\n\n") },
        ],
      });
      // eslint-disable-next-line no-console
      console.warn(
        `Question Unpacker primary model ${primaryModel} failed, used fallback. Original error: ${(err as Error).message}`,
      );
    }

    if (!r.content || !r.content.trim()) {
      throw new Error(
        "The AI returned an empty response. Try again, or try a shorter version of the question.",
      );
    }

    const result = safeJsonParse(r.content);

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "questionUnpacker.unpack",
      model: r.modelUsed,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
    });

    // Save a compact digest into shared assignment memory so the
    // dashboard tutor chat can answer questions about this unpack.
    if (args.assignmentId) {
      try {
        const res = result as {
          commandWord?: { verb?: string; meaning?: string; markerImplication?: string };
          scopeAndTopic?: { topic?: string; inScope?: string[]; outOfScope?: string[] };
          approachOptions?: Array<{ name?: string; howItWorks?: string }>;
          evidenceNeeded?: { sourceTypes?: string[]; specificEvidence?: string[] };
        };

        const list = (xs?: string[]) =>
          (xs ?? []).map((s) => s.trim()).filter(Boolean).join("; ");

        const lines: string[] = [];
        lines.push(`Question unpacked: ${question}`);
        if (res.commandWord?.verb) {
          const cw = res.commandWord;
          lines.push(
            `Command word: "${cw.verb}" — ${(cw.meaning ?? "").trim()}${
              cw.markerImplication ? ` Marker wants: ${cw.markerImplication.trim()}` : ""
            }`,
          );
        }
        if (res.scopeAndTopic?.topic) {
          lines.push(`Topic: ${res.scopeAndTopic.topic.trim()}`);
        }
        const inScope = list(res.scopeAndTopic?.inScope);
        if (inScope) lines.push(`In scope: ${inScope}`);
        const outScope = list(res.scopeAndTopic?.outOfScope);
        if (outScope) lines.push(`Out of scope: ${outScope}`);
        const approaches = (res.approachOptions ?? [])
          .map((a) => {
            const name = (a.name ?? "").trim();
            const how = (a.howItWorks ?? "").trim();
            if (!name && !how) return "";
            return how ? `${name} (${how})` : name;
          })
          .filter(Boolean)
          .join("; ");
        if (approaches) lines.push(`Suggested approaches: ${approaches}`);
        const sourceTypes = list(res.evidenceNeeded?.sourceTypes);
        if (sourceTypes) lines.push(`Source types to find: ${sourceTypes}`);
        const specificEvidence = list(res.evidenceNeeded?.specificEvidence);
        if (specificEvidence) lines.push(`Key evidence to find: ${specificEvidence}`);

        let summary = lines.join("\n");
        if (summary.length > 1500) summary = summary.slice(0, 1497) + "...";

        await ctx.runMutation(internal.assignmentArtifacts.record, {
          userId,
          assignmentId: args.assignmentId,
          tool: "unpack",
          title: "Question Unpacker",
          summary,
        });
      } catch (err) {
        // Memory write is best-effort — never fail the unpack over it.
        // eslint-disable-next-line no-console
        console.warn(
          `Question Unpacker failed to save assignment digest: ${(err as Error).message}`,
        );
      }
    }

    return { result, modelUsed: r.modelUsed };
  }),
});
