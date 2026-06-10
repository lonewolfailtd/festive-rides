"use client";

// Motion playground — a scrollable demo of the cinematic techniques for the
// storybook, so we can choose what looks best:
//   1. Camera push-in + kinetic title (words blur-rise, name glows blue)
//   2. Multi-directional parallax (layers drift up / down / sideways)
//   3. Horizontal pan (scene slides one way, text the other)
//   4. Kinetic word showcase (words fly in from left/right/up/down)
//
// Built on the same stack as the real book: Lenis smooth scroll + Framer
// Motion useScroll/useTransform. Nothing here is gated — it's just a test.

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  type MotionValue,
} from "framer-motion";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;
const COVER = "/surprise/scenes/cover-wide.jpg";
const MOON = "/surprise/scenes/01-moon-wide.jpg";
const WINDOW = "/surprise/scenes/03-window-wide.jpg";

function usePinned(ref: React.RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  return scrollYProgress;
}

/* A single word that reveals on scroll: blur -> sharp, rise, fade in. */
function KineticWord({
  p,
  start,
  end,
  children,
  className = "",
}: {
  p: MotionValue<number>;
  start: number;
  end: number;
  children: React.ReactNode;
  className?: string;
}) {
  const opacity = useTransform(p, [start, end], [0, 1]);
  const y = useTransform(p, [start, end], [60, 0]);
  const blurPx = useTransform(p, [start, end], [14, 0]);
  const filter = useMotionTemplate`blur(${blurPx}px)`;
  return (
    <motion.span style={{ opacity, y, filter }} className={`inline-block ${className}`}>
      {children}
    </motion.span>
  );
}

/* A particle field that parallaxes. `dir` sets drift direction. */
function Particles({ p, dir = "up", count = 26 }: { p: MotionValue<number>; dir?: "up" | "down"; count?: number }) {
  const travel = dir === "up" ? ["0%", "-60%"] : ["0%", "60%"];
  const y = useTransform(p, [0, 1], travel);
  // Deterministic pseudo-random positions from index (no Math.random -> no SSR mismatch).
  const dots = Array.from({ length: count }, (_, i) => {
    const left = (i * 37) % 100;
    const top = (i * 53) % 100;
    const size = 2 + ((i * 7) % 5);
    const delay = (i % 10) * 0.3;
    const op = 0.25 + ((i * 13) % 50) / 100;
    return { left, top, size, delay, op };
  });
  return (
    <motion.div style={{ y }} className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: d.op,
            boxShadow: "0 0 8px rgba(255,255,255,0.8)",
            animation: `twinkle 3s ease-in-out ${d.delay}s infinite`,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ---- 1. Push-in + kinetic title ---- */
function ActTitle() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const scale = useTransform(p, [0, 1], [1.1, 1.35]);
  const tagX = useTransform(p, [0.15, 0.5], [-120, 0]);
  const tagOpacity = useTransform(p, [0.15, 0.4], [0, 1]);
  return (
    <section ref={ref} className="relative" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={{ scale }} className="absolute inset-0">
          <Image src={COVER} alt="" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
        </motion.div>
        <Particles p={p} dir="up" />
        <div className="absolute inset-x-0 top-[18%] flex flex-col items-center px-6 text-center">
          <h1 className="text-5xl font-bold leading-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.7)] sm:text-7xl lg:text-8xl" style={FONT}>
            <KineticWord p={p} start={0.02} end={0.18} className="mr-3">
              <span className="bg-gradient-to-b from-sky-300 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.5)]">
                Juniper
              </span>
            </KineticWord>
            <KineticWord p={p} start={0.1} end={0.26} className="text-white">
              Raine
            </KineticWord>
          </h1>
          <motion.p
            style={{ x: tagX, opacity: tagOpacity, ...FONT }}
            className="mt-3 text-xl text-white/90 sm:text-2xl lg:text-3xl"
          >
            June&apos;s First Kiwi Adventure
          </motion.p>
        </div>
        <div className="absolute inset-x-0 bottom-8 text-center text-sm text-white/60" style={FONT}>
          1 / 4 · push-in + kinetic title · keep scrolling ↓
        </div>
      </div>
    </section>
  );
}

/* ---- 2. Multi-directional parallax ---- */
function ActParallax() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const bgY = useTransform(p, [0, 1], ["-8%", "8%"]); // background drifts DOWN
  const midY = useTransform(p, [0, 1], ["20%", "-20%"]); // midground rises UP
  const scale = useTransform(p, [0, 1], [1.2, 1.05]);
  const headY = useTransform(p, [0, 0.4], [50, 0]);
  const headOp = useTransform(p, [0, 0.35], [0, 1]);
  return (
    <section ref={ref} className="relative" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#0b1020]">
        <motion.div style={{ y: bgY, scale }} className="absolute inset-0">
          <Image src={MOON} alt="" fill className="object-cover" />
        </motion.div>
        <Particles p={p} dir="down" count={30} />
        {/* Midground band that moves opposite to the background */}
        <motion.div style={{ y: midY }} className="absolute inset-x-0 top-1/2 -translate-y-1/2">
          <p className="text-center text-2xl font-semibold text-white/90 sm:text-4xl" style={FONT}>
            layers move <span className="text-sky-300">up</span>,{" "}
            <span className="text-rose-300">down</span> &{" "}
            <span className="text-emerald-300">apart</span>
          </p>
        </motion.div>
        <motion.div style={{ y: headY, opacity: headOp }} className="absolute inset-x-0 top-[12%] text-center" >
          <p className="text-sm uppercase tracking-[0.3em] text-white/70" style={FONT}>depth on scroll</p>
        </motion.div>
        <div className="absolute inset-x-0 bottom-8 text-center text-sm text-white/60" style={FONT}>
          2 / 4 · multi-directional parallax
        </div>
      </div>
    </section>
  );
}

/* ---- 3. Horizontal pan (scene one way, text the other) ---- */
function ActPan() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const imgX = useTransform(p, [0, 1], ["4%", "-10%"]); // scene pans LEFT
  const scale = useTransform(p, [0, 1], [1.3, 1.3]);
  const textX = useTransform(p, [0, 1], ["-30%", "30%"]); // text slides RIGHT
  const textOp = useTransform(p, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  return (
    <section ref={ref} className="relative" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={{ x: imgX, scale }} className="absolute inset-0">
          <Image src={WINDOW} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
        </motion.div>
        <motion.div style={{ x: textX, opacity: textOp }} className="absolute inset-y-0 left-0 right-0 flex items-center">
          <p className="whitespace-nowrap px-6 text-3xl font-bold text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] sm:text-5xl" style={FONT}>
            the camera glides one way — the words glide the other →
          </p>
        </motion.div>
        <div className="absolute inset-x-0 bottom-8 text-center text-sm text-white/60" style={FONT}>
          3 / 4 · horizontal pan
        </div>
      </div>
    </section>
  );
}

/* ---- 4. Kinetic words flying in from every direction ---- */
function ActWords() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  // Each word enters from a different direction.
  const w1 = { x: useTransform(p, [0.0, 0.2], [-200, 0]), o: useTransform(p, [0.0, 0.2], [0, 1]) };
  const w2 = { y: useTransform(p, [0.1, 0.3], [-160, 0]), o: useTransform(p, [0.1, 0.3], [0, 1]) };
  const w3 = { x: useTransform(p, [0.2, 0.4], [200, 0]), o: useTransform(p, [0.2, 0.4], [0, 1]) };
  const w4 = { y: useTransform(p, [0.3, 0.5], [160, 0]), o: useTransform(p, [0.3, 0.5], [0, 1]) };
  const nameScale = useTransform(p, [0.5, 0.75], [0.6, 1]);
  const nameOp = useTransform(p, [0.5, 0.7], [0, 1]);
  return (
    <section ref={ref} className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0b1020] to-[#161b34] text-center" style={FONT}>
        <div className="space-y-2 text-4xl font-bold text-white sm:text-6xl">
          <motion.div style={{ x: w1.x, opacity: w1.o }}>from the left</motion.div>
          <motion.div style={{ y: w2.y, opacity: w2.o }} className="text-sky-300">from above</motion.div>
          <motion.div style={{ x: w3.x, opacity: w3.o }}>from the right</motion.div>
          <motion.div style={{ y: w4.y, opacity: w4.o }} className="text-emerald-300">from below</motion.div>
        </div>
        <motion.div style={{ scale: nameScale, opacity: nameOp }} className="mt-10">
          <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-6xl font-extrabold text-transparent drop-shadow-[0_0_40px_rgba(56,189,248,0.6)] sm:text-8xl">
            June 🌿
          </span>
        </motion.div>
        <div className="absolute inset-x-0 bottom-8 text-center text-sm text-white/60">4 / 4 · kinetic words</div>
      </div>
    </section>
  );
}

export default function TestScene() {
  return (
    <main className="bg-black" style={FONT}>
      <div className="flex h-[40vh] flex-col items-center justify-center bg-[#0b1020] text-center text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">motion test</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-5xl">Scroll down slowly ↓</h1>
        <p className="mt-2 max-w-sm px-6 text-sm text-white/60">
          Four techniques for the book. Tell me which you love and I&apos;ll apply them to June&apos;s scenes.
        </p>
      </div>
      <ActTitle />
      <ActParallax />
      <ActPan />
      <ActWords />
      <div className="flex h-[30vh] items-center justify-center bg-[#0b1020] text-white/50">that&apos;s the demo — scroll back up to replay</div>
      <style>{`@keyframes twinkle{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </main>
  );
}
