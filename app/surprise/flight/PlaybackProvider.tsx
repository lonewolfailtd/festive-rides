"use client";

// Playback brain for book 2. Owns three things the scenes share:
//
//   1. Lenis smooth-scroll — the cinematic glide (same library book 1 uses,
//      but a flight-local instance so we can drive it programmatically for
//      read-along auto-advance). Falls back to native scroll under
//      prefers-reduced-motion.
//   2. A single hidden <audio> element — plays the active frame's narration.
//      Files are stubs today, so play() may reject; that's caught and the
//      timed fallback keeps the read-along moving.
//   3. Shared state — which frame is active, "scroll" vs "play" mode, mute.
//
// Two delivery modes, as asked:
//   • scroll  — reader scrolls; whichever frame crosses screen-centre becomes
//               active and narrates. (reportActive drives this.)
//   • play    — hands-off read-along; the provider scrolls frame→frame,
//               advancing when the clip ends (or a fallback timer fires).

import Lenis from "lenis";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FRAMES } from "./story";

type Mode = "scroll" | "play";

interface PlaybackContextValue {
  index: number;
  mode: Mode;
  muted: boolean;
  total: number;
  /** A scene reports itself active when it crosses screen-centre (scroll mode). */
  reportActive: (i: number) => void;
  /** A scene registers its section element so we can scroll to it. */
  registerSection: (i: number, el: HTMLElement | null) => void;
  togglePlay: () => void;
  toggleMute: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return ctx;
}

export default function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("scroll");
  const [muted, setMuted] = useState(false);

  const lenisRef = useRef<Lenis | null>(null);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Guards a feedback loop: programmatic scrolls in play mode would otherwise
  // make the centre-observer "report" frames we're flying past.
  const programmaticRef = useRef(false);

  /* ----- Lenis (cinematic scroll) ------------------------------------- */
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // native scroll; programmatic falls back below

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenisRef.current = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Any human wheel/touch input drops us out of read-along back to manual.
    const onUserScroll = () => {
      if (!programmaticRef.current) setMode("scroll");
    };
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  /* ----- Slideshow pacing ---------------------------------------------- */
  // Press play once and the book carries itself: a long dreamy glide into each
  // scene, a beat to settle, the narration, a breath at the end, then on.
  const GLIDE_MS = 2800; // scene-to-scene camera glide
  const SETTLE_MS = 350; // beat after the glide before the voice starts
  const BREATH_MS = 1100; // pause after the verse before moving on

  /* ----- Scroll to a frame's "sweet spot" ----------------------------- */
  const scrollToIndex = useCallback((i: number, durationMs = 1100) => {
    const el = sectionsRef.current[i];
    if (!el) return;
    // Each section is tall with a sticky stage; land ~a third in so the scene
    // is mid-reveal rather than just entering.
    const target = el.offsetTop + el.clientHeight * 0.33;
    programmaticRef.current = true;
    const release = () => {
      programmaticRef.current = false;
    };
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target, {
        duration: durationMs / 1000,
        easing: (t: number) => 0.5 * (1 - Math.cos(Math.PI * t)), // easeInOutSine
        onComplete: release,
      });
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(release, durationMs);
    }
  }, []);

  /* ----- Narration helper ---------------------------------------------- */
  const lastPlayedRef = useRef(-1);
  const playNarration = useCallback(
    (i: number, restart = false) => {
      const audio = audioRef.current;
      const src = FRAMES[i]?.audio;
      if (!audio || !src) return;
      if (audio.getAttribute("src") !== src) audio.setAttribute("src", src);
      else if (restart) audio.currentTime = 0; // slideshow always tells the full verse
      audio.muted = muted;
      lastPlayedRef.current = i;
      if (!muted) {
        // Missing files reject here — harmless; the backstop timer paces us.
        audio.play().catch(() => {});
      }
    },
    [muted],
  );

  // Keep the element's mute state live (e.g. toggled mid-verse).
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  /* ----- Scroll mode: narrate whichever frame the reader settles on ---- */
  useEffect(() => {
    if (mode !== "scroll") return;
    if (lastPlayedRef.current === index) return; // already told this one
    playNarration(index);
  }, [mode, index, playNarration]);

  /* ----- Play mode: the slideshow sequencer ----------------------------
     glide (audio quiet) → settle → narrate → 'ended' → breath → next.
     The backstop timer only matters if the audio can't load. */
  useEffect(() => {
    if (mode !== "play") return;
    const audio = audioRef.current;
    const frame = FRAMES[index];
    let done = false;
    const timers: number[] = [];

    // Quiet the previous verse while the camera travels.
    audio?.pause();
    scrollToIndex(index, GLIDE_MS);
    timers.push(window.setTimeout(() => playNarration(index, true), GLIDE_MS + SETTLE_MS));

    const advance = () => {
      if (done) return;
      done = true;
      if (index >= FRAMES.length - 1) {
        setMode("scroll"); // reached the end — release control
      } else {
        setIndex(index + 1);
      }
    };

    // Real narration ending wins (plus a breath)…
    const onEnded = () => {
      timers.push(window.setTimeout(advance, BREATH_MS));
    };
    audio?.addEventListener("ended", onEnded);
    // …the backstop only fires when there's no playable audio (or muted).
    const backstop = muted
      ? GLIDE_MS + SETTLE_MS + frame.durationMs
      : GLIDE_MS + SETTLE_MS + frame.durationMs + 12000;
    timers.push(window.setTimeout(advance, backstop));

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      audio?.removeEventListener("ended", onEnded);
    };
  }, [mode, index, muted, scrollToIndex, playNarration]);

  /* ----- Public actions ----------------------------------------------- */
  const reportActive = useCallback(
    (i: number) => {
      if (programmaticRef.current) return; // ignore our own play-mode scrolling
      setIndex((prev) => (prev === i ? prev : i));
    },
    [],
  );

  const registerSection = useCallback((i: number, el: HTMLElement | null) => {
    sectionsRef.current[i] = el;
  }, []);

  const togglePlay = useCallback(() => {
    setMode((m) => (m === "play" ? "scroll" : "play"));
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const value = useMemo<PlaybackContextValue>(
    () => ({
      index,
      mode,
      muted,
      total: FRAMES.length,
      reportActive,
      registerSection,
      togglePlay,
      toggleMute,
    }),
    [index, mode, muted, reportActive, registerSection, togglePlay, toggleMute],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {/* Shared narration element. preload="none" so stub 404s stay quiet. */}
      <audio ref={audioRef} preload="none" className="hidden" />
    </PlaybackContext.Provider>
  );
}
