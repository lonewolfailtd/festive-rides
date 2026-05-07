import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export const list = query({
  args: { assignmentId: v.optional(v.id("assignments")) },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    if (assignmentId === undefined) {
      return await ctx.db
        .query("analyses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("analyses")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId)
      )
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("analyses") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const a = await ctx.db.get(id);
    if (!a || a.userId !== userId) return null;
    return a;
  },
});

export const remove = mutation({
  args: { id: v.id("analyses") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});

// Toggle a single bullet in the outline checked-state array.
export const toggleBullet = mutation({
  args: {
    id: v.id("analyses"),
    bulletKey: v.string(), // "<sectionIdx>:<bulletIdx>"
  },
  handler: async (ctx, { id, bulletKey }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    const checked = new Set(existing.checkedBullets ?? []);
    if (checked.has(bulletKey)) checked.delete(bulletKey);
    else checked.add(bulletKey);
    await ctx.db.patch(id, { checkedBullets: Array.from(checked) });
  },
});

// Patch top-level fields (notes, assignmentId reassignment, result tweaks).
export const update = mutation({
  args: {
    id: v.id("analyses"),
    assignmentId: v.optional(v.id("assignments")),
    notes: v.optional(v.string()),
    result: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
  },
});

// Internal helpers for the analyser action's iterate flow.
export const _getInternal = internalQuery({
  args: { id: v.id("analyses"), userId: v.id("users") },
  handler: async (ctx, { id, userId }) => {
    const a = await ctx.db.get(id);
    if (!a || a.userId !== userId) return null;
    return a;
  },
});

export const _patchResult = internalMutation({
  args: {
    id: v.id("analyses"),
    userId: v.id("users"),
    result: v.any(),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, { id, userId, result, modelUsed }) => {
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { result, modelUsed });
  },
});

// Internal save called from the analyser action after a successful AI run.
export const _saveResult = internalMutation({
  args: {
    userId: v.id("users"),
    assignmentId: v.optional(v.id("assignments")),
    brief: v.string(),
    rubric: v.optional(v.string()),
    wordCountTarget: v.optional(v.number()),
    result: v.any(),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analyses", {
      userId: args.userId,
      assignmentId: args.assignmentId,
      brief: args.brief,
      rubric: args.rubric,
      wordCountTarget: args.wordCountTarget,
      result: args.result,
      modelUsed: args.modelUsed,
      checkedBullets: [],
    });
  },
});
