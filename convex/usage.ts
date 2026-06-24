// AI usage tracking + rate limiting + spend cap.
//
// Every AI action calls `enforceQuota` BEFORE the OpenRouter request and
// `recordUsage` AFTER it succeeds. Together these give us:
// - Per-day request cap (hard rate limit, prevents UI-bug runaway)
// - Per-month spend cap in NZD (hard cost limit per user)
// - Visible usage on the settings page so the user can see their burn
//
// Rates and caps live as constants here. Tweak before bumping the user
// count past 2; the defaults are generous for a single student but would
// blow up if 50 friends signed up.

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---- Tunable caps -------------------------------------------------------

export const DAILY_CALL_CAP = 400; // requests per day
export const MONTHLY_USD_CAP = 100; // USD-equivalent cap (we track in microcents)
export const MONTHLY_MICROCENTS_CAP = MONTHLY_USD_CAP * 100 * 10_000;
// Warning threshold — show a "approaching limit" toast on the client.
export const MONTHLY_WARN_FRACTION = 0.8;

// Approximate per-1M-token prices in microcents for the models we use.
// 1 cent = 10_000 microcents; 1 USD = 100 cents = 1_000_000 microcents.
// These mirror the OpenRouter pricing as of May 2026 — adjust if pricing
// shifts. Off by a small amount = OK; we just need a sane spend estimate.
const MODEL_PRICE_MICROCENTS_PER_M_TOKEN: Record<
  string,
  { input: number; output: number }
> = {
  "deepseek/deepseek-v4-flash": { input: 1_400_000, output: 2_800_000 },
  "deepseek/deepseek-v4-pro": { input: 4_350_000, output: 8_700_000 },
  "anthropic/claude-sonnet-4.6": { input: 30_000_000, output: 150_000_000 },
};

const DEFAULT_PRICE = { input: 5_000_000, output: 10_000_000 }; // safe over-estimate

export function estimateCostMicrocents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICE_MICROCENTS_PER_M_TOKEN[model] ?? DEFAULT_PRICE;
  return Math.round(
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output,
  );
}

// NZ-time day/month keys. Convex runs UTC; we anchor to NZ so a day
// boundary doesn't fall in the middle of a study session.
function nzKeys(now = Date.now()): { dayKey: string; monthKey: string } {
  // Pacific/Auckland is UTC+12 / +13 (DST). Cheap shim: shift by +12h.
  // For rate limiting this is precise enough — it never matters whether
  // the cap rolls over at 11pm or midnight on a DST changeover day.
  const d = new Date(now + 12 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return { dayKey: `${y}-${m}-${day}`, monthKey: `${y}-${m}` };
}

// ---- Internal helpers (used by AI actions) ------------------------------

// Throws if the user is over the daily call cap or monthly spend cap.
// Call this BEFORE making the OpenRouter request.
export const enforceQuota = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { dayKey, monthKey } = nzKeys();

    const todayRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("dayKey", dayKey),
      )
      .collect();
    if (todayRows.length >= DAILY_CALL_CAP) {
      throw new Error(
        `You've hit today's AI usage cap (${DAILY_CALL_CAP} calls). Try again tomorrow, or contact the admin if you need it lifted.`,
      );
    }

    const monthRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey),
      )
      .collect();
    const spent = monthRows.reduce(
      (acc, r) => acc + (r.costMicrocents ?? 0),
      0,
    );
    if (spent >= MONTHLY_MICROCENTS_CAP) {
      throw new Error(
        `You've hit this month's AI spend cap (~$${MONTHLY_USD_CAP} NZD). Resets on the 1st.`,
      );
    }

    return {
      todayCalls: todayRows.length,
      monthSpentMicrocents: spent,
      dailyCap: DAILY_CALL_CAP,
      monthlyMicrocentsCap: MONTHLY_MICROCENTS_CAP,
    };
  },
});

// Record a usage row. Call this AFTER the OpenRouter request succeeds.
// Failures are logged but don't roll back the AI response.
export const recordUsage = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { dayKey, monthKey } = nzKeys();
    const cost = estimateCostMicrocents(
      args.model,
      args.inputTokens ?? 0,
      args.outputTokens ?? 0,
    );
    await ctx.db.insert("aiUsage", {
      userId: args.userId,
      action: args.action,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costMicrocents: cost,
      dayKey,
      monthKey,
    });
  },
});

// ---- Public query for the settings dashboard ----------------------------

export const myUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return null;
    // The auth subject is the user document id (Convex Auth convention).
    const uid = userId as Id<"users">;
    const { dayKey, monthKey } = nzKeys();

    const todayRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", uid).eq("dayKey", dayKey),
      )
      .collect();
    const monthRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", uid).eq("monthKey", monthKey),
      )
      .collect();

    const monthSpentMicrocents = monthRows.reduce(
      (acc, r) => acc + (r.costMicrocents ?? 0),
      0,
    );

    // Per-tool breakdown for the current month
    const byAction = new Map<string, { calls: number; microcents: number }>();
    for (const r of monthRows) {
      const cur = byAction.get(r.action) ?? { calls: 0, microcents: 0 };
      cur.calls += 1;
      cur.microcents += r.costMicrocents ?? 0;
      byAction.set(r.action, cur);
    }

    return {
      todayCalls: todayRows.length,
      dailyCap: DAILY_CALL_CAP,
      monthCalls: monthRows.length,
      monthSpentMicrocents,
      monthCapMicrocents: MONTHLY_MICROCENTS_CAP,
      monthCapUsd: MONTHLY_USD_CAP,
      byAction: Array.from(byAction.entries()).map(([action, v]) => ({
        action,
        calls: v.calls,
        microcents: v.microcents,
      })),
    };
  },
});
