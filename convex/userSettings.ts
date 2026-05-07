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
import { internal } from "./_generated/api";

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

// Permanently delete the signed-in user's account and every row of
// their data. Requires the user to type their email exactly to confirm.
// Mirrors the auth-row cleanup pattern from passwordReset.ts so the
// session collapses on next request.
export const deleteMyAccount = mutation({
  args: { confirmEmail: v.string() },
  handler: async (ctx, { confirmEmail }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const userEmail = (user as { email?: string }).email ?? "";
    const cleanConfirm = confirmEmail.trim().toLowerCase();
    const cleanActual = userEmail.trim().toLowerCase();
    if (!cleanActual || cleanConfirm !== cleanActual) {
      throw new Error(
        "Email confirmation didn't match — type your email exactly to confirm."
      );
    }

    // Record the deletion BEFORE wiping. The audit row is collateral
    // damage when we wipe auditLog rows below, but we still log it for
    // symmetry with other delete actions.
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "account.delete",
      entityType: "user",
      entityId: userId.toString(),
      details: userEmail,
    });

    // Wipe user data tables. .collect() then iterate — assignments and
    // friends rarely exceed a few dozen for a single student.
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of assignments) await ctx.db.delete(r._id);

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of courses) await ctx.db.delete(r._id);

    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of analyses) await ctx.db.delete(r._id);

    const references = await ctx.db
      .query("references")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of references) await ctx.db.delete(r._id);

    const icalTokens = await ctx.db
      .query("icalTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of icalTokens) await ctx.db.delete(r._id);

    // aiUsage has no plain by_user index — by_user_month starts with
    // userId so a partial range over just userId catches every row.
    const aiUsageRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_month", (q) => q.eq("userId", userId))
      .collect();
    for (const r of aiUsageRows) await ctx.db.delete(r._id);

    // Audit log rows last — including the account.delete row we just
    // wrote. The deletion is recorded; once the user is gone the row is
    // not useful to anyone.
    const auditRows = await ctx.db
      .query("auditLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of auditRows) await ctx.db.delete(r._id);

    // Tear down auth: drop authAccounts (with their verification codes)
    // and active sessions. Once the auth row is gone the next request
    // signs the user out.
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

    // Finally drop the users row itself.
    await ctx.db.delete(userId);

    return { ok: true };
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
