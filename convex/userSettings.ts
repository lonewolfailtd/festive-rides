// Self-service settings: change password + sign out everywhere.
//
// Convex Auth's Password provider doesn't expose a "verify current
// password" helper from inside a mutation, so to keep things simple and
// honest we mirror the approach in passwordReset.ts: deleting the
// existing authAccount row forces the user to sign up again with a fresh
// password (their data is preserved because createOrUpdateUser reuses
// the existing users row by email).
//
// signOutEverywhere just wipes every authSessions row for the user, so
// other devices get logged out next time they hit the API.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const MIN_PASSWORD_LEN = 8;

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (newPassword.length < MIN_PASSWORD_LEN) {
      throw new Error(
        `New password must be at least ${MIN_PASSWORD_LEN} characters.`
      );
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Wipe authAccount + verification codes + sessions. The next sign-in
    // attempt will trigger the sign-up flow which writes a fresh
    // password hash. The users row stays put so all references and
    // assignments remain attached.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const a of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", a._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    return { ok: true };
  },
});

export const signOutEverywhere = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    return { ok: true, count: sessions.length };
  },
});

// Lets the Settings page show "signed in as ..." without pulling in
// the full auth helpers on the client.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user ? { email: (user as { email?: string }).email ?? null } : null;
  },
});
