import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserId(ctx: { auth: { getUserIdentity: () => Promise<unknown> } } | Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx as Parameters<typeof getAuthUserId>[0]);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("assignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const a = await ctx.db.get(id);
    if (!a || a.userId !== userId) return null;
    return a;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    courseCode: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await ctx.db.insert("assignments", { userId, ...args });
  },
});

export const update = mutation({
  args: {
    id: v.id("assignments"),
    name: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
