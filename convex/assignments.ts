import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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
    courseId: v.optional(v.id("courses")),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    rubric: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("assignments", { userId, ...args });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.create",
      entityType: "assignment",
      entityId: id.toString(),
      details: JSON.stringify({ name: args.name }),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("assignments"),
    name: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    rubric: v.optional(v.string()),
    notes: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    grade: v.optional(v.number()),
    gradeLetter: v.optional(v.string()),
    markerFeedback: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.update",
      entityType: "assignment",
      entityId: id.toString(),
    });
  },
});

// Mark assignment as submitted (default: now). Idempotent — calling it
// again just bumps the timestamp.
export const markSubmitted = mutation({
  args: { id: v.id("assignments"), submittedAt: v.optional(v.number()) },
  handler: async (ctx, { id, submittedAt }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { submittedAt: submittedAt ?? Date.now() });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.markSubmitted",
      entityType: "assignment",
      entityId: id.toString(),
    });
  },
});

export const unmarkSubmitted = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      submittedAt: undefined,
      grade: undefined,
      gradeLetter: undefined,
    });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.unmarkSubmitted",
      entityType: "assignment",
      entityId: id.toString(),
    });
  },
});

// Set or update the grade. Numeric grade is the source of truth for the
// dashboard chart; gradeLetter is free-form for things like "Pass / B+".
export const setGrade = mutation({
  args: {
    id: v.id("assignments"),
    grade: v.optional(v.number()),
    gradeLetter: v.optional(v.string()),
    markerFeedback: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    if (patch.grade !== undefined && (patch.grade < 0 || patch.grade > 100)) {
      throw new Error("Grade must be between 0 and 100");
    }
    await ctx.db.patch(id, patch);
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.setGrade",
      entityType: "assignment",
      entityId: id.toString(),
      details: JSON.stringify({
        grade: patch.grade,
        gradeLetter: patch.gradeLetter,
      }),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "assignment.delete",
      entityType: "assignment",
      entityId: id.toString(),
      details: JSON.stringify({ name: existing.name }),
    });
    await ctx.db.delete(id);
  },
});
