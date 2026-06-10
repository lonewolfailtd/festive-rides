"use client";

// The animated bookshelf — the story picker. Each book is a 3D-ish spine
// standing on a warm wooden shelf. Hover lifts + tilts a book out; clicking a
// published book opens its story. "Coming soon" books are sealed.

import { motion } from "framer-motion";
import { STORIES, type StoryMeta } from "./stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

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
      style={{ height: story.height, ...FONT }}
      aria-label={published ? `Open ${story.title}` : `${story.title} — coming soon`}
    >
      {/* The spine */}
      <div
        className="relative flex h-full w-[52px] flex-col items-center justify-between overflow-hidden rounded-[4px] px-1.5 py-3 sm:w-[64px]"
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
          className="flex-1 py-2 text-center text-[12px] font-semibold leading-tight tracking-wide sm:text-[13px]"
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
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-200">
          ✨ soon
        </span>
      )}
      {/* glow under a hovered published book */}
      {published && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-12 -translate-x-1/2 rounded-full bg-sky-400/0 blur-md transition-all duration-300 group-hover:bg-sky-400/40" />
      )}
    </motion.button>
  );
}

export default function Bookshelf({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <main
      className="relative min-h-[100svh] overflow-hidden bg-gradient-to-b from-[#2a1d13] via-[#1c130c] to-[#120b07] px-4 py-12"
      style={FONT}
    >
      {/* warm overhead light */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,196,120,.28), transparent)" }}
      />
      {/* drifting dust motes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-100"
            style={{
              left: `${(i * 41) % 100}%`,
              top: `${(i * 27) % 100}%`,
              width: 2 + ((i * 5) % 4),
              height: 2 + ((i * 5) % 4),
              opacity: 0.12 + ((i * 9) % 30) / 100,
              animation: `float-mote ${6 + (i % 5)}s ease-in-out ${(i % 7) * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-200/70">Welcome to</p>
        <h1 className="mt-2 text-4xl font-bold text-amber-50 drop-shadow-[0_2px_16px_rgba(0,0,0,.6)] sm:text-5xl">
          June&apos;s Library
        </h1>
        <p className="mt-2 text-sm text-amber-100/60">Pick a book off the shelf to begin.</p>
      </div>

      {/* The shelf */}
      <div className="relative mx-auto mt-14 max-w-3xl">
        <div className="flex items-end justify-center gap-2 sm:gap-3">
          {STORIES.map((s) => (
            <Book key={s.id} story={s} onOpen={onOpen} />
          ))}
        </div>
        {/* wooden plank */}
        <div
          className="mx-auto h-5 w-full max-w-2xl rounded-[3px]"
          style={{
            background: "linear-gradient(180deg,#6b4423,#3d2614)",
            boxShadow: "0 14px 26px rgba(0,0,0,.6), inset 0 2px 0 rgba(255,210,150,.25)",
          }}
        />
        <div className="mx-auto h-3 w-[96%] max-w-2xl rounded-b-[6px] bg-black/40 blur-[1px]" />
      </div>

      <p className="relative mt-12 text-center text-xs text-amber-100/40">
        More stories are being written… ✨
      </p>

      <style>{`@keyframes float-mote{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>
    </main>
  );
}
