import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Hourly cleanup of pending bookings whose verification token has expired.
// Runs alongside the existing external /api/bookings/cleanup-expired hook so
// expiry happens promptly even if the external cron is missing.
crons.hourly(
  "cancel expired pending bookings",
  { minuteUTC: 5 },
  internal.bookings.cleanupExpired
);

export default crons;
