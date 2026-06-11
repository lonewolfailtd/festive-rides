"use client";

// Critters — a handful of butterflies and glow-bees that wander the library
// scene. Pure requestAnimationFrame physics (no libraries): each critter
// wanders on a noisy heading, is gently pulled back inside the viewport, and
// steers hard AWAY from the mouse when it gets close, with a burst of speed.
// Decorative only: pointer-events-none, and it sits out prefers-reduced-motion.

import { useEffect, useRef } from "react";

const BUTTERFLY_COLORS = [
  { wing: "#f59e0b", edge: "#92400e" }, // amber
  { wing: "#f472b6", edge: "#9d174d" }, // pink
  { wing: "#a78bfa", edge: "#4c1d95" }, // violet
  { wing: "#38bdf8", edge: "#0c4a6e" }, // sky
];

function Butterfly({ color }: { color: { wing: string; edge: string } }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 drop-shadow-[0_2px_3px_rgba(0,0,0,.5)]">
      <g className="critter-wing-l">
        <path
          d="M11 12 C5 4, 1 6, 2.5 10.5 C3.5 13.5, 7 13, 11 12 Z M11 12.5 C6 13, 4 16, 6 18.5 C8 20.5, 10.5 17, 11 12.5 Z"
          fill={color.wing}
          stroke={color.edge}
          strokeWidth="0.6"
          opacity="0.95"
        />
      </g>
      <g className="critter-wing-r">
        <path
          d="M13 12 C19 4, 23 6, 21.5 10.5 C20.5 13.5, 17 13, 13 12 Z M13 12.5 C18 13, 20 16, 18 18.5 C16 20.5, 13.5 17, 13 12.5 Z"
          fill={color.wing}
          stroke={color.edge}
          strokeWidth="0.6"
          opacity="0.95"
        />
      </g>
      <ellipse cx="12" cy="12.5" rx="1.1" ry="4.2" fill="#3b2410" />
      <circle cx="12" cy="8.5" r="1.2" fill="#3b2410" />
    </svg>
  );
}

function GlowBee() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      {/* firefly-ish glow so the bee belongs in the night scene */}
      <circle cx="12" cy="13" r="9" fill="rgba(255,224,130,.35)" />
      <g className="critter-wing-l">
        <ellipse cx="9.5" cy="7.5" rx="3" ry="4" fill="rgba(220,240,255,.8)" />
      </g>
      <g className="critter-wing-r">
        <ellipse cx="14.5" cy="7.5" rx="3" ry="4" fill="rgba(220,240,255,.8)" />
      </g>
      <ellipse cx="12" cy="13" rx="4.5" ry="3.5" fill="#fbbf24" stroke="#451a03" strokeWidth="0.5" />
      <path d="M9.4 10.5 L9.4 15.5 M12 9.8 L12 16.2 M14.6 10.5 L14.6 15.5" stroke="#451a03" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.8" cy="12.2" r="1.5" fill="#451a03" />
    </svg>
  );
}

// kind, plus per-critter tuning. Bees are faster and jitterier.
const FLOCK = [
  { kind: "butterfly", color: 0 },
  { kind: "butterfly", color: 1 },
  { kind: "butterfly", color: 2 },
  { kind: "butterfly", color: 3 },
  { kind: "butterfly", color: 0 },
  { kind: "butterfly", color: 1 },
  { kind: "butterfly", color: 2 },
  { kind: "butterfly", color: 3 },
  { kind: "bee", color: 0 },
  { kind: "bee", color: 0 },
  { kind: "bee", color: 0 },
  { kind: "bee", color: 0 },
] as const;

export default function Critters() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(root.children) as HTMLElement[];
    const critters = els.map((el, i) => ({
      el,
      bee: el.dataset.kind === "bee",
      x: ((i * 137 + 80) % Math.max(window.innerWidth - 120, 200)) + 60,
      y: ((i * 211 + 60) % Math.max(window.innerHeight * 0.65, 200)) + 40,
      vx: 0,
      vy: 0,
      heading: i * 1.7,
      bob: i * 2.1,
    }));

    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) {
        mouse.x = t.clientX;
        mouse.y = t.clientY;
      }
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;

      for (const c of critters) {
        const cruise = c.bee ? 95 : 55;

        // wander: noisy heading, butterflies drift more horizontally
        c.heading += (Math.random() - 0.5) * (c.bee ? 1.4 : 0.9);
        let ax = Math.cos(c.heading) * cruise * 2;
        let ay = Math.sin(c.heading) * cruise * (c.bee ? 1.6 : 1.1);

        // flee the mouse: steer away, harder the closer it gets
        const dx = c.x - mouse.x;
        const dy = c.y - mouse.y;
        const FLEE_R = 150;
        const d2 = dx * dx + dy * dy;
        let maxSpeed = cruise;
        if (d2 < FLEE_R * FLEE_R) {
          const d = Math.sqrt(d2) || 1;
          const panic = 1 - d / FLEE_R;
          ax += (dx / d) * panic * 1400;
          ay += (dy / d) * panic * 1400;
          maxSpeed = cruise * 3.2; // burst of speed while escaping
        }

        // soft walls: steer back inside the viewport
        const M = 50;
        if (c.x < M) ax += 200;
        if (c.x > W - M) ax -= 200;
        if (c.y < M) ay += 200;
        if (c.y > H - M) ay -= 200;

        c.vx = (c.vx + ax * dt) * 0.985;
        c.vy = (c.vy + ay * dt) * 0.985;
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > maxSpeed) {
          c.vx = (c.vx / sp) * maxSpeed;
          c.vy = (c.vy / sp) * maxSpeed;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;

        // flutter bob + face the direction of travel
        c.bob += dt * (c.bee ? 16 : 9);
        const bobY = Math.sin(c.bob) * (c.bee ? 2 : 4.5);
        const flip = c.vx < 0 ? -1 : 1;
        const tilt = Math.max(-24, Math.min(24, c.vy * 0.22));
        c.el.style.transform = `translate3d(${c.x}px, ${c.y + bobY}px, 0) scaleX(${flip}) rotate(${tilt * flip}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {FLOCK.map((f, i) => (
        <div
          key={i}
          data-kind={f.kind}
          className="absolute left-0 top-0 -ml-3.5 -mt-3.5 will-change-transform"
          style={{ transform: "translate3d(-100px,-100px,0)" }}
        >
          {f.kind === "butterfly" ? <Butterfly color={BUTTERFLY_COLORS[f.color]} /> : <GlowBee />}
        </div>
      ))}
      <style>{`
        .critter-wing-l, .critter-wing-r { transform-origin: 12px 12px; }
        .critter-wing-l { animation: critter-flap-l .22s ease-in-out infinite alternate; }
        .critter-wing-r { animation: critter-flap-r .22s ease-in-out infinite alternate; }
        [data-kind="bee"] .critter-wing-l { animation-duration: .09s; }
        [data-kind="bee"] .critter-wing-r { animation-duration: .09s; }
        @keyframes critter-flap-l { from { transform: scaleX(1); } to { transform: scaleX(.3); } }
        @keyframes critter-flap-r { from { transform: scaleX(1); } to { transform: scaleX(.3); } }
      `}</style>
    </div>
  );
}
