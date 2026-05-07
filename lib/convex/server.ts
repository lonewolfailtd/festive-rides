import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
}

// Server-side HTTP client. Booking mutations and queries are publicly callable;
// rate limiting and validation continue to live in the API-route layer.
export const convexServerClient = new ConvexHttpClient(convexUrl);
