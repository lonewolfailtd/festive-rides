"use client";

// Scroll-scrubbed video: the scene's scroll progress drives the video's
// playhead, so scrolling forward plays the film and scrolling back rewinds
// it. Clips are re-encoded all-intra (every frame a keyframe) so seeking is
// frame-accurate and smooth — the technique behind the Apple-style pages.
//
// Falls back to the still image if the clip is missing or fails to load.

import { useRef, useState } from "react";
import Image from "next/image";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

export default function ScrubVideo({
  src,
  poster,
  progress,
  className = "",
  // Map this slice of the scene's pin progress onto the full clip.
  window: win = [0.05, 0.8],
}: {
  src: string;
  poster: string;
  progress: MotionValue<number>;
  className?: string;
  window?: [number, number];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const lastT = useRef(-1);

  useMotionValueEvent(progress, "change", (v) => {
    const el = videoRef.current;
    if (!el || failed || !el.duration || Number.isNaN(el.duration)) return;
    const [a, b] = win;
    const f = Math.min(1, Math.max(0, (v - a) / (b - a)));
    // Leave a hair off the end so we never hit the "ended" frame snap.
    const t = f * (el.duration - 0.05);
    if (Math.abs(t - lastT.current) > 0.02) {
      lastT.current = t;
      el.currentTime = t;
    }
  });

  if (failed) {
    return <Image src={poster} alt="" fill sizes="100vw" className={`object-cover ${className}`} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      playsInline
      preload="auto"
      onError={() => setFailed(true)}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
