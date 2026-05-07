import { ConvexHttpClient } from "convex/browser";

// Lazy server-side HTTP client. Initialised on first use rather than at
// module-load time so production builds don't crash before env vars are
// available (e.g. Vercel preflight evaluating route modules).

let cached: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Add it to your Vercel environment variables (Production + Preview + Development)."
    );
  }
  cached = new ConvexHttpClient(url);
  return cached;
}

export const convexServerClient = new Proxy({} as ConvexHttpClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
