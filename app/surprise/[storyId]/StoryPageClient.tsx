"use client";

// One book's page. Honours the same passcode gate as the shelf (so deep
// links stay private when the gate is re-enabled), then plays the story.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Gate from "../Gate";
import StoryPlayer from "../StoryPlayer";
import { GATE_ENABLED, UNLOCK_KEY } from "../gate-config";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

export default function StoryPageClient({ id }: { id: string }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(GATE_ENABLED ? null : true);

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
      {/* Back to the shelf — outside the transformed wrapper so `fixed` works */}
      <Link
        href="/surprise"
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60"
        style={FONT}
      >
        ← Shelf
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
    </>
  );
}
