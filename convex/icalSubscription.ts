// Live calendar subscription feed. Emits .ics from a public HTTP endpoint
// so Google Calendar / Apple Calendar can subscribe and re-fetch
// periodically (typically every few hours), keeping the student's
// calendar in sync with new assignments and due-date changes.
//
// Auth model: a long random opaque token in the URL path. The user
// generates one in the UI, copies the subscribe URL, and pastes it into
// their calendar app. They can revoke it any time, which deletes the row
// and any future fetches return 404.

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// 32 bytes of entropy → 43-char base64url. Cryptographically random.
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url, no padding
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Get the current user's token (or null if they don't have one yet).
export const getMyToken = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("icalTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row ? { token: row.token, createdAt: row.createdAt } : null;
  },
});

// Create the user's first token, or return the existing one. Idempotent.
export const ensureToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("icalTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return { token: existing.token };
    const token = generateToken();
    await ctx.db.insert("icalTokens", {
      userId,
      token,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "ical.ensureToken",
      entityType: "icalToken",
    });
    return { token };
  },
});

// Rotate: delete the existing token and issue a fresh one. Useful if the
// student suspects the URL leaked.
export const rotateToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("icalTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    const token = generateToken();
    await ctx.db.insert("icalTokens", {
      userId,
      token,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.auditLog.record, {
      userId,
      action: "ical.rotateToken",
      entityType: "icalToken",
    });
    return { token };
  },
});

export const revokeToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("icalTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      // Log BEFORE deletion.
      await ctx.runMutation(internal.auditLog.record, {
        userId,
        action: "ical.revokeToken",
        entityType: "icalToken",
      });
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

// ---- Internal helpers used by the HTTP route ---------------------------
// These bypass the normal auth check because the token IS the auth.

export const _resolveToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("icalTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    return row?.userId ?? null;
  },
});

export const _assignmentsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("assignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
