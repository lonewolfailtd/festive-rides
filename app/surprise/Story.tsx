"use client";

// The storybook itself — a vertical "movie" where scrolling drives a virtual
// camera (push-in, pan, parallax) over each scene. v1 uses the 3D style-test
// image as a placeholder across every scene; once June's character sheet and
// per-scene layered art are generated, each scene swaps to its real layers.
//
// Technique: each scene is a TALL section with a `sticky` full-screen stage
// inside it. As you scroll through the section's height, Framer Motion's
// useScroll gives a 0->1 progress that drives scale / translate / opacity —
// so the scene is "pinned" and the camera moves while you scroll, then
// releases into the next scene. Lenis (see SmoothScroll) makes it glide.

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const PLACEHOLDER = "/surprise/style-tests/3-pixar3d.jpg";

const titleFont = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

// Shared scroll progress for a pinned section: 0 when the section top reaches
// the top of the viewport, 1 when its bottom does.
function usePinnedProgress(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  return scrollYProgress;
}

/* ---------------------------------------------------------------- Cover -- */
function Cover() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinnedProgress(ref);
  const scale = useTransform(p, [0, 1], [1.05, 1.25]);
  const titleY = useTransform(p, [0, 0.6], ["0%", "-40%"]);
  const titleOpacity = useTransform(p, [0, 0.5, 0.8], [1, 1, 0]);
  const hintOpacity = useTransform(p, [0, 0.12], [1, 0]);

  return (
    <section ref={ref} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-black">
        <motion.div style={{ scale }} className="absolute inset-0">
          <Image src={PLACEHOLDER} alt="" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        </motion.div>

        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="absolute inset-x-0 top-[14%] flex flex-col items-center px-6 text-center"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-white/70" style={titleFont}>
            A first birthday story
          </p>
          <h1
            className="mt-3 text-5xl font-bold leading-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-6xl"
            style={titleFont}
          >
            Juniper Raine
          </h1>
          <p className="mt-2 text-xl text-white/90" style={titleFont}>
            June&apos;s First Kiwi Adventure
          </p>
        </motion.div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute inset-x-0 bottom-10 flex flex-col items-center text-white/70"
        >
          <span className="text-sm" style={titleFont}>
            scroll to begin
          </span>
          <span className="mt-1 animate-bounce text-lg">↓</span>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Push-in -- */
function PushInScene({
  line,
  height = "260vh",
}: {
  line: string;
  height?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinnedProgress(ref);
  const scale = useTransform(p, [0, 1], [1, 1.6]);
  const imgY = useTransform(p, [0, 1], ["0%", "-8%"]);
  const textOpacity = useTransform(p, [0, 0.18, 0.62, 0.85], [0, 1, 1, 0]);
  const textY = useTransform(p, [0, 0.35], ["48px", "0px"]);

  return (
    <section ref={ref} className="relative" style={{ height }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-black">
        <motion.div style={{ scale, y: imgY }} className="absolute inset-0">
          <Image src={PLACEHOLDER} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
        </motion.div>
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="absolute inset-x-0 bottom-[16%] mx-auto max-w-xl px-8 text-center"
        >
          <p
            className="text-2xl font-medium leading-snug text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)] sm:text-3xl"
            style={titleFont}
          >
            {line}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Pan -- */
function PanScene({ line }: { line: string }) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinnedProgress(ref);
  // Camera glides sideways across a slightly over-scaled scene = a pan.
  const x = useTransform(p, [0, 1], ["3%", "-3%"]);
  const scale = useTransform(p, [0, 1], [1.25, 1.25]);
  const textOpacity = useTransform(p, [0, 0.2, 0.65, 0.9], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative" style={{ height: "260vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-black">
        <motion.div style={{ x, scale }} className="absolute inset-0">
          <Image src={PLACEHOLDER} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
        </motion.div>
        <motion.div
          style={{ opacity: textOpacity }}
          className="absolute inset-x-0 top-[18%] mx-auto max-w-xl px-8 text-center"
        >
          <p
            className="text-2xl font-medium leading-snug text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)] sm:text-3xl"
            style={titleFont}
          >
            {line}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Finale -- */
function Finale() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinnedProgress(ref);
  const scale = useTransform(p, [0, 0.6], [1.3, 1]);
  const opacity = useTransform(p, [0, 0.25], [0, 1]);

  return (
    <section ref={ref} className="relative" style={{ height: "180vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-[#0b1020]">
        <motion.div style={{ scale }} className="absolute inset-0 opacity-60">
          <Image src={PLACEHOLDER} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1020]/60 via-[#0b1020]/30 to-[#0b1020]" />
        </motion.div>
        <motion.div
          style={{ opacity }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        >
          <div className="text-5xl" aria-hidden>
            🎂✨
          </div>
          <h2 className="mt-4 text-4xl font-bold text-white sm:text-5xl" style={titleFont}>
            Happy 1st Birthday,
          </h2>
          <p
            className="mt-1 bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-5xl font-bold text-transparent sm:text-6xl"
            style={titleFont}
          >
            Juney
          </p>
          <p className="mt-6 max-w-xs text-base text-white/70" style={titleFont}>
            With all our love, from your whānau in Aotearoa 🌿
          </p>
          <p className="mt-10 text-xs uppercase tracking-[0.25em] text-white/35" style={titleFont}>
            ( your first-year movie plays here )
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default function Story() {
  return (
    <div className="bg-black" style={titleFont}>
      <Cover />
      <PushInScene line="Far across the sea, in a land called America, a little girl named June was born." />
      <PanScene line="One night, a tiny fantail tapped at her window — sent all the way from Aotearoa." />
      <PushInScene line="“Come, June,” it whispered. “Let me show you home.”" />
      <Finale />
      {/* A little breathing room at the very end. */}
      <div className="h-[20vh] bg-[#0b1020]" />
    </div>
  );
}
