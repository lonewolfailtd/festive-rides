import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Wrap an action handler so any thrown error is recorded to errorLog
// (best-effort) before being rethrown. Usage:
//   handler: logErrors("coach.coach", async (ctx, args) => { ... })
// Keeps behaviour identical — the error still propagates to the client
// unchanged, it's just also persisted. Generic over the whole handler
// type so the wrapped handler keeps the exact signature action() expects;
// ctx/args are `any` only inside this helper, not in the handlers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logErrors<H extends (ctx: any, args: any) => Promise<unknown>>(
  action: string,
  handler: H,
): H {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = async (ctx: any, args: any) => {
    try {
      return await handler(ctx, args);
    } catch (err) {
      try {
        let userId: string | undefined;
        try {
          userId = (await getAuthUserId(ctx)) ?? undefined;
        } catch {
          userId = undefined;
        }
        await ctx.runMutation(internal.errorLog.record, {
          userId,
          action,
          message: err instanceof Error ? err.message : String(err),
        });
      } catch {
        // Logging must never mask the original error.
      }
      throw err;
    }
  };
  return wrapped as H;
}

// Durable capture of uni-tool failures. The AI actions call record() in
// their catch path before rethrowing, so a failure outlives the rolling
// Convex log buffer.

export const record = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    action: v.string(),
    message: v.string(),
    model: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("errorLog", {
      userId: args.userId,
      action: args.action,
      message: args.message.slice(0, 2000),
      model: args.model,
      context: args.context?.slice(0, 1000),
    });
  },
});

// Recent failures for the signed-in user, newest first. Lets the app (or
// a maintainer) review what's been going wrong.
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("errorLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});
