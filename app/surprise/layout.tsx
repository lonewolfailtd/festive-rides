import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

// Rounded, friendly storybook font, scoped to /surprise only.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "A surprise for June 🌿",
  description: "A little birthday surprise.",
  // Keep this private — never index the family surprise.
  robots: { index: false, follow: false },
};

export default function SurpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={fredoka.variable} style={{ fontFamily: "var(--font-fredoka), system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
