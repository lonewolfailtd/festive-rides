import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import ConvexClientProvider from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Uni Citation Tool",
  description: "APA 7 reference manager and study helper for Open Polytechnic NZ assignments.",
  robots: { index: false, follow: false },
};

export default function UniLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>
      </ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
