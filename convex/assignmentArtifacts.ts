import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

// Internal: store (or replace) a tool's latest digest for an assignment.
// Called by the tool actions after they produce a result, only when the
// student ran the tool against an active assignment. Keeps exactly one
// row per (user, assignment, tool) so the tutor context stays compact.
export const record = internalMutation({
  args: {
    userId: v.id("users"),
    assignmentId: v.id("assignments"),
    tool: v.string(),
    title: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    // Defensive: only attach to an assignment the user owns.
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.userId !== args.userId) return;

    const summary = args.summary.trim().slice(0, 4000);
    if (!summary) return;

    const existing = await ctx.db
      .query("assignmentArtifacts")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", args.userId).eq("assignmentId", args.assignmentId),
      )
      .collect();
    const sameTool = existing.find((a) => a.tool === args.tool);
    if (sameTool) {
      await ctx.db.patch(sameTool._id, { title: args.title, summary });
    } else {
      await ctx.db.insert("assignmentArtifacts", {
        userId: args.userId,
        assignmentId: args.assignmentId,
        tool: args.tool,
        title: args.title,
        summary,
      });
    }
  },
});

// What the tutor (and the dashboard, if we surface it) reads.
export const listForAssignment = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("assignmentArtifacts")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
  },
});

// Let the student forget a tool's saved output for an assignment.
export const remove = mutation({
  args: { id: v.id("assignmentArtifacts") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
