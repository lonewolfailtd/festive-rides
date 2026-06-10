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

  /* ----- Scroll to a frame's "sweet spot" ----------------------------- */
  const scrollToIndex = useCallback((i: number) => {
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
      lenis.scrollTo(target, { duration: 1.1, onComplete: release });
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(release, 900);
    }
  }, []);

  /* ----- Active frame → load + play its narration --------------------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = FRAMES[index]?.audio;
    if (!src) return;
    if (audio.getAttribute("src") !== src) audio.setAttribute("src", src);
    audio.muted = muted;
    if (!muted) {
      // Missing/stub files reject here — harmless; read-along uses the timer.
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [index, muted]);

  /* ----- Read-along auto-advance -------------------------------------- */
  useEffect(() => {
    if (mode !== "play") return;
    scrollToIndex(index);

    const frame = FRAMES[index];
    let done = false;
    const advance = () => {
      if (done) return;
      done = true;
      if (index >= FRAMES.length - 1) {
        setMode("scroll"); // reached the end — release control
      } else {
        setIndex(index + 1);
      }
    };

    // Fallback pacing (audio is silent today); real narration ending wins.
    const timer = window.setTimeout(advance, frame.durationMs);
    const audio = audioRef.current;
    const onEnded = () => {
      window.clearTimeout(timer);
      advance();
    };
    audio?.addEventListener("ended", onEnded);

    return () => {
      window.clearTimeout(timer);
      audio?.removeEventListener("ended", onEnded);
    };
  }, [mode, index, scrollToIndex]);

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
