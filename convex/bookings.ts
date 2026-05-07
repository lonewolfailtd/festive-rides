import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const ALLOWED_TIME_SLOTS = new Set([
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
]);

const ALLOWED_DESTINATION_CATEGORIES = new Set([
  "doctor",
  "church",
  "supermarket",
  "christmas-events",
  "whanau-visits",
  "other",
]);

const sanitiseEmail = (email: string) => email.trim().toLowerCase();

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

export const getByReference = query({
  args: { bookingReference: v.string() },
  handler: async (ctx, { bookingReference }) => {
    const ref = bookingReference.trim().toUpperCase();
    return await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("bookingReference", ref))
      .first();
  },
});

export const availableSlots = query({
  args: {},
  handler: async (ctx) => {
    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_status_slot", (q) => q.eq("status", "confirmed"))
      .collect();
    const bookedSet = new Set(confirmed.map((b) => b.timeSlot));
    const slots: Record<string, { available: boolean; booked: boolean }> = {};
    for (const slot of ALLOWED_TIME_SLOTS) {
      slots[slot] = { available: !bookedSet.has(slot), booked: bookedSet.has(slot) };
    }
    const totalAvailable = Object.values(slots).filter((s) => s.available).length;
    return { slots, totalAvailable };
  },
});

export const countRecentConfirmedByIp = query({
  args: { ipAddress: v.string(), windowMs: v.number() },
  handler: async (ctx, { ipAddress, windowMs }) => {
    if (!ipAddress) return 0;
    const since = Date.now() - windowMs;
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_ip_status", (q) =>
        q.eq("ipAddress", ipAddress).eq("status", "confirmed")
      )
      .collect();
    return rows.filter((r) => r._creationTime >= since).length;
  },
});

// --------------------------------------------------------------------------
// Mutations
// --------------------------------------------------------------------------

export const createPending = mutation({
  args: {
    passengerName: v.string(),
    passengerPhone: v.string(),
    passengerEmail: v.string(),
    timeSlot: v.string(),
    pickupAddress: v.string(),
    destinationCategory: v.string(),
    destinationAddress: v.string(),
    numPassengers: v.number(),
    specialRequirements: v.optional(v.string()),
    bookingReference: v.string(),
    verificationToken: v.string(),
    verificationTokenExpiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!ALLOWED_TIME_SLOTS.has(args.timeSlot)) {
      throw new Error("Invalid time slot");
    }
    if (!ALLOWED_DESTINATION_CATEGORIES.has(args.destinationCategory)) {
      throw new Error("Invalid destination category");
    }
    if (args.numPassengers < 1 || args.numPassengers > 8) {
      throw new Error("Number of passengers must be 1–8");
    }

    const refUpper = args.bookingReference.trim().toUpperCase();
    const tokenLower = args.verificationToken.trim();

    // Reference uniqueness
    const dupRef = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("bookingReference", refUpper))
      .first();
    if (dupRef) {
      throw new Error("Booking reference already exists");
    }

    // Token uniqueness
    const dupToken = await ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("verificationToken", tokenLower))
      .first();
    if (dupToken) {
      throw new Error("Verification token collision");
    }

    // Slot already confirmed?
    const confirmedForSlot = await ctx.db
      .query("bookings")
      .withIndex("by_status_slot", (q) =>
        q.eq("status", "confirmed").eq("timeSlot", args.timeSlot)
      )
      .first();
    if (confirmedForSlot) {
      throw new Error("That time slot has already been booked");
    }

    const id = await ctx.db.insert("bookings", {
      passengerName: args.passengerName.trim(),
      passengerPhone: args.passengerPhone.trim(),
      passengerEmail: sanitiseEmail(args.passengerEmail),
      timeSlot: args.timeSlot,
      pickupAddress: args.pickupAddress.trim(),
      destinationCategory: args.destinationCategory,
      destinationAddress: args.destinationAddress.trim(),
      numPassengers: args.numPassengers,
      specialRequirements: args.specialRequirements?.trim() || undefined,
      bookingReference: refUpper,
      status: "pending",
      verificationToken: tokenLower,
      verificationTokenExpiresAt: args.verificationTokenExpiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    const row = (await ctx.db.get(id)) as Doc<"bookings">;
    return row;
  },
});

type VerifyOutcome =
  | { kind: "confirmed"; booking: Doc<"bookings"> }
  | { kind: "alreadyConfirmed"; booking: Doc<"bookings"> }
  | { kind: "cancelled"; reason: "expired" | "slotTaken" | "userCancelled" }
  | { kind: "notFound" };

export const verifyToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<VerifyOutcome> => {
    const trimmed = token.trim();
    if (!trimmed) return { kind: "notFound" };

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("verificationToken", trimmed))
      .first();
    if (!booking) return { kind: "notFound" };

    if (booking.status === "confirmed") {
      return { kind: "alreadyConfirmed", booking };
    }
    if (booking.status === "cancelled") {
      return { kind: "cancelled", reason: "userCancelled" };
    }

    // Expired?
    if (
      booking.verificationTokenExpiresAt !== undefined &&
      Date.now() > booking.verificationTokenExpiresAt
    ) {
      await ctx.db.patch(booking._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancellationReason: "verification token expired",
        verificationToken: undefined,
        verificationTokenExpiresAt: undefined,
      });
      return { kind: "cancelled", reason: "expired" };
    }

    // Slot still free?
    const confirmedForSlot = await ctx.db
      .query("bookings")
      .withIndex("by_status_slot", (q) =>
        q.eq("status", "confirmed").eq("timeSlot", booking.timeSlot)
      )
      .first();
    if (confirmedForSlot) {
      await ctx.db.patch(booking._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancellationReason: "time slot was booked by another passenger",
        verificationToken: undefined,
        verificationTokenExpiresAt: undefined,
      });
      return { kind: "cancelled", reason: "slotTaken" };
    }

    await ctx.db.patch(booking._id, {
      status: "confirmed",
      verifiedAt: Date.now(),
      verificationToken: undefined,
      verificationTokenExpiresAt: undefined,
    });
    const updated = (await ctx.db.get(booking._id)) as Doc<"bookings">;
    return { kind: "confirmed", booking: updated };
  },
});

export const cancel = mutation({
  args: {
    bookingReference: v.string(),
    passengerEmail: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { bookingReference, passengerEmail, reason }) => {
    const ref = bookingReference.trim().toUpperCase();
    const email = sanitiseEmail(passengerEmail);
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("bookingReference", ref))
      .first();
    if (!booking) {
      return { ok: false as const, reason: "notFound" as const };
    }
    if (sanitiseEmail(booking.passengerEmail) !== email) {
      return { ok: false as const, reason: "emailMismatch" as const };
    }
    if (booking.status === "cancelled") {
      return { ok: true as const, alreadyCancelled: true, booking };
    }
    await ctx.db.patch(booking._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancellationReason: reason?.trim() || undefined,
      verificationToken: undefined,
      verificationTokenExpiresAt: undefined,
    });
    const updated = (await ctx.db.get(booking._id)) as Doc<"bookings">;
    return { ok: true as const, alreadyCancelled: false, booking: updated };
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("bookings")
      .withIndex("by_status_expires", (q) => q.eq("status", "pending"))
      .collect();
    const expired = pending.filter(
      (b) =>
        b.verificationTokenExpiresAt !== undefined &&
        b.verificationTokenExpiresAt < now
    );
    for (const b of expired) {
      await ctx.db.patch(b._id, {
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: "verification token expired",
        verificationToken: undefined,
        verificationTokenExpiresAt: undefined,
      });
    }
    return {
      cancelledCount: expired.length,
      cancelledReferences: expired.map((b) => b.bookingReference),
    };
  },
});

// External-cron-callable variant. Same logic but exposed as a public mutation
// so the existing /api/bookings/cleanup-expired route can call it. Auth for
// this is enforced at the API-route layer via CLEANUP_API_KEY.
export const cleanupExpiredPublic = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("bookings")
      .withIndex("by_status_expires", (q) => q.eq("status", "pending"))
      .collect();
    const expired = pending.filter(
      (b) =>
        b.verificationTokenExpiresAt !== undefined &&
        b.verificationTokenExpiresAt < now
    );
    for (const b of expired) {
      await ctx.db.patch(b._id, {
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: "verification token expired",
        verificationToken: undefined,
        verificationTokenExpiresAt: undefined,
      });
    }
    return {
      cancelledCount: expired.length,
      cancelledReferences: expired.map((b) => b.bookingReference),
    };
  },
});
