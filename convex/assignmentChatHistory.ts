import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  return userId;
}

// The visible conversation for an assignment, oldest first.
export const list = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("assignmentChatMessages")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
  },
});

export const clear = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("assignmentChatMessages")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});

// Internal: append one message. Called by the assignmentChat action for
// both the user turn and the assistant reply.
export const record = internalMutation({
  args: {
    userId: v.id("users"),
    assignmentId: v.id("assignments"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("assignmentChatMessages", args);
  },
});

// Internal: gather everything the tutor should know about this assignment.
// Reads are all ownership-scoped. Returns plain data the action turns into
// a system prompt — keeping the db reads here (a query) and the LLM call in
// the node action.
export const gatherContext = internalQuery({
  args: { userId: v.id("users"), assignmentId: v.id("assignments") },
  handler: async (ctx, { userId, assignmentId }) => {
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment || assignment.userId !== userId) {
      throw new Error("Assignment not found");
    }

    // Latest analyser outline for this assignment, if any.
    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
    const latestAnalysis = analyses.sort((a, b) => b._creationTime - a._creationTime)[0];

    const references = await ctx.db
      .query("references")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();

    // Recent conversation for continuity (last 16 turns).
    const allMessages = await ctx.db
      .query("assignmentChatMessages")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
    const history = allMessages.slice(-16).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return {
      assignment: {
        name: assignment.name,
        courseCode: assignment.courseCode,
        dueDate: assignment.dueDate,
        wordCountTarget: assignment.wordCountTarget,
        brief: assignment.brief,
        rubric: assignment.rubric,
        notes: assignment.notes,
        markerFeedback: assignment.markerFeedback,
        taskChecklist: assignment.taskChecklist,
        draftText: assignment.draftText,
        draftFileName: assignment.draftFileName,
      },
      outline: latestAnalysis?.result ?? null,
      references: references.map((r) => r.formatted).filter(Boolean) as string[],
      history,
    };
  },
});
