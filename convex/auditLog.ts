// Append-only audit log of state-changing actions. The `record` mutation
// is internal-only — it's called from other mutations after they've
// successfully applied a change (or before, for deletes, so we still
// have the data). The `myRecent` query lets the UI surface the last 50
// actions for the signed-in user.

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const DETAILS_MAX_LEN = 1000;

export const record = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const details =
      args.details !== undefined
        ? args.details.slice(0, DETAILS_MAX_LEN)
        : undefined;
    await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      details,
    });
  },
});

export const myRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("auditLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});
