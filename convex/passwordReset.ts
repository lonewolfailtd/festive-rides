import { mutation } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_EMAILS = new Set([
  "contact@lonewolfaisolutions.com",
  "sammipetersen1720@yahoo.co.nz",
]);

const isAllowed = (email: string): boolean =>
  ALLOWED_EMAILS.has(email.trim().toLowerCase());

// Self-service password reset: wipes the existing authAccount + active
// sessions for the given email so the user can sign up again with a new
// password. The user row (and all their references / assignments / analyses)
// is preserved.
//
// Security model: we trust the small allow-list. Anyone in the world could
// theoretically trigger this for one of the two listed emails, which would
// log the legitimate owner out — but they can't gain access to the data
// without then signing up + knowing the email. Acceptable for a 2-user tool;
// would not be acceptable for a public app.
export const requestReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const cleanEmail = email.trim().toLowerCase();
    // Silently succeed for non-allow-listed emails to avoid enumeration
    // (so an attacker can't probe which addresses are in the allow-list).
    if (!isAllowed(cleanEmail)) {
      return { ok: true, action: "noop" as const };
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), cleanEmail))
      .first();
    if (!user) {
      // Email allow-listed but no account yet — nothing to reset.
      return { ok: true, action: "no-account" as const };
    }

    // Delete every authAccount linked to this user (this drops the password
    // hash). Also delete linked verification codes and active sessions.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
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
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    return { ok: true, action: "reset" as const };
  },
});
