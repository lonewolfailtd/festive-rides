"use client";

// Playback brain for June's book — adapted from the flight book's pattern
// (its PlaybackProvider/Controls are the reference; this is June's own copy,
// per the library rule that books never share mutable code).
//
// Owns: a book-local Lenis instance (so play mode can drive the scroll), a
// single shared <audio> for narration, and the play/scroll/mute state.
//
// Modes:
//   • scroll — reader scrolls; the scene that pins reports itself active and
//     its verse narrates once.
//   • play   — read-along: glide to the scene, settle, narrate, breathe, next.
//     Any human wheel/touch exits back to scroll mode.

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
import { createPortal } from "react-dom";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

// Narration files in scene order (mirrors SCENES in Story.tsx).
const AUDIOS = [
  "n01-born.mp3",
  "n02-facetime.mp3",
  "n03-daycare.mp3",
  "n04-flight.mp3",
  "n05-lounge.mp3",
  "n06-christmas.mp3",
  "n07-bath.mp3",
  "n08-tomarata.mp3",
  "n09-beach.mp3",
  "n10-airport.mp3",
];

type Mode = "scroll" | "play";

interface Ctx {
  index: number;
  mode: Mode;
  muted: boolean;
  armed: boolean;
  total: number;
  /** Index whose verse is being spoken right now; null once it finishes. */
  narratingIndex: number | null;
  /** False until the read-along has finished once — scrolling is locked. */
  unlocked: boolean;
  reportActive: (i: number) => void;
  replay: () => void;
  registerSection: (i: number, el: HTMLElement | null) => void;
  togglePlay: () => void;
  toggleMute: () => void;
}

const JuneCtx = createContext<Ctx | null>(null);

export function useJunePlayback(): Ctx {
  const ctx = useContext(JuneCtx);
  if (!ctx) throw new Error("useJunePlayback must be used inside <JunePlaybackProvider>");
  return ctx;
}

export function JunePlaybackProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("scroll");
  const [muted, setMuted] = useState(false);
  const [armed, setArmed] = useState(false); // book opens silent until a tap
  const [narratingIndex, setNarratingIndex] = useState<number | null>(null);
  // The lullaby bed starts on the reader's very FIRST tap anywhere (e.g. the
  // "Got it!" card) — browsers won't allow sound any earlier than a gesture —
  // so the music is already playing before they press ▶.
  const [musicOn, setMusicOn] = useState(false);
  useEffect(() => {
    const arm = () => setMusicOn(true);
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, []);
  // The book premieres as a guided read-along: scrolling stays locked until
  // the story has been played through once, then the reader roams freely.
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);
  useEffect(() => {
    unlockedRef.current = unlocked;
  }, [unlocked]);

  const lenisRef = useRef<Lenis | null>(null);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const bgmARef = useRef<HTMLAudioElement | null>(null);
  const bgmBRef = useRef<HTMLAudioElement | null>(null);
  const programmaticRef = useRef(false);

  /* Lenis — book-local so play mode can scrollTo programmatically. */
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onUserScroll = () => {
      if (!programmaticRef.current && unlockedRef.current) setMode("scroll");
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

  /* Lock scrolling until the first full play-through. Lenis.stop() swallows
     wheel/touch input; programmatic glides use force:true so the read-along
     still moves. */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return; // reduced-motion fallback: leave native scroll alone
    if (unlocked) lenis.start();
    else lenis.stop();
  }, [unlocked]);

  /* Read-along pacing */
  const GLIDE_MS = 2800;
  const SETTLE_MS = 350;
  const BREATH_MS = 1100;
  const BACKSTOP_MS = 26000; // verses run ~18-22s; only fires if audio breaks

  const scrollToIndex = useCallback((i: number, durationMs = 1100) => {
    const el = sectionsRef.current[i];
    if (!el) return;
    const target = el.offsetTop + el.clientHeight * 0.33;
    programmaticRef.current = true;
    const release = () => {
      programmaticRef.current = false;
    };
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target, {
        duration: durationMs / 1000,
        easing: (t: number) => 0.5 * (1 - Math.cos(Math.PI * t)),
        onComplete: release,
        force: true, // glide even while user scrolling is locked
      });
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(release, durationMs);
    }
  }, []);

  const lastPlayedRef = useRef(-1);
  const playNarration = useCallback(
    (i: number, restart = false) => {
      const audio = audioRef.current;
      const file = AUDIOS[i];
      if (!audio || !file) return;
      const src = `/surprise/audio/story/${file}`;
      if (audio.getAttribute("src") !== src) audio.setAttribute("src", src);
      else if (restart) audio.currentTime = 0;
      audio.muted = muted;
      lastPlayedRef.current = i;
      setNarratingIndex(i);
      if (!muted) audio.play().catch(() => {});
    },
    [muted],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  // When a verse finishes, clear narratingIndex so its subtitle can fade out.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setNarratingIndex(null);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  /* Soft page-turn sfx on every scene change (once the book is armed). */
  const prevIndexRef = useRef(0);
  useEffect(() => {
    if (index === prevIndexRef.current) return;
    prevIndexRef.current = index;
    if (!armed || muted) return;
    const sfx = sfxRef.current;
    if (sfx) {
      sfx.currentTime = 0;
      sfx.volume = 0.35; // a whisper under the narration
      void sfx.play().catch(() => {});
    }
  }, [index, armed, muted]);

  /* Soft ambient music bed — plays once the book is armed, at a whisper.
     A single looping <audio> has an audible gap at the loop point (the track
     resolves, the file restarts), so we run TWO copies and crossfade: as one
     nears its end the other fades in over it. The bed never breaks. */
  useEffect(() => {
    const a = bgmARef.current;
    const b = bgmBRef.current;
    if (!a || !b) return;
    const TARGET = 0.1; // whisper under the narration
    const XFADE = 2.5; // seconds of overlap at the loop point

    if (!((armed || musicOn) && !muted)) {
      a.pause();
      b.pause();
      return;
    }

    let active = !a.paused ? a : !b.paused ? b : a;
    if (active.paused) {
      active.volume = TARGET;
      void active.play().catch(() => {});
    }

    // The fade is driven by the track's own remaining time (not rAF, which
    // freezes in background tabs / under heavy video decode and used to
    // leave the bed stuck at near-zero volume). A watchdog guarantees the
    // music can never stay silent while the book is armed.
    const tick = window.setInterval(() => {
      let other = active === a ? b : a;
      if (active.paused && !other.paused) {
        active = other; // recover if the roles got out of sync
        other = active === a ? b : a;
      }
      if (active.paused && other.paused) {
        active.currentTime = 0;
        active.volume = TARGET;
        void active.play().catch(() => {});
        return;
      }
      const d = active.duration;
      if (!d || Number.isNaN(d)) return;
      const remain = d - active.currentTime;
      if (remain < XFADE) {
        if (other.paused) {
          other.currentTime = 0;
          other.volume = 0;
          void other.play().catch(() => {});
        }
        const f = Math.min(1, Math.max(0, 1 - remain / XFADE));
        other.volume = TARGET * f;
        active.volume = TARGET * (1 - f);
        if (remain < 0.25 || active.ended) {
          active.pause();
          active.volume = TARGET;
          active = other;
        }
      } else if (active.volume !== TARGET) {
        // Restore after any interrupted fade and park the spare copy.
        active.volume = TARGET;
        if (!other.paused && (other.duration || 0) - other.currentTime > XFADE) other.pause();
      }
    }, 200);

    return () => window.clearInterval(tick);
  }, [armed, musicOn, muted]);

  /* Scroll mode: narrate the scene the reader settles on. */
  useEffect(() => {
    if (!armed || mode !== "scroll") return;
    if (lastPlayedRef.current === index) return;
    playNarration(index);
  }, [armed, mode, index, playNarration]);

  /* Play mode: glide → settle → narrate → ended → breath → next. */
  useEffect(() => {
    if (mode !== "play") return;
    const audio = audioRef.current;
    let done = false;
    const timers: number[] = [];

    audio?.pause();
    scrollToIndex(index, GLIDE_MS);
    timers.push(window.setTimeout(() => playNarration(index, true), GLIDE_MS + SETTLE_MS));

    const advance = () => {
      if (done) return;
      done = true;
      if (index >= AUDIOS.length - 1) {
        // The story has been told — unlock free scrolling and glide down to
        // the birthday cake finale.
        setUnlocked(true);
        setMode("scroll");
        const lenis = lenisRef.current;
        if (lenis) {
          programmaticRef.current = true;
          lenis.start();
          lenis.scrollTo(document.documentElement.scrollHeight, {
            duration: 2.6,
            easing: (t: number) => 0.5 * (1 - Math.cos(Math.PI * t)),
            onComplete: () => {
              programmaticRef.current = false;
            },
            force: true,
          });
        }
      } else {
        setIndex(index + 1);
      }
    };
    const onEnded = () => {
      timers.push(window.setTimeout(advance, BREATH_MS));
    };
    audio?.addEventListener("ended", onEnded);
    timers.push(window.setTimeout(advance, GLIDE_MS + SETTLE_MS + BACKSTOP_MS));

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      audio?.removeEventListener("ended", onEnded);
    };
  }, [mode, index, scrollToIndex, playNarration]);

  const reportActive = useCallback((i: number) => {
    if (programmaticRef.current) return;
    setIndex((prev) => (prev === i ? prev : i));
  }, []);

  const registerSection = useCallback((i: number, el: HTMLElement | null) => {
    sectionsRef.current[i] = el;
  }, []);

  const togglePlay = useCallback(() => {
    setArmed(true);
    window.dispatchEvent(new Event("june:stop-celebration"));
    setMode((m) => {
      if (m === "play") {
        // PAUSE for real: stop the voice mid-verse and freeze any in-flight
        // glide (otherwise the camera keeps travelling and the verse keeps
        // talking, which made the button feel broken).
        audioRef.current?.pause();
        const lenis = lenisRef.current;
        if (lenis) lenis.scrollTo(lenis.scroll, { immediate: true, force: true });
        programmaticRef.current = false;
        return "scroll";
      }
      return "play"; // resume: the sequencer glides back in and re-tells the verse
    });
  }, []);

  const toggleMute = useCallback(() => {
    setArmed(true);
    setMuted((m) => !m);
  }, []);

  const replay = useCallback(() => {
    setArmed(true);
    // Silence the birthday song + re-light the candle before starting over.
    window.dispatchEvent(new Event("june:stop-celebration"));
    setIndex(0);
    setMode("play");
  }, []);

  const value = useMemo<Ctx>(
    () => ({ index, mode, muted, armed, total: AUDIOS.length, narratingIndex, unlocked, reportActive, replay, registerSection, togglePlay, toggleMute }),
    [index, mode, muted, armed, narratingIndex, unlocked, reportActive, replay, registerSection, togglePlay, toggleMute],
  );

  return (
    <JuneCtx.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" className="hidden" />
      <audio ref={sfxRef} src="/surprise/audio/story/page-turn.mp3" preload="auto" className="hidden" />
      <audio ref={bgmARef} src="/surprise/audio/story/ambient-bed.mp3" preload="auto" className="hidden" />
      <audio ref={bgmBRef} src="/surprise/audio/story/ambient-bed.mp3" preload="auto" className="hidden" />
    </JuneCtx.Provider>
  );
}

/* ------------------------------------------------------------- Controls -- */
// Portal to <body>: the Library wraps open books in a transformed ancestor,
// which breaks position:fixed for normal children.
export function JuneControls() {
  const { mode, muted, armed, togglePlay, toggleMute } = useJunePlayback();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {!armed && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <button
            onClick={togglePlay}
            className="flex animate-[float-pulse_2.6s_ease-in-out_infinite] items-center gap-3 rounded-full border border-white/20 bg-black/55 py-3 pl-4 pr-6 text-white shadow-2xl backdrop-blur-md transition hover:bg-black/70 active:scale-95"
            style={FONT}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-blue-500 text-lg shadow-lg">
              ▶
            </span>
            <span className="text-left leading-tight">
              <span className="block text-base font-semibold">Play Juni&apos;s story</span>
              <span className="block text-xs text-white/65">sit back — it reads itself</span>
            </span>
          </button>
          <style>{`@keyframes float-pulse{0%,100%{transform:translateY(0);box-shadow:0 8px 30px rgba(56,189,248,.25)}50%{transform:translateY(-5px);box-shadow:0 14px 40px rgba(56,189,248,.45)}}`}</style>
        </div>
      )}

      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-black/40 px-2 py-2 backdrop-blur-md"
        style={FONT}
      >
        <button
          onClick={togglePlay}
          aria-label={mode === "play" ? "Pause read-along" : "Play read-along"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-blue-500 text-white shadow-lg transition hover:brightness-110 active:scale-95"
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
      </div>
    </>,
    document.body,
  );
}
