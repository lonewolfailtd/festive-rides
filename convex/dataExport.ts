// Full per-user data dump for the Settings page export feature.
//
// Returned as a plain JSON-serialisable object so the client can stringify
// it into a Blob and trigger a download. Scoped to the authenticated user.

import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const user = await ctx.db.get(userId);
    const email = user ? (user as { email?: string }).email ?? null : null;

    const [assignments, courses, references, analyses, icalToken, profile] =
      await Promise.all([
        ctx.db
          .query("assignments")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("courses")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("references")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("analyses")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("icalTokens")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
        ctx.db
          .query("userProfile")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ]);

    return {
      exportedAt: Date.now(),
      user: {
        email,
        displayName: profile?.displayName ?? null,
        pronouns: profile?.pronouns ?? null,
      },
      assignments,
      courses,
      references,
      analyses,
      icalToken: icalToken
        ? { token: icalToken.token, createdAt: icalToken.createdAt }
        : null,
    };
  },
});
