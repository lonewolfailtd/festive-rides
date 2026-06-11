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
