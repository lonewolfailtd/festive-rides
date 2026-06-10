"use client";

// The enchanted bookcase — the story picker. The scene is a painted
// illustration (generated with fal.ai, Nano Banana Pro) of a floor-to-ceiling
// bookcase in a moonlit forest with one EMPTY middle shelf. June's real,
// clickable storybook spines are composited onto that empty shelf.
//
// The painting is shown inside an aspect-ratio-locked box (object-fill), so
// the shelf's % coordinates below always line up exactly; the letterbox
// around it is filled with a blurred copy of the same art.

import { motion } from "framer-motion";
import { STORIES, type StoryMeta } from "./stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

// Painted spine cutouts (fal.ai, blank — titles are overlaid in the DOM).
// aspect = image width / height, from the cropped PNGs. Books without an
// entry here fall back to a CSS-gradient spine.
const SPINE_ART: Record<string, { src: string; aspect: number }> = {
  june: { src: "/surprise/library/spines/june.png", aspect: 285 / 1224 },
  flight: { src: "/surprise/library/spines/flight.png", aspect: 276 / 1279 },
  "sleepy-kiwi": { src: "/surprise/library/spines/sleepy-kiwi.png", aspect: 330 / 1247 },
  "pukeko-rainbow": { src: "/surprise/library/spines/pukeko-rainbow.png", aspect: 363 / 1212 },
  "up-the-maunga": { src: "/surprise/library/spines/up-the-maunga.png", aspect: 369 / 1247 },
};

// % coordinates of the empty middle shelf opening inside each painting.
// left/right/top = inner edges of the opening; bottom = the shelf board the
// books stand on. Tuned by eye against the actual pixels — keep in sync if
// the art is ever regenerated.
const SCENES = {
  portrait: {
    src: "/surprise/library/shelf-portrait.png",
    ar: "768 / 1376",
    arNum: 768 / 1376,
    shelf: { left: 16, right: 84, top: 40, bottom: 63 },
    spineFont: "clamp(7px, 1.15svh, 11px)",
  },
  landscape: {
    src: "/surprise/library/shelf-landscape.png",
    ar: "1376 / 768",
    arNum: 1376 / 768,
    shelf: { left: 24, right: 76, top: 39, bottom: 72.8 },
    spineFont: "clamp(9px, 1.6svh, 14px)",
  },
} as const;

function Book({ story, onOpen }: { story: StoryMeta; onOpen: (id: string) => void }) {
  const published = story.status === "published";
  // Registry heights (290–320px) become a fraction of the shelf opening.
  const heightPct = Math.min(100, (story.height / 345) * 100);
  return (
    <motion.button
      type="button"
      disabled={!published}
      onClick={() => published && onOpen(story.id)}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      whileHover={
        published
          ? { y: "-7%", rotateZ: -3, transition: { type: "spring", stiffness: 300, damping: 18 } }
          : { y: "-2%" }
      }
      className="group relative flex shrink-0 items-end outline-none"
      style={{ height: `${heightPct}%`, ...FONT }}
      aria-label={published ? `Open ${story.title}` : `${story.title} — coming soon`}
    >
      {/* The spine — painted art when we have it, CSS gradient otherwise */}
      {SPINE_ART[story.id] ? (
        <div
          className="relative h-full"
          style={{
            aspectRatio: `${SPINE_ART[story.id].aspect}`,
            filter: published
              ? "drop-shadow(0 6px 10px rgba(0,0,0,.55))"
              : "saturate(.55) brightness(.8) drop-shadow(0 6px 10px rgba(0,0,0,.55))",
          }}
        >
          <img src={SPINE_ART[story.id].src} alt="" className="h-full w-full object-fill" />
          {/* title overlaid between the painted gold bands */}
          <span
            className="absolute inset-x-0 flex items-center justify-center overflow-hidden text-center font-semibold leading-tight tracking-wide"
            style={{
              top: "11%",
              bottom: "11%",
              color: story.ink,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontSize: "var(--spine-font, clamp(8px, 1.6svh, 14px))",
              textShadow: "0 1px 3px rgba(0,0,0,.65)",
            }}
          >
            {story.title}
          </span>
        </div>
      ) : (
        <div
          className="relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[3px] px-[8%] py-[5%]"
          style={{
            aspectRatio: "62 / 320",
            background: `linear-gradient(160deg, ${story.spineFrom}, ${story.spineTo})`,
            boxShadow:
              "inset 3px 0 6px rgba(255,255,255,.18), inset -4px 0 10px rgba(0,0,0,.45), 0 6px 14px rgba(0,0,0,.55)",
            filter: published ? "none" : "saturate(.55) brightness(.8)",
          }}
        >
          <span className="h-[2px] w-3/5 rounded-full sm:h-[3px]" style={{ background: story.ink, opacity: 0.7 }} />
          <span
            className="flex-1 overflow-hidden py-1 text-center font-semibold leading-tight tracking-wide"
            style={{
              color: story.ink,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontSize: "var(--spine-font, clamp(8px, 1.6svh, 14px))",
            }}
          >
            {story.title}
          </span>
          <span className="h-[2px] w-3/5 rounded-full sm:h-[3px]" style={{ background: story.ink, opacity: 0.7 }} />
          <span className="absolute right-0 top-0 h-full w-[8%] bg-gradient-to-l from-amber-50/80 to-transparent" />
        </div>
      )}

      {/* coming-soon seal */}
      {!published && (
        <span
          className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 py-0.5 font-medium uppercase tracking-wider text-amber-200"
          style={{ fontSize: "clamp(6px, 1.1svh, 9px)" }}
        >
          ✨ soon
        </span>
      )}
      {/* glow under a hovered published book */}
      {published && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 h-[5%] w-full -translate-x-1/2 rounded-full bg-amber-300/0 blur-md transition-all duration-300 group-hover:bg-amber-300/60" />
      )}
    </motion.button>
  );
}

/** One orientation of the painted scene with the books composited in. */
function Scene({
  kind,
  className,
  onOpen,
}: {
  kind: keyof typeof SCENES;
  className: string;
  onOpen: (id: string) => void;
}) {
  const scene = SCENES[kind];
  const { left, right, top, bottom } = scene.shelf;
  return (
    <div className={`${className} absolute inset-0 items-center justify-center`}>
      {/* blurred art fills whatever the painting itself doesn't cover */}
      <img
        src={scene.src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[.55]"
      />

      {/* the painting, aspect-locked so shelf coordinates never drift */}
      <div
        className="relative"
        style={{
          aspectRatio: scene.ar,
          width: `min(100vw, calc(100svh * ${scene.arNum}))`,
          ["--spine-font" as string]: scene.spineFont,
        }}
      >
        <img src={scene.src} alt="A magical bookcase in a moonlit forest" className="h-full w-full object-fill" />

        {/* warm breathing light inside the empty shelf */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[50%] blur-xl"
          style={{
            left: `${left}%`,
            right: `${100 - right}%`,
            top: `${top}%`,
            bottom: `${100 - bottom}%`,
            background: "radial-gradient(closest-side, rgba(255,196,110,.30), transparent)",
            animation: "shelf-breathe 5s ease-in-out infinite",
          }}
        />

        {/* June's books, standing on the painted shelf */}
        <div
          className="absolute flex items-end justify-center gap-[1.5%]"
          style={{
            left: `${left}%`,
            right: `${100 - right}%`,
            top: `${top}%`,
            bottom: `${100 - bottom}%`,
          }}
        >
          {STORIES.map((s) => (
            <Book key={s.id} story={s} onOpen={onOpen} />
          ))}
        </div>

        {/* a few extra fireflies drifting over the painting */}
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${(i * 37 + 11) % 90}%`,
              top: `${(i * 29 + 16) % 70}%`,
              width: 4,
              height: 4,
              background: "#ffe9a8",
              boxShadow: "0 0 10px 3px rgba(255,224,130,.6)",
              animation: `firefly ${7 + (i % 4) * 1.6}s ease-in-out ${(i % 5) * 0.9}s infinite`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Bookshelf({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#0a1124]" style={FONT}>
      {/* phones get the portrait painting, larger screens the landscape one */}
      <Scene kind="portrait" className="flex md:hidden" onOpen={onOpen} />
      <Scene kind="landscape" className="hidden md:flex" onOpen={onOpen} />

      {/* title floating in the night sky */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 text-center sm:top-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/80 sm:text-xs">Welcome to</p>
        <h1
          className="mt-1 text-3xl font-bold text-amber-50 sm:text-4xl"
          style={{ textShadow: "0 2px 14px rgba(0,0,0,.75), 0 0 30px rgba(255,214,140,.4)" }}
        >
          June&apos;s Library
        </h1>
        <p className="mt-1 text-xs text-amber-100/70 sm:text-sm">Pick a book off the shelf to begin.</p>
      </div>

      <p className="absolute inset-x-0 bottom-2 z-10 text-center text-[10px] text-amber-100/50 sm:text-xs">
        More stories are being written… ✨
      </p>

      <style>{`
        @keyframes shelf-breathe{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes firefly{
          0%,100%{transform:translate(0,0);opacity:.15}
          25%{transform:translate(14px,-18px);opacity:.85}
          50%{transform:translate(-8px,-30px);opacity:.4}
          75%{transform:translate(10px,-12px);opacity:.9}
        }
      `}</style>
    </main>
  );
}
