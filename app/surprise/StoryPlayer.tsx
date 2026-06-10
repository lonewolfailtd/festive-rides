"use client";

// StoryPlayer — renders one book by id. Every book gets its own page at
// /surprise/<id>; new books add ONE `if (id === "...")` branch here.

import SmoothScroll from "./SmoothScroll";
import Story from "./Story";
import FlightStory from "./flight/FlightStory";
import PlaybackProvider from "./flight/PlaybackProvider";
import { getStory } from "./stories/registry";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

export default function StoryPlayer({ id }: { id: string }) {
  // June has a fully bespoke story; future ids render here too once built.
  if (id === "june") {
    return (
      <SmoothScroll>
        <Story />
      </SmoothScroll>
    );
  }
  // "The Fantail Who Flew Her Home" — owns its own Lenis + audio inside
  // PlaybackProvider, so it is NOT wrapped in <SmoothScroll>.
  if (id === "flight") {
    return (
      <PlaybackProvider>
        <FlightStory />
      </PlaybackProvider>
    );
  }
  const meta = getStory(id);
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#0b1020] px-6 text-center text-white/70" style={FONT}>
      <p>“{meta?.title ?? "This story"}” is still being written… ✨</p>
    </div>
  );
}
