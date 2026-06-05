"use node";

// Marker-Feedback Memory — reads the marker feedback the student has saved
// across all their assignments and surfaces the RECURRING themes, so one-off
// comments become a personal improvement loop.
//
// Why: real markers say the same things repeatedly ("a little more depth",
// "include a narrative citation", "watch your APA"). A student who has lost
// marks on narrative citations twice should be told that explicitly, before
// the next assignment, not left to notice the pattern themselves.
//
// Feedback is captured on the assignment itself (assignments.markerFeedback,
// set via the grade tracker). This action just analyses what's already there.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an academic mentor for an Open Polytechnic of New Zealand student. You are given the marker feedback from several of their past assignments. Find the RECURRING patterns — the things that come up again and again — so the student knows exactly what to focus on next time.

Output ONLY valid JSON (no markdown):
{
  "summary": "string — 2-3 sentences. The single most important throughline across their feedback. Honest and encouraging.",
  "patterns": [
    {
      "theme": "string — short label, e.g. 'Missing narrative citations', 'Needs more depth/analysis', 'APA reference formatting'",
      "severity": "recurring" | "occasional" | "one-off",
      "occurrences": ["string — the assignment names where this showed up"],
      "whatMarkersSaid": "string — paraphrase the feedback (don't quote verbatim if it's long)",
      "fixNextTime": "string — concrete, actionable advice for the next assignment. Directional — what to DO, not generic praise."
    }
  ],
  "topFocus": ["string — the 2-3 highest-impact things to fix next time, ordered. Each one line."],
  "strengths": ["string — what they consistently do WELL, so they keep doing it. Markers note these too."]
}

Rules:
- Rank patterns by how often they recur and how many marks they likely cost. 'recurring' = 3+ assignments, 'occasional' = 2, 'one-off' = 1 but notable.
- Be specific and kind. The point is forward motion, not a scolding.
- NZ English. No Oxford commas.
- If there's only one assignment's feedback, still extract its themes but mark them 'one-off' and say more data will sharpen the picture.`;

export const analysePatterns = action({
  args: { model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    // Pull the student's assignments (auth propagates through runQuery) and
    // keep only those with saved marker feedback. The explicit Doc[] type
    // annotation is load-bearing: without it, the action's inferred return
    // type references `api` (which includes this action) and TS reports a
    // circular-reference error.
    const assignments: Doc<"assignments">[] = await ctx.runQuery(
      api.assignments.list,
      {},
    );
    const withFeedback = assignments.filter(
      (a) => typeof a.markerFeedback === "string" && a.markerFeedback.trim().length > 0,
    );

    if (withFeedback.length === 0) {
      throw new Error(
        "No marker feedback saved yet. Add the marker's comments to an assignment (in the grade tracker) first — then this finds your patterns.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    const blocks = withFeedback
      .map((a) => {
        const grade =
          typeof a.grade === "number"
            ? ` (grade: ${a.grade}%${a.gradeLetter ? `, ${a.gradeLetter}` : ""})`
            : a.gradeLetter
              ? ` (grade: ${a.gradeLetter})`
              : "";
        return `=== ${a.name}${grade} ===\n${a.markerFeedback!.trim()}`;
      })
      .join("\n\n");

    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model: args.model ?? "google/gemini-2.5-flash",
      responseFormatJson: true,
      temperature: 0.3,
      maxTokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the marker feedback from ${withFeedback.length} assignment${withFeedback.length === 1 ? "" : "s"}. Find the recurring patterns.\n\n${blocks}`,
        },
      ],
    });

    const parsed = safeJsonParse(raw);

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "feedbackMemory.analysePatterns",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return { result: parsed, assignmentsAnalysed: withFeedback.length };
  },
});
