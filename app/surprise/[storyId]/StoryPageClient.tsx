"use client";

// One book's page. Honours the same passcode gate as the shelf (so deep
// links stay private when the gate is re-enabled), then plays the story.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Gate from "../Gate";
import StoryPlayer from "../StoryPlayer";
import { GATE_ENABLED, UNLOCK_KEY } from "../gate-config";
import { getCompleted, getPlayed, markCompleted, markPlayed } from "../progress";
import { getStory } from "../stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

export default function StoryPageClient({ id }: { id: string }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(GATE_ENABLED ? null : true);
  // First time this browser opens this book: show the "press play"
  // instructions, and record the visit (which also unlocks the shelf).
  const [showHelp, setShowHelp] = useState(false);
  // Until this book has been watched to the end once, manual scrolling is
  // locked: press play and watch. Playback scrolls programmatically, which
  // these blockers don't touch; reaching the end records completion.
  const [scrollLocked, setScrollLocked] = useState(false);

  useEffect(() => {
    if (getStory(id)?.status !== "published") return;
    if (!getPlayed().includes(id)) setShowHelp(true);
    if (!getCompleted().includes(id)) setScrollLocked(true);
    markPlayed(id);
  }, [id]);

  useEffect(() => {
    if (!scrollLocked) return;

    const block = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const SCROLL_KEYS = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"];
    const blockKeys = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.includes(e.key)) block(e);
    };
    window.addEventListener("wheel", block, { capture: true, passive: false });
    window.addEventListener("touchmove", block, { capture: true, passive: false });
    window.addEventListener("keydown", blockKeys, { capture: true });

    // Completed = playback reached the end of the story.
    const finished = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 200 && window.scrollY >= max - 60;
    };
    const check = () => {
      if (!finished()) return;
      markCompleted(id);
      setScrollLocked(false);
    };
    window.addEventListener("scroll", check, { passive: true });
    const poll = window.setInterval(check, 500);

    return () => {
      window.removeEventListener("wheel", block, { capture: true });
      window.removeEventListener("touchmove", block, { capture: true });
      window.removeEventListener("keydown", blockKeys, { capture: true });
      window.removeEventListener("scroll", check);
      window.clearInterval(poll);
    };
  }, [scrollLocked, id]);

  useEffect(() => {
    if (!GATE_ENABLED) return;
    let ok = false;
    try {
      ok = window.localStorage.getItem(UNLOCK_KEY) === "1";
    } catch {}
    setUnlocked(ok);
  }, []);

  if (unlocked === null) {
    return <div className="min-h-screen bg-[#0b1020]" />;
  }

  if (!unlocked) {
    return <Gate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <>
      {/* Back to the bookcase — outside the transformed wrapper so `fixed`
          works. This label is deliberate; keep it "Juniper's Bookcase" on
          every book. */}
      <Link
        href="/surprise"
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60"
        style={FONT}
      >
        ← Juniper&apos;s Bookcase
      </Link>

      {/* Same book-opening flourish the in-place player had. NOTE for book
          authors: this wrapper keeps a persistent transformPerspective, so
          `position: fixed` inside your story must go through a portal — see
          flight/FlightStory.tsx's Controls. */}
      <motion.div
        initial={{ opacity: 0, rotateY: -12, scale: 0.96 }}
        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ transformPerspective: 1200 }}
      >
        <StoryPlayer id={id} />
      </motion.div>

      {/* first-time instructions — tap anywhere to dismiss */}
      {showHelp && (
        <button
          type="button"
          onClick={() => setShowHelp(false)}
          aria-label="Dismiss instructions"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          style={FONT}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mx-6 flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-amber-200/30 bg-[#2b1a0c]/95 px-7 py-6 text-center shadow-[0_18px_50px_rgba(0,0,0,.7)]"
          >
            <span className="text-4xl">📖</span>
            <span className="text-lg font-semibold text-amber-50">Ready for the story?</span>
            <span className="text-sm leading-relaxed text-amber-100/85">
              Press the <span className="font-semibold text-amber-300">▶ play</span> button, then sit back
              and watch the story unfold.
            </span>
            <span className="text-xs leading-relaxed text-amber-100/60">
              Scrolling unlocks after you&apos;ve watched it through once.
            </span>
            <span className="mt-1.5 rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-[#2b1a0c] shadow-md">
              Got it!
            </span>
          </motion.span>
        </button>
      )}
    </>
  );
}
