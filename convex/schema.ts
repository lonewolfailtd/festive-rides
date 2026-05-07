import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const TIME_SLOTS = [
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
] as const;

export const DESTINATION_CATEGORIES = [
  "doctor",
  "church",
  "supermarket",
  "christmas-events",
  "whanau-visits",
  "other",
] as const;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
] as const;

export default defineSchema({
  ...authTables,

  // Uni Citation Tool
  assignments: defineTable({
    userId: v.id("users"),
    name: v.string(),
    courseCode: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  references: defineTable({
    userId: v.id("users"),
    assignmentId: v.optional(v.id("assignments")),
    sourceType: v.string(),
    fields: v.any(),
    formatted: v.optional(v.string()),
    inTextShort: v.optional(v.string()),
    inTextNarrative: v.optional(v.string()),
    sortKey: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_assignment", ["userId", "assignmentId"])
    .index("by_user_sortKey", ["userId", "sortKey"]),

  // Festive Rides bookings
  bookings: defineTable({
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
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled")
    ),
    verificationToken: v.optional(v.string()),
    verificationTokenExpiresAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_reference", ["bookingReference"])
    .index("by_token", ["verificationToken"])
    .index("by_status_slot", ["status", "timeSlot"])
    .index("by_status_expires", ["status", "verificationTokenExpiresAt"])
    .index("by_ip_status", ["ipAddress", "status"]),
});
