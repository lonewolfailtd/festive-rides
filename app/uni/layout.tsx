import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import dynamic from "next/dynamic";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";

// Lazy-load the floating pomodoro pill. It's a fixed-position widget at
// the bottom-right of every uni page, but it's not above-the-fold and
// doesn't need to block initial render. Splitting it into a deferred
// chunk shaves a few hundred KB off the critical path. We don't pass
// `ssr: false` because the layout is a Server Component — next/dynamic
// without that flag still creates a separate JS chunk and renders the
// component normally on hydration.
const PomodoroTimer = dynamic(() => import("./PomodoroTimer"), {
  loading: () => null,
});

// Inter is Linear / Vercel-style: clean, highly legible, modern minimal.
// Scoped to /uni only; festive-rides keeps its festive font stack.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Fraunces is the display serif for h1 page titles — warm, classy, pairs
// with the Rose Quartz theme. Scoped to /uni only.
// Fraunces is the display serif for h1 page titles. We load only the
// weights we actually use (semibold for headings) to keep the font
// payload small — the opsz axis was nice but added ~80KB to the font
// bundle which contributed to slow cold-start times.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "Uni Citation Tool",
  description: "APA 7 reference manager and study helper for Open Polytechnic NZ assignments.",
  robots: { index: false, follow: false },
  manifest: "/uni-manifest.json",
  icons: {
    icon: "/uni-icon.svg",
    apple: "/uni-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
};

// Preconnect to the Convex deployment so the WebSocket handshake starts
// before the React app bootstraps. Saves a couple of seconds on cold-start
// because the dashboard fires ~7 simultaneous useQuery calls — having the
// connection already warm means they all resolve in parallel instead of
// queuing behind a fresh DNS+TLS round-trip.
const CONVEX_HTTP =
  (process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://fabulous-hippopotamus-112.convex.cloud").replace(
    /\/$/,
    "",
  );
const CONVEX_WS = CONVEX_HTTP.replace(/^https:/, "wss:");

export default function UniLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      {/* Preconnect hints — Next App Router hoists <link> tags into <head>. */}
      <link rel="preconnect" href={CONVEX_HTTP} crossOrigin="anonymous" />
      <link rel="preconnect" href={CONVEX_WS} crossOrigin="anonymous" />
      <ConvexClientProvider>
        <ThemeProvider>
          <div
            className={`${inter.className} ${inter.variable} ${fraunces.variable} relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 antialiased transition-colors dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100`}
          >
            {/* Subtle decorative aura — light only, soft sky/indigo glows. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,189,248,0.12),transparent_70%)] dark:hidden"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-32 top-40 -z-10 h-[300px] w-[300px] rounded-full bg-indigo-200/30 blur-3xl dark:hidden"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-32 top-96 -z-10 h-[300px] w-[300px] rounded-full bg-sky-200/40 blur-3xl dark:hidden"
            />
            {children}
            {/* Floating timer — visible on every uni page so the student
                can keep an eye on the session while moving between tools. */}
            <PomodoroTimer />
          </div>
        </ThemeProvider>
      </ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
