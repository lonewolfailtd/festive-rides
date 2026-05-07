import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "./ThemeProvider";

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
          <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
            {children}
          </div>
        </ThemeProvider>
      </ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
