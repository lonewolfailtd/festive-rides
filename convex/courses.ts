// Courses / papers — optional grouping layer for assignments. Lets the
// student tag every assignment with a course so the workspace bar can
// group "PSY108 essay 1, PSY108 essay 2" together once they're running
// more than one paper.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    const userId = await requireUserId(ctx);
    const all = await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (includeArchived) return all;
    return all.filter((c) => !c.archived);
  },
});

export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    colour: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("courses", { userId, ...args });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "course.create",
      entityType: "course",
      entityId: id.toString(),
      details: JSON.stringify({ code: args.code, name: args.name }),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("courses"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    colour: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "course.update",
      entityType: "course",
      entityId: id.toString(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    // Log BEFORE deletion so we still have the data.
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "course.delete",
      entityType: "course",
      entityId: id.toString(),
      details: JSON.stringify({ code: existing.code, name: existing.name }),
    });

    // Detach from any assignments that referenced it before deleting.
    const linked = await ctx.db
      .query("assignments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", id)
      )
      .collect();
    for (const a of linked) {
      await ctx.db.patch(a._id, { courseId: undefined });
    }
    await ctx.db.delete(id);
  },
});
