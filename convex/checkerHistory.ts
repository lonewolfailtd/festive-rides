import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// History for the AI checker. Stores scores and projections only — never
// the draft text. Written by the aiChecker actions after each run.

export const record = internalMutation({
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("single"), v.literal("consensus")),
    model: v.string(),
    overallScore: v.number(),
    verdict: v.string(),
    words: v.optional(v.number()),
    draftText: v.optional(v.string()),
    turnitinProjected: v.optional(v.number()),
    turnitinDisplay: v.optional(v.string()),
    falsePositiveRisk: v.optional(v.string()),
    spread: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("checkerRuns", args);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("checkerRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);
  },
});

// Ground-truth calibration: compare past projections against the real
// Turnitin scores the student later logged, and report the systematic
// bias so the current projection can be corrected. Closes the loop the
// "Got the real report?" field opens.
export const calibrationStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const runs = await ctx.db
      .query("checkerRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Pairs where we have both a projection and the real reported score.
    const pairs = runs.filter(
      (r) =>
        typeof r.turnitinProjected === "number" &&
        typeof r.actualTurnitinScore === "number",
    );
    if (pairs.length === 0) return { count: 0 } as const;

    // Signed error = actual - projected. Positive mean => we under-project
    // (real Turnitin runs higher than we say); negative => we over-project.
    const errors = pairs.map(
      (r) => (r.actualTurnitinScore as number) - (r.turnitinProjected as number),
    );
    const meanError =
      errors.reduce((a, b) => a + b, 0) / errors.length;
    const mae =
      errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;

    return {
      count: pairs.length,
      // Round to whole points — false precision helps no one.
      bias: Math.round(meanError),
      meanAbsoluteError: Math.round(mae),
    } as const;
  },
});

// The student records what Turnitin actually showed once the marked
// report comes back — the ground truth for tuning the projection.
export const setActualScore = mutation({
  args: {
    runId: v.id("checkerRuns"),
    actualTurnitinScore: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== userId) throw new Error("Run not found");
    const score = Math.max(0, Math.min(100, args.actualTurnitinScore));
    await ctx.db.patch(args.runId, { actualTurnitinScore: score });
  },
});

export const remove = mutation({
  args: { runId: v.id("checkerRuns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== userId) throw new Error("Run not found");
    await ctx.db.delete(args.runId);
  },
});
