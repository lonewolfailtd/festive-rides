"use client";

// The book itself: 15 pinned scenes driven by scroll, plus a read-along
// overlay (play/pause · mute · progress) wired to PlaybackProvider.
//
// Each scene is a TALL <section> with a sticky full-screen stage. Scrolling
// its height gives a 0→1 progress that drives the camera (pan / push-in /
// parallax / finale) and reveals the verse two lines at a time — the verse
// IS the subtitle. A centre-line IntersectionObserver marks the scene active
// so its narration plays. Art is placeholder until the 30 images land.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import { FRAMES, STOPS, type Frame, type MotionKind } from "./story";
import { usePlayback } from "./PlaybackProvider";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

/* Scroll progress while a section is pinned (0 = entering, 1 = leaving). */
function usePinned(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  return scrollYProgress;
}

/* Registers this section (so play-mode can scroll to it) and marks it active
   when it crosses screen-centre (which drives narration). */
function useCenterActive(ref: React.RefObject<HTMLElement | null>, index: number) {
  const { reportActive, registerSection } = usePlayback();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Make this frame a scroll target for read-along auto-advance.
    registerSection(index, el);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) reportActive(index);
      },
      // A thin band across the vertical middle of the viewport.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      registerSection(index, null);
    };
  }, [ref, index, reportActive, registerSection]);
}

/* The moving image plane: portrait on phones, landscape on desktop. */
function SceneMedia({
  frame,
  style,
  overlay,
  priority = false,
}: {
  frame: Frame;
  style?: MotionStyle;
  overlay?: string;
  priority?: boolean;
}) {
  return (
    <motion.div style={style} className="absolute inset-0">
      <Image
        src={frame.portrait}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover md:hidden"
      />
      <Image
        src={frame.landscape}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        className="hidden object-cover md:block"
      />
      <div
        className={`absolute inset-0 ${
          overlay ?? "bg-gradient-to-t from-black/80 via-black/10 to-black/40"
        }`}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------- Scene -- */
function Scene({ frame, index }: { frame: Frame; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  useCenterActive(ref, index);

  const isFirstOfStop = index === 0 || FRAMES[index - 1].stop !== frame.stop;

  // All camera recipes computed up front (hooks can't be conditional); we pick
  // the right MotionStyle by the frame's motion kind below.
  const panX = useTransform(p, [0, 1], ["3.5%", "-3.5%"]);
  const pushScale = useTransform(p, [0, 1], [1, 1.55]);
  const pushY = useTransform(p, [0, 1], ["0%", "-8%"]);
  const paraScale = useTransform(p, [0, 1], [1.2, 1.05]);
  const paraY = useTransform(p, [0, 1], ["6%", "-7%"]);
  const finScale = useTransform(p, [0, 0.6], [1.3, 1]);

  const cameras: Record<MotionKind, MotionStyle> = {
    pan: { x: panX, scale: 1.25 },
    "push-in": { scale: pushScale, y: pushY },
    parallax: { scale: paraScale, y: paraY },
    finale: { scale: finScale },
  };

  // Two-pair subtitle reveal: pair A early, pair B mid, both ease out near end.
  const pairAOpacity = useTransform(p, [0.08, 0.22, 0.82, 0.95], [0, 1, 1, 0]);
  const pairAY = useTransform(p, [0.08, 0.28], [40, 0]);
  const pairBOpacity = useTransform(p, [0.4, 0.54, 0.85, 0.96], [0, 1, 1, 0]);
  const pairBY = useTransform(p, [0.4, 0.6], [40, 0]);

  // Stop title sweeps in on the first frame of each stop.
  const stopOpacity = useTransform(p, [0.02, 0.16, 0.45, 0.6], [0, 1, 1, 0]);
  const stopX = useTransform(p, [0.02, 0.2], [-60, 0]);

  const isFinale = frame.motion === "finale";
  const overlay = isFinale
    ? "bg-gradient-to-b from-[#0b1020]/55 via-[#0b1020]/35 to-[#0b1020]"
    : "bg-gradient-to-t from-black/82 via-black/10 to-black/45";

  // Finale gets a touch more pinned height to let the closing breathe.
  const height = isFinale ? "300vh" : "260vh";

  return (
    <section ref={ref} className="relative" style={{ height }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <SceneMedia frame={frame} style={cameras[frame.motion]} overlay={overlay} priority={index === 0} />

        {/* Scene chip — stop · short title · frame id (also the placeholder label) */}
        <div className="absolute left-5 top-5 z-10 flex items-center gap-2 text-white/80">
          <span
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] backdrop-blur-sm"
            style={FONT}
          >
            {frame.stop} · {frame.title}
          </span>
          <span className="text-[11px] tracking-widest text-white/40" style={FONT}>
            {frame.id}
          </span>
        </div>

        {/* Big stop banner on each stop's opening frame */}
        {isFirstOfStop && (
          <motion.div
            style={{ opacity: stopOpacity, x: stopX }}
            className="absolute left-6 top-[24%] z-10"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-sky-200/80" style={FONT}>
              {`Stop ${STOPS.indexOf(frame.stop as (typeof STOPS)[number]) + 1}`}
            </p>
            <h2
              className="mt-1 text-4xl font-bold text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.7)] sm:text-6xl"
              style={FONT}
            >
              {frame.stop}
            </h2>
          </motion.div>
        )}

        {/* Verse / subtitles — two lines at a time, centred low */}
        <div className="absolute inset-x-0 bottom-[14%] mx-auto max-w-2xl px-8 text-center">
          <motion.p
            style={{ opacity: pairAOpacity, y: pairAY, ...FONT }}
            className="text-2xl font-medium leading-snug text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] sm:text-3xl lg:text-4xl"
          >
            {frame.verse[0]}
            <br />
            {frame.verse[1]}
          </motion.p>
          <motion.p
            style={{ opacity: pairBOpacity, y: pairBY, ...FONT }}
            className="mt-4 text-2xl font-medium leading-snug text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] sm:text-3xl lg:text-4xl"
          >
            {frame.verse[2]}
            <br />
            {frame.verse[3]}
          </motion.p>
        </div>

        {isFinale && <FinaleFlourish p={p} />}
      </div>
    </section>
  );
}

/* A little extra warmth on the very last frame. */
function FinaleFlourish({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, [0.55, 0.75], [0, 1]);
  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-x-0 top-[14%] flex flex-col items-center text-center"
    >
      <div className="text-5xl lg:text-6xl" aria-hidden>
        🎂✨
      </div>
      <p
        className="mt-3 bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl"
        style={FONT}
      >
        Happy 1st Birthday, Juney
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Cover -- */
// The title page. A slow push-in over the cover art while the title rises and
// fades — same recipe as book 1's cover, with book 2's own art + name.
const COVER_PORTRAIT = "/surprise/flight/scenes/cover-portrait.jpg";
const COVER_WIDE = "/surprise/flight/scenes/cover-wide.jpg";

function Cover() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const scale = useTransform(p, [0, 1], [1.05, 1.22]);
  const titleY = useTransform(p, [0, 0.6], ["0%", "-40%"]);
  const titleOpacity = useTransform(p, [0, 0.5, 0.8], [1, 1, 0]);
  const hintOpacity = useTransform(p, [0, 0.12], [1, 0]);

  return (
    <section ref={ref} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={{ scale }} className="absolute inset-0">
          <Image
            src={COVER_PORTRAIT}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover md:hidden"
          />
          <Image
            src={COVER_WIDE}
            alt=""
            fill
            sizes="100vw"
            priority
            className="hidden object-cover md:block"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75" />
        </motion.div>

        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="absolute inset-x-0 top-[9%] flex flex-col items-center px-6 text-center md:top-[12%]"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-white/75 sm:text-sm" style={FONT}>
            A first birthday story for Juniper
          </p>
          <h1
            className="mt-3 text-4xl font-bold leading-[1.05] text-white drop-shadow-[0_2px_22px_rgba(0,0,0,0.7)] sm:text-6xl lg:text-7xl"
            style={FONT}
          >
            The Fantail
            <br />
            Who Flew Her Home
          </h1>
          <p className="mt-3 text-base text-white/85 sm:text-xl" style={FONT}>
            Pīwakawaka’s big flight across the sea 🌿
          </p>
        </motion.div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute inset-x-0 bottom-10 flex flex-col items-center text-white/75"
        >
          <span className="text-sm" style={FONT}>
            tap ▶ for the read-along, or scroll
          </span>
          <span className="mt-1 animate-bounce text-lg">↓</span>
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Controls -- */
function Controls() {
  const { mode, muted, index, total, togglePlay, toggleMute } = usePlayback();
  const pct = Math.round(((index + 1) / total) * 100);

  // The library wraps the open book in a transformed ancestor, which would
  // break `position: fixed`. Portal the controls to <body> so they stay
  // locked to the viewport. (mounted guard keeps SSR happy.)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Slim progress bar pinned to the top */}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-sky-400 to-emerald-300 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Bottom-right control cluster */}
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-black/40 px-2 py-2 backdrop-blur-md"
        style={FONT}
      >
        <button
          onClick={togglePlay}
          aria-label={mode === "play" ? "Pause read-along" : "Play read-along"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-indigo-500 text-white shadow-lg transition hover:brightness-110 active:scale-95"
        >
          <span className="text-lg leading-none">{mode === "play" ? "⏸" : "▶"}</span>
        </button>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute narration" : "Mute narration"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
        >
          <span className="text-base leading-none">{muted ? "🔇" : "🔊"}</span>
        </button>
        <span className="px-2 text-xs tabular-nums text-white/70">
          {index + 1}/{total}
        </span>
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Book -- */
export default function FlightStory() {
  return (
    <div className="bg-black" style={FONT}>
      <Controls />
      <Cover />
      {FRAMES.map((frame, i) => (
        <Scene key={frame.id} frame={frame} index={i} />
      ))}
      <footer className="flex h-[40vh] flex-col items-center justify-center gap-2 bg-[#0b1020] text-center text-white/60" style={FONT}>
        <p className="text-2xl">🌿</p>
        <p className="max-w-xs px-6 text-sm">
          With all our love, from your whānau in Aotearoa.
        </p>
      </footer>
    </div>
  );
}
