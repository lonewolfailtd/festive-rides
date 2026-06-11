"use client";

// The book itself: 15 pinned scenes driven by scroll, plus a read-along
// overlay (play/pause · mute) wired to PlaybackProvider.
//
// Each scene is a TALL <section> with a sticky full-screen stage. Scrolling
// its height gives a 0→1 progress that drives the camera (pan / push-in /
// parallax / finale). The scene art is a LIVING ambient clip on desktop
// (the fal.ai motion clips, muted loops) with the still as poster/phone
// fallback. The verse subtitle stays up while it's being SPOKEN, then fades
// (silent readers keep it for the whole scene). The book premieres locked:
// it reads itself through once before free scrolling unlocks.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import { FRAMES, STOPS, type Frame, type MotionKind } from "./story";
import { usePlayback } from "./PlaybackProvider";
import AmbientVideo, { useIsDesktop } from "./AmbientVideo";
import FlightCake from "./FlightCake";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

/* Scroll progress while a section is pinned (0 = entering, 1 = leaving). */
function usePinned(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  return scrollYProgress;
}

/* The moving scene plane. The art is ALIVE on every screen — the scene's
   motion clip loops ambiently in the right orientation (poster = the still).
   First paint (orientation unknown) shows stills for both. */
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
  const isDesktop = useIsDesktop();
  return (
    <motion.div style={style} className="absolute inset-0">
      {isDesktop !== null ? (
        <AmbientVideo
          src={`/surprise/flight/video/clips/${frame.id}${isDesktop ? "" : "-portrait"}.mp4`}
          poster={isDesktop ? frame.landscape : frame.portrait}
        />
      ) : (
        <>
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
        </>
      )}
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
  const { reportActive, registerSection, armed, muted, narratingIndex } = usePlayback();
  const [inView, setInView] = useState(false);

  // Register this section so play mode can glide to it.
  useEffect(() => {
    registerSection(index, ref.current);
    return () => registerSection(index, null);
  }, [index, registerSection]);

  // Tell the playback brain when this scene is the one on screen — it
  // handles narration (and stays quiet until the reader's first tap).
  useMotionValueEvent(p, "change", (v) => {
    if (v > 0.05 && v < 0.9) reportActive(index);
    setInView(v > 0.06 && v < 0.88);
  });

  // Subtitle visibility: while the verse is being SPOKEN it stays up, then
  // fades away so the art isn't blocked. Silent/muted readers keep it for
  // the whole scene (the text is the story for them).
  const showSub = inView && (!armed || muted || narratingIndex === index);

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

  // Stop title sweeps in on the first frame of each stop.
  const stopOpacity = useTransform(p, [0.02, 0.16, 0.45, 0.6], [0, 1, 1, 0]);
  const stopX = useTransform(p, [0.02, 0.2], [-60, 0]);

  // Soft fade-through-dark at the scene's edges, so one image dissolves
  // gently into the next instead of slide-cutting.
  const edgeFade = useTransform(p, [0, 0.09, 0.86, 1], [0.92, 0, 0, 0.92]);

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

        {/* Dissolve between scenes: dark at the very edges of the pin */}
        <motion.div
          style={{ opacity: edgeFade }}
          className="pointer-events-none absolute inset-0 z-[5] bg-black"
        />

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

        {/* Verse subtitle — slides up as the verse starts, fades once it's
            been said (synced to the narration, not the scroll). */}
        <motion.div
          initial={false}
          animate={{ opacity: showSub ? 1 : 0, y: showSub ? 0 : 24 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-x-0 bottom-[10%] z-10 mx-auto max-w-2xl px-8 text-center"
        >
          <p
            className="text-xl font-medium leading-snug text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:text-2xl lg:text-3xl"
            style={FONT}
          >
            {frame.verse[0]}
            <br />
            {frame.verse[1]}
            <br />
            {frame.verse[2]}
            <br />
            {frame.verse[3]}
          </p>
        </motion.div>

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
      className="pointer-events-none absolute inset-x-0 top-[14%] z-10 flex flex-col items-center text-center"
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
// The title page — a LIVING cover: June riding the fantail, wings beating,
// sparkles drifting (ambient clip on desktop, still on phones). The title
// sits over the art until the reader taps play, then slides away so the
// imagery has the whole stage for the premiere.
const COVER_PORTRAIT = "/surprise/flight/scenes/cover-portrait.jpg";
const COVER_WIDE = "/surprise/flight/scenes/cover-wide.jpg";

function Cover() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const isDesktop = useIsDesktop();
  const { armed } = usePlayback();
  const scale = useTransform(p, [0, 1], [1.05, 1.22]);
  const titleY = useTransform(p, [0, 0.6], ["0%", "-40%"]);
  const titleOpacity = useTransform(p, [0, 0.5, 0.8], [1, 1, 0]);
  const hintOpacity = useTransform(p, [0, 0.12], [1, 0]);

  return (
    <section ref={ref} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={{ scale }} className="absolute inset-0">
          {isDesktop !== null ? (
            <AmbientVideo
              src={`/surprise/flight/video/clips/cover${isDesktop ? "" : "-portrait"}.mp4`}
              poster={isDesktop ? COVER_WIDE : COVER_PORTRAIT}
              priority
            />
          ) : (
            <>
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
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75" />
        </motion.div>

        {/* Title block — slides up and away the moment the story begins, so
            the living art is unobstructed for the premiere. */}
        <motion.div
          initial={false}
          animate={armed ? { opacity: 0, y: -90 } : { opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-x-0 top-[9%] md:top-[12%]"
        >
          <motion.div
            style={{ y: titleY, opacity: titleOpacity }}
            className="flex flex-col items-center px-6 text-center"
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
        </motion.div>

        <motion.div
          initial={false}
          animate={armed ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-x-0 bottom-10"
        >
          <motion.div
            style={{ opacity: hintOpacity }}
            className="flex flex-col items-center text-white/75"
          >
            <span className="text-sm" style={FONT}>
              tap ▶ to begin the story
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Controls -- */
function Controls() {
  const { mode, muted, index, total, armed, togglePlay, toggleMute } = usePlayback();

  // The library wraps the open book in a transformed ancestor, which would
  // break `position: fixed`. Portal the controls to <body> so they stay
  // locked to the viewport. (mounted guard keeps SSR happy.)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Soft first-tap invitation — the book opens silent until this (or any
          control) is pressed. */}
      {!armed && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <button
            onClick={togglePlay}
            className="flex animate-[float-pulse_2.6s_ease-in-out_infinite] items-center gap-3 rounded-full border border-white/20 bg-black/55 py-3 pl-4 pr-6 text-white shadow-2xl backdrop-blur-md transition hover:bg-black/70 active:scale-95"
            style={FONT}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-indigo-500 text-lg shadow-lg">
              ▶
            </span>
            <span className="text-left leading-tight">
              <span className="block text-base font-semibold">Play the story</span>
              <span className="block text-xs text-white/65">sit back — it reads itself</span>
            </span>
          </button>
          <style>{`@keyframes float-pulse{0%,100%{transform:translateY(0);box-shadow:0 8px 30px rgba(56,189,248,.25)}50%{transform:translateY(-5px);box-shadow:0 14px 40px rgba(56,189,248,.45)}}`}</style>
        </div>
      )}

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
      <Farewell />
    </div>
  );
}

/* Farewell — the birthday-cake celebration, then a replay once unlocked. */
function Farewell() {
  const { unlocked, replay } = usePlayback();
  return (
    <footer
      className="relative flex min-h-[100svh] flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-b from-[#0b1020] to-[#1a1033] px-6 py-16 text-center text-white/60"
      style={FONT}
    >
      <FlightCake />
      <p className="mt-10 text-2xl">🌿</p>
      <p className="max-w-xs px-6 text-sm">
        With all our love, from your whānau in Aotearoa.
      </p>
      {unlocked && (
        <button
          type="button"
          onClick={replay}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
        >
          ↻ Play the story again
        </button>
      )}
    </footer>
  );
}
