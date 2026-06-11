/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const cspValue = [
  "default-src 'self'",
  // 'unsafe-eval' is only needed in development (Next.js HMR uses eval).
  // 'unsafe-inline' has to stay: the App Router injects inline hydration
  // scripts that would otherwise be blocked. The proper fix is a
  // nonce-based CSP via middleware — until then this is the floor.
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline' https://unpkg.com https://*.convex.cloud https://*.convex.site`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://api.crossref.org https://api.openalex.org https://openlibrary.org https://r.jina.ai",
  "worker-src 'self' blob: https://unpkg.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: cspValue },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['festiverides.online', 'www.festiverides.online'],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
  // Canonicalise the bare apex domain to www. The auth cookies Convex sets
  // are host-scoped, so a user bouncing between festiverides.online and
  // www.festiverides.online could land with a cookie set on the other host
  // and appear "logged out / page won't load". Forcing a single canonical
  // host removes that whole class of bug. 308 = permanent, method-preserving.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "festiverides.online" }],
        destination: "https://www.festiverides.online/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
