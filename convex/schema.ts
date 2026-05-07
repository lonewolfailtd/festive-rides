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

  // Optional courses/papers layer. Assignments without a courseId stay
  // valid (backwards compat), so existing data keeps working. New
  // assignments can be grouped under a course to keep the dashboard tidy
  // once the student has multiple papers running.
  courses: defineTable({
    userId: v.id("users"),
    code: v.string(), // e.g. "PSY108"
    name: v.string(), // e.g. "Introduction to Psychology"
    colour: v.optional(v.string()), // tailwind colour key: sky, emerald, amber, rose, violet
    archived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  assignments: defineTable({
    userId: v.id("users"),
    name: v.string(),
    courseCode: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    dueDate: v.optional(v.number()),
    wordCountTarget: v.optional(v.number()),
    brief: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Submission + grade tracker
    submittedAt: v.optional(v.number()), // epoch ms
    grade: v.optional(v.number()), // 0-100 numeric
    gradeLetter: v.optional(v.string()), // "A+", "B-", "Pass", etc.
    markerFeedback: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseId"]),

  analyses: defineTable({
    userId: v.id("users"),
    assignmentId: v.optional(v.id("assignments")),
    brief: v.string(),
    rubric: v.optional(v.string()),
    wordCountTarget: v.optional(v.number()),
    // The full structured AnalysisResult JSON. Stored as v.any() so the
    // shape can evolve without migrations.
    result: v.any(),
    // Encoded as "<sectionIdx>:<bulletIdx>" strings — checked outline bullets.
    checkedBullets: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    modelUsed: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_assignment", ["userId", "assignmentId"]),

  references: defineTable({
    userId: v.id("users"),
    assignmentId: v.optional(v.id("assignments")),
    sourceType: v.string(),
    fields: v.any(),
    formatted: v.optional(v.string()),
    inTextShort: v.optional(v.string()),
    inTextNarrative: v.optional(v.string()),
    sortKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    annotation: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_user", ["userId"])
    .index("by_user_assignment", ["userId", "assignmentId"])
    .index("by_user_sortKey", ["userId", "sortKey"]),

  // Long random opaque tokens that grant read-only access to a user's
  // calendar subscription feed. The token lives in the URL, so it has to
  // be unguessable; revoking simply deletes the row.
  icalTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // Per-user AI usage tracking. One row per AI action call. Used for
  // rate-limiting (count today's rows for a user) and monthly spend caps
  // (sum costMicrocents for the current month). Rows older than 90 days
  // can be safely pruned by a cron — the dashboard only ever shows the
  // current month.
  aiUsage: defineTable({
    userId: v.id("users"),
    // Action name e.g. "analyser.analyse", "coach.coach". Free-form so
    // we can add new tools without a migration.
    action: v.string(),
    model: v.string(),
    // OpenRouter token counts (best-effort — falls back to estimates).
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    // Estimated cost in micro-cents (1/10000 of a cent) for high-precision
    // small numbers. e.g. $0.0042 → 4200 microcents. Prevents float drift.
    costMicrocents: v.optional(v.number()),
    // For cheap rate-limiting without aggregating: yyyy-mm-dd in NZ time.
    dayKey: v.string(),
    monthKey: v.string(), // yyyy-mm
  })
    .index("by_user_day", ["userId", "dayKey"])
    .index("by_user_month", ["userId", "monthKey"]),

  // Per-user profile data that doesn't fit in the auth-managed users
  // table. Lazily created on first set.
  userProfile: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    pronouns: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Append-only audit log of state-changing actions. Useful if anything
  // ever looks weird ("did I delete that, or did it disappear?"). Free-
  // form details are stringified so the schema stays tiny.
  auditLog: defineTable({
    userId: v.id("users"),
    action: v.string(), // e.g. "reference.delete", "assignment.markSubmitted"
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()), // JSON-stringified blob, capped to ~1KB
  }).index("by_user", ["userId"]),

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
