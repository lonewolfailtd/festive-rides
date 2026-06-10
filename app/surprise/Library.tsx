"use client";

// Library — holds the bookshelf and the open story. Selecting a published
// book animates it open into the scroll-story; a back button returns to the
// shelf. New stories slot in via the registry with no changes here.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Bookshelf from "./Bookshelf";
import SmoothScroll from "./SmoothScroll";
import Story from "./Story";
import { getStory } from "./stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

function StoryPlayer({ id }: { id: string }) {
  // June has a fully bespoke story; future ids render here too once built.
  if (id === "june") {
    return (
      <SmoothScroll>
        <Story />
      </SmoothScroll>
    );
  }
  const meta = getStory(id);
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#0b1020] px-6 text-center text-white/70" style={FONT}>
      <p>“{meta?.title ?? "This story"}” is still being written… ✨</p>
    </div>
  );
}

export default function Library() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AnimatePresence mode="wait">
      {openId === null ? (
        <motion.div
          key="shelf"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4 }}
        >
          <Bookshelf onOpen={setOpenId} />
        </motion.div>
      ) : (
        <motion.div
          key={`story-${openId}`}
          initial={{ opacity: 0, rotateY: -12, scale: 0.96 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ transformPerspective: 1200 }}
        >
          {/* Back-to-shelf button */}
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="fixed left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60"
            style={FONT}
          >
            ← Shelf
          </button>
          <StoryPlayer id={openId} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
