"use client";

// Lenis smooth-scroll provider — the "secret sauce" behind the cinematic
// feel. Replaces the browser's stepped native scroll with weighted inertia,
// and drives a requestAnimationFrame loop that Framer Motion's useScroll
// reads from for the camera moves.

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.09, // lower = smoother/heavier glide
      smoothWheel: true,
      // Respect users who ask for reduced motion — fall back to native scroll.
    });

    // If the visitor prefers reduced motion, tear Lenis down immediately.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      lenis.destroy();
      return;
    }

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
