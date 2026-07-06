"use node";

// Research-Question Builder — helps a student turn a "future direction" into
// a specific, testable research question. A recurring Open Polytechnic task
// (e.g. the Task 2C that a real student scored 0/10 on by not attempting it).
//
// Hard product principle: this NEVER writes the student's final research
// question. It scaffolds — decomposes the components, gives a fill-in-the-
// blank frame, critiques their own attempt, and runs a self-check against
// the rubric words (specific, clear, testable, well-structured). The student
// writes the question.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";
import { logErrors } from "./errorLog";

const SYSTEM_PROMPT = `You are coaching an Open Polytechnic of New Zealand student to write their OWN research question, based on a "future direction" they (or an article) identified. You must NOT write the finished question for them — you scaffold their thinking so they can write it themselves.

Output ONLY valid JSON (no markdown):
{
  "componentsToDefine": [
    {
      "component": "string — e.g. 'Population / participants', 'Independent variable', 'Dependent variable / outcome', 'Context or setting'",
      "prompt": "string — a question that helps the student decide this component for THEIR question. Do not answer it for them."
    }
  ],
  "frame": "string — a fill-in-the-blank TEMPLATE with [bracketed placeholders], e.g. 'To what extent does [independent variable] affect [outcome] among [population] in [context]?'. Give the STRUCTURE only — the brackets stay empty for the student to fill.",
  "frameOptions": ["string — 2-3 alternative question STRUCTURES (still bracketed templates), each suited to a different study type: correlational, experimental, comparative. Structure only, never filled in."],
  "selfCheck": [
    { "criterion": "Specific", "ask": "string — a yes/no question the student asks of their drafted question to test this" },
    { "criterion": "Testable", "ask": "string" },
    { "criterion": "Clear", "ask": "string" },
    { "criterion": "Well-structured", "ask": "string" },
    { "criterion": "Relevant to the future direction", "ask": "string" }
  ],
  "critique": {
    "hasDraft": boolean,
    "strengths": ["string — only if the student pasted a draft question; else empty"],
    "issues": ["string — vague/untestable/too-broad problems with their draft, DIRECTIONAL. Empty if no draft."],
    "directionToFix": "string — how to tighten their draft, without writing the fixed version. Empty string if no draft."
  },
  "pitfalls": ["string — common ways students write weak research questions for this kind of task"]
}

Rules:
- NEVER produce a complete, usable research question. Templates must keep [bracketed placeholders] empty.
- If the student pasted their own draft question, critique it (set hasDraft true) but still do not rewrite it for them — give direction.
- Concrete over abstract. Calibrate for an undergraduate.
- NZ English. No Oxford commas.`;

export const build = action({
  args: {
    futureDirection: v.string(),
    draftQuestion: v.optional(v.string()),
    articleContext: v.optional(v.string()),
    model: v.optional(v.string()),
    assignmentId: v.optional(v.id("assignments")),
  },
  handler: logErrors("researchQuestion.build", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const fd = args.futureDirection.trim();
    if (fd.length < 15) {
      throw new Error(
        "Describe the future direction your question should build on (at least 15 characters).",
      );
    }
    if (fd.length > 4000) {
      throw new Error("That's very long — paste just the future direction and any key context.");
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const parts: string[] = [`=== FUTURE DIRECTION TO BUILD ON ===\n${fd}`];
    if (args.articleContext?.trim()) {
      const c = args.articleContext.trim();
      parts.push(`=== ARTICLE / TOPIC CONTEXT (grounding only) ===\n${c.slice(0, 4000)}`);
    }
    if (args.draftQuestion?.trim()) {
      parts.push(`=== THE STUDENT'S DRAFT QUESTION (critique this, do not rewrite it) ===\n${args.draftQuestion.trim()}`);
    }
    parts.push(
      "Scaffold the student to write their own research question. Decompose the components, give bracketed template frames, a self-check, and critique their draft if present. Never write the finished question.",
    );

    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model: args.model ?? "google/gemini-2.5-flash",
      responseFormatJson: true,
      temperature: 0.4,
      maxTokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parts.join("\n\n") },
      ],
    });

    const parsed = safeJsonParse(raw);

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "researchQuestion.build",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    if (args.assignmentId) {
      try {
        const r = (parsed ?? {}) as {
          componentsToDefine?: { component?: string; prompt?: string }[];
          frame?: string;
          frameOptions?: string[];
          selfCheck?: { criterion?: string; ask?: string }[];
          critique?: {
            hasDraft?: boolean;
            strengths?: string[];
            issues?: string[];
            directionToFix?: string;
          };
        };

        const lines: string[] = [];
        lines.push(`Future direction: ${fd}`);

        if (args.draftQuestion?.trim()) {
          lines.push(`Student draft question: ${args.draftQuestion.trim()}`);
        }

        if (r.componentsToDefine?.length) {
          lines.push(
            "Question parts to define: " +
              r.componentsToDefine
                .map((c) => c?.component)
                .filter(Boolean)
                .join("; "),
          );
        }

        if (r.frame) lines.push(`Main frame: ${r.frame}`);
        if (r.frameOptions?.length) {
          lines.push("Alternative frames: " + r.frameOptions.filter(Boolean).join(" | "));
        }

        if (r.selfCheck?.length) {
          lines.push(
            "Rubric self-check (specific, clear, testable, well-structured): " +
              r.selfCheck
                .map((c) => (c?.criterion ? `${c.criterion} - ${c.ask ?? ""}`.trim() : ""))
                .filter(Boolean)
                .join("; "),
          );
        }

        if (r.critique?.hasDraft) {
          if (r.critique.strengths?.length) {
            lines.push("Draft strengths: " + r.critique.strengths.filter(Boolean).join("; "));
          }
          if (r.critique.issues?.length) {
            lines.push("Draft issues to tighten: " + r.critique.issues.filter(Boolean).join("; "));
          }
          if (r.critique.directionToFix) {
            lines.push(`Direction to fix the draft: ${r.critique.directionToFix}`);
          }
        }

        const summary = lines.join("\n").slice(0, 1500);

        await ctx.runMutation(internal.assignmentArtifacts.record, {
          userId,
          assignmentId: args.assignmentId,
          tool: "researchQuestion",
          title: "Research Question Builder",
          summary,
        });
      } catch {
        // Digest is best-effort; never fail the build over memory write.
      }
    }

    return parsed;
  }),
});
