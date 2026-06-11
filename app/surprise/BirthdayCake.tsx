"use client";

// The birthday-cake finale — real film, not vectors. A looping clip of a
// lit "1" candle flickering on a gorgeous cake; tap it and a blow-out clip
// plays (flame dies, smoke curls), confetti rains, the happy-birthday song
// sings, and the birthday message pops in.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

const COLOURS = ["#38bdf8", "#f472b6", "#facc15", "#4ade80", "#c084fc", "#fb923c"];
const CONFETTI = Array.from({ length: 64 }, (_, i) => ({
  left: (i * 37 + 13) % 100,
  delay: ((i * 53) % 40) / 50,
  duration: 2.2 + ((i * 29) % 18) / 10,
  size: 7 + ((i * 11) % 8),
  colour: COLOURS[i % COLOURS.length],
  spin: ((i * 67) % 2 ? 1 : -1) * (260 + ((i * 31) % 220)),
  drift: (((i * 41) % 60) - 30) / 2,
  round: (i * 7) % 3 === 0,
}));

type Phase = "lit" | "blowing" | "blown";

export default function BirthdayCake() {
  const [phase, setPhase] = useState<Phase>("lit");
  const litRef = useRef<HTMLVideoElement | null>(null);
  const blowRef = useRef<HTMLVideoElement | null>(null);
  const songRef = useRef<HTMLAudioElement | null>(null);

  // When the story is replayed (or play is pressed), kill the birthday song
  // and re-light the candle so the finale is fresh on the next arrival.
  useEffect(() => {
    const reset = () => {
      const a = songRef.current;
      if (a) a.pause();
      const b = blowRef.current;
      if (b) b.pause();
      setPhase("lit");
      const lit = litRef.current;
      if (lit) void lit.play().catch(() => {});
    };
    window.addEventListener("june:stop-celebration", reset);
    return () => window.removeEventListener("june:stop-celebration", reset);
  }, []);

  const blowOut = () => {
    if (phase !== "lit") return;
    setPhase("blowing");
    const b = blowRef.current;
    if (b) {
      b.currentTime = 0;
      void b.play().catch(() => {});
    }
    // The flame dies partway through the clip — celebrate right at that beat.
    window.setTimeout(() => {
      setPhase("blown");
      const a = songRef.current;
      if (a) {
        a.currentTime = 0;
        void a.play().catch(() => {});
      }
    }, 2300);
  };

  return (
    <div className="relative flex w-full flex-col items-center" style={FONT}>
      {/* Confetti rain */}
      <AnimatePresence>
        {phase === "blown" && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            {CONFETTI.map((c, i) => (
              <motion.span
                key={i}
                initial={{ y: "-8vh", x: 0, rotate: 0, opacity: 1 }}
                animate={{ y: "112vh", x: `${c.drift}vw`, rotate: c.spin, opacity: [1, 1, 0.9, 0.7] }}
                transition={{ duration: c.duration, delay: c.delay, ease: "linear" }}
                className="absolute top-0"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.round ? c.size : c.size * 0.45,
                  background: c.colour,
                  borderRadius: c.round ? "50%" : 2,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* The cake — two stacked videos, lit loop + blow-out */}
      <button
        type="button"
        onClick={blowOut}
        aria-label={phase === "lit" ? "Tap to blow out the candle" : "Candle blown out!"}
        className="relative cursor-pointer overflow-hidden rounded-3xl shadow-[0_24px_70px_rgba(56,189,248,0.18)] outline-none ring-1 ring-white/10"
        style={{
          WebkitTapHighlightColor: "transparent",
          aspectRatio: "1 / 1",
          // Never taller than ~half the screen, so the cake + birthday
          // message always fit fully in view from the very top.
          width: "min(82vw, 48svh, 420px)",
        }}
      >
        <video
          ref={litRef}
          src="/surprise/video/cake-v3a-lit.mp4"
          poster="/surprise/scenes/cake-v3a-realistic.jpg"
          autoPlay
          muted
          loop
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            phase === "lit" ? "opacity-100" : "opacity-0"
          }`}
        />
        <video
          ref={blowRef}
          src="/surprise/video/cake-v2-blowout.mp4"
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            phase === "lit" ? "opacity-0" : "opacity-100"
          }`}
        />
      </button>

      {/* prompt */}
      {phase === "lit" && (
        <motion.p
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="mt-4 text-lg font-semibold text-amber-200 sm:text-xl"
          style={FONT}
        >
          🌬️ Tap the cake to blow out her candle!
        </motion.p>
      )}

      {/* birthday message */}
      <AnimatePresence>
        {phase === "blown" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.2 }}
            className="mt-4 flex flex-col items-center text-center"
          >
            <h2 className="text-3xl font-bold text-white sm:text-5xl" style={FONT}>
              Happy 1st Birthday,
            </h2>
            <p
              className="mt-1 bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-5xl font-extrabold text-transparent sm:text-7xl"
              style={FONT}
            >
              June
            </p>
            <p className="mt-4 max-w-sm text-base text-white/75 sm:text-lg" style={FONT}>
              With love from Aunty Sammi &amp; Uncle Tane 💙
            </p>
            <p className="mt-1 text-sm text-white/40" style={FONT}>
              Aotearoa, 10 June 2026
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={songRef} src="/surprise/audio/story/birthday-song.mp3" preload="auto" />
    </div>
  );
}
