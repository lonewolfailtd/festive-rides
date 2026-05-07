import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export const listForAssignment = query({
  args: { assignmentId: v.optional(v.id("assignments")) },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    if (assignmentId === undefined) {
      return await ctx.db
        .query("references")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }
    return await ctx.db
      .query("references")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId)
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("references") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const r = await ctx.db.get(id);
    if (!r || r.userId !== userId) return null;
    return r;
  },
});

export const create = mutation({
  args: {
    assignmentId: v.optional(v.id("assignments")),
    sourceType: v.string(),
    fields: v.any(),
    formatted: v.optional(v.string()),
    inTextShort: v.optional(v.string()),
    inTextNarrative: v.optional(v.string()),
    sortKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    annotation: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("references", { userId, ...args });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "reference.create",
      entityType: "reference",
      entityId: id.toString(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("references"),
    assignmentId: v.optional(v.id("assignments")),
    sourceType: v.optional(v.string()),
    fields: v.optional(v.any()),
    formatted: v.optional(v.string()),
    inTextShort: v.optional(v.string()),
    inTextNarrative: v.optional(v.string()),
    sortKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    annotation: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "reference.update",
      entityType: "reference",
      entityId: id.toString(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("references") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    // Log BEFORE deletion so we still have the data.
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "reference.delete",
      entityType: "reference",
      entityId: id.toString(),
      details: JSON.stringify({
        sourceType: existing.sourceType,
        formatted: existing.formatted,
      }),
    });
    await ctx.db.delete(id);
  },
});
