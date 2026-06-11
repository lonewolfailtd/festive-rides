"use client";

// The birthday-cake moment at the end of book 2 — flight's own assets
// (cake grown from the 5C finale scene via fal.ai; music-box song via
// ElevenLabs). Pattern adapted from June's book's BirthdayCake; no shared
// mutable code, per the library rules.
//
// A looping clip of the lit "1" candle flickering at golden hour; tap the
// cake and the blow-out clip plays (flame dies, smoke curls), confetti
// rains, the music-box Happy Birthday sings, and the message pops in.

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

export default function FlightCake() {
  const [phase, setPhase] = useState<Phase>("lit");
  const litRef = useRef<HTMLVideoElement | null>(null);
  const blowRef = useRef<HTMLVideoElement | null>(null);
  const songRef = useRef<HTMLAudioElement | null>(null);

  // When the story is replayed, stop the song and re-light the candle so the
  // celebration is fresh on the next arrival.
  useEffect(() => {
    const reset = () => {
      songRef.current?.pause();
      blowRef.current?.pause();
      setPhase("lit");
      void litRef.current?.play().catch(() => {});
    };
    window.addEventListener("flight:stop-celebration", reset);
    return () => window.removeEventListener("flight:stop-celebration", reset);
  }, []);

  const blowOut = () => {
    if (phase !== "lit") return;
    setPhase("blowing");
    const blow = blowRef.current;
    if (blow) {
      blow.currentTime = 0;
      void blow.play().catch(() => {});
    }
    const song = songRef.current;
    if (song) {
      song.currentTime = 0;
      song.volume = 0.55;
      void song.play().catch(() => {});
    }
    window.setTimeout(() => setPhase("blown"), 1800);
  };

  return (
    <div className="relative flex w-full flex-col items-center" style={FONT}>
      {/* The cake film — lit loop on top, blow-out beneath, crossfaded */}
      <button
        type="button"
        onClick={blowOut}
        aria-label="Blow out the candle"
        className="relative aspect-video w-full max-w-xl overflow-hidden rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] outline-none transition active:scale-[0.99]"
      >
        <video
          ref={blowRef}
          src="/surprise/flight/video/cake-blowout.mp4"
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={litRef}
          src="/surprise/flight/video/cake-lit.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            phase === "lit" ? "opacity-100" : "opacity-0"
          }`}
        />
        {phase === "lit" && (
          <span className="absolute inset-x-0 bottom-4 animate-pulse text-center text-sm text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
            tap the cake to blow out the candle 🎂
          </span>
        )}
      </button>

      {/* Confetti rain */}
      <AnimatePresence>
        {phase !== "lit" && (
          <div className="pointer-events-none absolute inset-x-0 -top-10 h-[120%] overflow-hidden">
            {CONFETTI.map((c, i) => (
              <motion.span
                key={i}
                initial={{ y: -30, opacity: 0, rotate: 0 }}
                animate={{ y: "110vh" as unknown as number, opacity: [0, 1, 1, 0.8], rotate: c.spin, x: c.drift * 8 }}
                transition={{ duration: c.duration, delay: c.delay, ease: "linear" }}
                className="absolute"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.round ? c.size : c.size * 0.45,
                  borderRadius: c.round ? "50%" : 2,
                  background: c.colour,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Birthday message */}
      <AnimatePresence>
        {phase === "blown" && (
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
            className="mt-8 text-center"
          >
            <p className="text-3xl font-bold text-white sm:text-4xl">
              Happy 1st Birthday,{" "}
              <span className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-transparent">
                June
              </span>{" "}
              🎉
            </p>
            <p className="mt-3 max-w-sm px-6 text-sm text-white/70">
              The fantail flew her home, and the whole family was waiting. 🌿
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The music-box Happy Birthday */}
      <audio ref={songRef} src="/surprise/flight/audio/birthday-song.mp3" preload="none" className="hidden" />
    </div>
  );
}
