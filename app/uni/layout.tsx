import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";
import PomodoroTimer from "./PomodoroTimer";

// Inter is Linear / Vercel-style: clean, highly legible, modern minimal.
// Scoped to /uni only; festive-rides keeps its festive font stack.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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

export default function UniLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>
        <ThemeProvider>
          <div
            className={`${inter.className} ${inter.variable} relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 antialiased transition-colors dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100`}
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
