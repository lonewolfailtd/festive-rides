"use client";

// The enchanted bookcase — the story picker. A floor-to-ceiling arched
// bookcase standing in a moonlit forest clearing. June's real storybooks live
// on the glowing eye-level shelf; the other shelves are dressed with little
// decorative books and trinkets. Hover lifts + tilts a book out; clicking a
// published book opens its story. "Coming soon" books are sealed.

import { motion } from "framer-motion";
import { STORIES, type StoryMeta } from "./stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

/* ── Real, openable storybooks ──────────────────────────────────────────── */

function Book({ story, onOpen }: { story: StoryMeta; onOpen: (id: string) => void }) {
  const published = story.status === "published";
  return (
    <motion.button
      type="button"
      disabled={!published}
      onClick={() => published && onOpen(story.id)}
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      whileHover={
        published
          ? { y: -22, rotateZ: -3, transition: { type: "spring", stiffness: 300, damping: 18 } }
          : { y: -4 }
      }
      className="group relative flex shrink-0 items-end outline-none"
      style={{ height: story.height * 0.88, ...FONT }}
      aria-label={published ? `Open ${story.title}` : `${story.title} — coming soon`}
    >
      {/* soft magical aura behind a published book */}
      {published && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[-10px] inset-y-2 rounded-full opacity-60"
          style={{
            background: "radial-gradient(closest-side, rgba(255,214,140,.22), transparent)",
            animation: "aura-breathe 4.5s ease-in-out infinite",
          }}
        />
      )}

      {/* The spine */}
      <div
        className="relative flex h-full w-[50px] flex-col items-center justify-between overflow-hidden rounded-[4px] px-1.5 py-3 sm:w-[62px]"
        style={{
          background: `linear-gradient(160deg, ${story.spineFrom}, ${story.spineTo})`,
          boxShadow:
            "inset 3px 0 6px rgba(255,255,255,.18), inset -4px 0 10px rgba(0,0,0,.45), 0 10px 22px rgba(0,0,0,.5)",
          filter: published ? "none" : "saturate(.55) brightness(.8)",
        }}
      >
        {/* top + bottom foil bands */}
        <span className="h-[3px] w-8 rounded-full" style={{ background: story.ink, opacity: 0.7 }} />
        <span
          className="flex-1 py-2 text-center text-[11px] font-semibold leading-tight tracking-wide sm:text-[13px]"
          style={{ color: story.ink, writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {story.title}
        </span>
        <span className="h-[3px] w-8 rounded-full" style={{ background: story.ink, opacity: 0.7 }} />

        {/* page edge on the right */}
        <span className="absolute right-0 top-0 h-full w-[5px] bg-gradient-to-l from-amber-50/80 to-transparent" />
      </div>

      {/* coming-soon seal */}
      {!published && (
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-200">
          ✨ soon
        </span>
      )}
      {/* glow under a hovered published book */}
      {published && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-12 -translate-x-1/2 rounded-full bg-amber-300/0 blur-md transition-all duration-300 group-hover:bg-amber-300/50" />
      )}
    </motion.button>
  );
}

/* ── Decorative shelf dressing (not clickable) ──────────────────────────── */

const FILLER_PALETTE = [
  ["#46314f", "#7c5a8f", "#e9d5ff"],
  ["#173f33", "#2f7d5d", "#d1fae5"],
  ["#5b1e2a", "#a8475c", "#ffe4e6"],
  ["#1d3a5f", "#3f6fa3", "#dbeafe"],
  ["#5c4116", "#a37b2c", "#fef3c7"],
  ["#23414a", "#48808f", "#cffafe"],
  ["#4a2330", "#8a4f63", "#fce7f3"],
  ["#33401c", "#6a7d3a", "#ecfccb"],
] as const;

function FillerBook({ seed, className = "" }: { seed: number; className?: string }) {
  const [from, to, ink] = FILLER_PALETTE[seed % FILLER_PALETTE.length];
  const h = 92 + ((seed * 37) % 52); // 92–143px
  const w = 22 + ((seed * 13) % 12); // 22–33px
  const leaning = seed % 7 === 3;
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 self-end overflow-hidden rounded-[3px] ${className}`}
      style={{
        height: h,
        width: w,
        background: `linear-gradient(160deg, ${from}, ${to})`,
        boxShadow: "inset 2px 0 4px rgba(255,255,255,.14), inset -3px 0 7px rgba(0,0,0,.45), 0 6px 12px rgba(0,0,0,.45)",
        transform: leaning ? "rotate(-7deg) translateY(2px)" : undefined,
        transformOrigin: "bottom right",
      }}
    >
      <span
        className="absolute left-1/2 top-2 h-[3px] w-3 -translate-x-1/2 rounded-full"
        style={{ background: ink, opacity: 0.6 }}
      />
      <span
        className="absolute bottom-2 left-1/2 h-[3px] w-3 -translate-x-1/2 rounded-full"
        style={{ background: ink, opacity: 0.6 }}
      />
      <span className="absolute right-0 top-0 h-full w-[3px] bg-gradient-to-l from-amber-50/60 to-transparent" />
    </span>
  );
}

function Trinket({ kind }: { kind: "fern" | "candle" | "kiwi" | "frame" | "hourglass" | "teddy" }) {
  const glyph = { fern: "🪴", candle: "🕯️", kiwi: "🥝", frame: "🖼️", hourglass: "⏳", teddy: "🧸" }[kind];
  return (
    <span aria-hidden className="relative shrink-0 self-end pb-0.5 text-2xl sm:text-3xl" style={{ lineHeight: 1 }}>
      {kind === "candle" && (
        <span
          className="absolute -top-3 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full blur-md"
          style={{ background: "rgba(255,190,90,.45)", animation: "aura-breathe 2.6s ease-in-out infinite" }}
        />
      )}
      <span className="relative drop-shadow-[0_4px_6px_rgba(0,0,0,.5)]">{glyph}</span>
    </span>
  );
}

/** One decorative shelf row — deterministic mix of little books + trinkets. */
function DecorShelf({ seed }: { seed: number }) {
  const items: React.ReactNode[] = [];
  const trinkets: Array<"fern" | "candle" | "kiwi" | "frame" | "hourglass" | "teddy"> = [
    "fern",
    "candle",
    "kiwi",
    "hourglass",
    "teddy",
    "frame",
  ];
  // 11 items fill a phone-width shelf; the rest appear on wider screens.
  for (let i = 0; i < 17; i++) {
    const s = seed * 31 + i * 17;
    const wide = i >= 11 ? "hidden sm:block" : "";
    if (i === 3 || i === 8 || i === 14) {
      items.push(
        <span key={`t-${i}`} className={`${i >= 11 ? "hidden sm:flex" : "flex"} self-end`}>
          <Trinket kind={trinkets[(seed + i) % trinkets.length]} />
        </span>
      );
    } else {
      items.push(<FillerBook key={`f-${i}`} seed={s} className={wide} />);
    }
  }
  return <div className="flex items-end justify-center gap-1.5 px-3 sm:gap-2">{items}</div>;
}

function ShelfPlank() {
  return (
    <div className="relative mt-1">
      <div
        className="h-4 w-full rounded-[3px]"
        style={{
          background: "linear-gradient(180deg,#6b4423,#3d2614)",
          boxShadow: "0 12px 22px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,210,150,.25)",
        }}
      />
      <div className="mx-auto h-2 w-[97%] rounded-b-[6px] bg-black/40 blur-[1px]" />
    </div>
  );
}

/* ── The scene ──────────────────────────────────────────────────────────── */

/** Chunk the registry into story shelves so the case grows gracefully. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function Bookshelf({ onOpen }: { onOpen: (id: string) => void }) {
  const storyShelves = chunk(STORIES, 6);

  return (
    <main
      className="relative flex min-h-[100svh] flex-col items-center overflow-hidden px-3 py-8 sm:px-4"
      style={{
        ...FONT,
        background:
          "radial-gradient(120% 70% at 50% -10%, #1b2a55 0%, #131c3e 32%, #0c1228 55%, #080d1c 100%)",
      }}
    >
      {/* ── the night sky ── */}
      {/* aurora ribbons */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-[8%] h-[420px] w-[260px] rotate-[18deg] rounded-full blur-3xl"
        style={{ background: "linear-gradient(180deg, rgba(74,222,128,.16), rgba(34,211,238,.10), transparent)", animation: "aurora-sway 11s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[6%] h-[480px] w-[300px] -rotate-[14deg] rounded-full blur-3xl"
        style={{ background: "linear-gradient(180deg, rgba(167,139,250,.15), rgba(56,189,248,.10), transparent)", animation: "aurora-sway 13s ease-in-out 1.4s infinite" }}
      />
      {/* moon */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-12 h-16 w-16 rounded-full sm:right-[16%] sm:h-20 sm:w-20"
        style={{
          background: "radial-gradient(circle at 38% 35%, #fffbe9 0%, #ffe9b8 55%, #e8c87f 100%)",
          boxShadow: "0 0 50px 18px rgba(255,230,170,.30), 0 0 120px 50px rgba(255,230,170,.12)",
        }}
      />
      {/* twinkling stars */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 46 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 31) % 62}%`,
              width: 1 + ((i * 7) % 3),
              height: 1 + ((i * 7) % 3),
              opacity: 0.35 + ((i * 11) % 50) / 100,
              animation: `star-twinkle ${2.4 + (i % 5) * 0.8}s ease-in-out ${(i % 9) * 0.4}s infinite`,
            }}
          />
        ))}
      </div>
      {/* silhouetted treeline either side of the case */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[46%] w-[26%]"
        style={{
          background: "radial-gradient(120% 100% at 0% 100%, #04070f 30%, rgba(4,7,15,.7) 60%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[46%] w-[26%]"
        style={{
          background: "radial-gradient(120% 100% at 100% 100%, #04070f 30%, rgba(4,7,15,.7) 60%, transparent 100%)",
        }}
      />
      {/* drifting dust motes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-100"
            style={{
              left: `${(i * 41) % 100}%`,
              top: `${(i * 27) % 100}%`,
              width: 2 + ((i * 5) % 4),
              height: 2 + ((i * 5) % 4),
              opacity: 0.1 + ((i * 9) % 26) / 100,
              animation: `float-mote ${6 + (i % 5)}s ease-in-out ${(i % 7) * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── title floating in the sky ── */}
      <div className="relative z-10 mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-200/70">Welcome to</p>
        <h1
          className="mt-2 text-4xl font-bold text-amber-50 sm:text-5xl"
          style={{ textShadow: "0 2px 16px rgba(0,0,0,.6), 0 0 34px rgba(255,214,140,.35)" }}
        >
          June&apos;s Library
        </h1>
        <p className="mt-2 text-sm text-amber-100/60">Pick a book off the shelf to begin.</p>
      </div>

      {/* ── the great bookcase ── */}
      <div className="relative z-10 w-full max-w-[860px]">
        {/* warm light spilling out of the whole case */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 rounded-[50%] blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,186,110,.16), transparent)" }}
        />

        {/* outer wooden frame with arched crown */}
        <div
          className="relative rounded-b-[14px] rounded-t-[150px] p-3 pt-5 sm:p-4 sm:pt-6"
          style={{
            background: "linear-gradient(180deg, #7a4f28 0%, #5d3a1d 30%, #45290f 100%)",
            boxShadow:
              "0 30px 70px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,214,150,.35), inset 0 -6px 16px rgba(0,0,0,.45)",
          }}
        >
          {/* inner backboard */}
          <div
            className="relative overflow-hidden rounded-b-[10px] rounded-t-[130px] px-2 pb-3 pt-8 sm:px-3"
            style={{
              background: "linear-gradient(180deg, #241509 0%, #1a0e06 60%, #130a04 100%)",
              boxShadow: "inset 0 0 60px rgba(0,0,0,.8)",
            }}
          >
            {/* lantern hanging in the arch */}
            <div aria-hidden className="pointer-events-none relative mx-auto mb-2 flex h-16 w-full items-start justify-center">
              <div className="flex flex-col items-center" style={{ animation: "lantern-sway 5s ease-in-out infinite", transformOrigin: "top center" }}>
                <span className="h-6 w-[2px] bg-amber-900/80" />
                <span className="relative text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,.6)]">
                  <span
                    className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
                    style={{ background: "rgba(255,186,100,.5)", animation: "aura-breathe 3s ease-in-out infinite" }}
                  />
                  <span className="relative">🏮</span>
                </span>
              </div>
            </div>

            {/* top decorative shelf */}
            <DecorShelf seed={1} />
            <ShelfPlank />

            {/* the story shelves — June's real books, bathed in golden light */}
            {storyShelves.map((shelf, idx) => (
              <div key={idx} className="relative mt-4">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-6 -top-6 bottom-0 rounded-full blur-2xl"
                  style={{ background: "radial-gradient(closest-side, rgba(255,196,120,.18), transparent)" }}
                />
                <div className="relative flex items-end justify-center gap-2 px-3 sm:gap-3">
                  <span className="hidden items-end gap-2 self-end sm:flex">
                    <FillerBook seed={idx * 47 + 5} />
                    <Trinket kind="fern" />
                  </span>
                  {shelf.map((s) => (
                    <Book key={s.id} story={s} onOpen={onOpen} />
                  ))}
                  <span className="hidden items-end gap-2 self-end sm:flex">
                    <Trinket kind="teddy" />
                    <FillerBook seed={idx * 53 + 9} />
                  </span>
                </div>
                <ShelfPlank />
              </div>
            ))}

            {/* bottom decorative shelf */}
            <div className="mt-4">
              <DecorShelf seed={2} />
              <ShelfPlank />
            </div>
          </div>
        </div>

        {/* fireflies drifting in front of the case */}
        <div aria-hidden className="pointer-events-none absolute -inset-6 overflow-hidden">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${(i * 37 + 8) % 92}%`,
                top: `${(i * 29 + 10) % 86}%`,
                width: 4,
                height: 4,
                background: "#ffe9a8",
                boxShadow: "0 0 10px 3px rgba(255,224,130,.65)",
                animation: `firefly ${7 + (i % 4) * 1.6}s ease-in-out ${(i % 5) * 0.9}s infinite`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      </div>

      {/* mossy ground the case stands on */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-16 w-[140%] -translate-x-1/2 rounded-[100%] blur-sm"
        style={{ background: "radial-gradient(closest-side, rgba(34,60,38,.55), rgba(8,13,28,0))" }}
      />

      <p className="relative z-10 mt-10 pb-2 text-center text-xs text-amber-100/40">
        More stories are being written… ✨
      </p>

      <style>{`
        @keyframes float-mote{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes star-twinkle{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:.95;transform:scale(1.25)}}
        @keyframes aura-breathe{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:.9;transform:scale(1.12)}}
        @keyframes aurora-sway{0%,100%{transform:translateX(0) rotate(18deg)}50%{transform:translateX(26px) rotate(14deg)}}
        @keyframes lantern-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes firefly{
          0%,100%{transform:translate(0,0);opacity:.2}
          25%{transform:translate(14px,-18px);opacity:.9}
          50%{transform:translate(-8px,-30px);opacity:.5}
          75%{transform:translate(10px,-12px);opacity:.95}
        }
      `}</style>
    </main>
  );
}
