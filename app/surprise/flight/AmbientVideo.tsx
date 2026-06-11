"use client";

// Ambient scene film for book 2 — adapted from June's book's AmbientVideo
// (books copy patterns out, never share mutable code). The scene's motion
// clip plays by itself as a muted loop:
//  - Only ONE orientation's media is mounted (decide with useIsDesktop in the
//    parent) so the hidden variant is never downloaded.
//  - An IntersectionObserver with a generous rootMargin starts buffering and
//    playing well BEFORE the scene pins, so it's already moving on arrival.
//  - Falls back to the poster still if the clip is missing or fails.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** true = desktop (md+), false = phone, null = not yet known (first paint). */
export function useIsDesktop(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setV(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return v;
}

export default function AmbientVideo({
  src,
  poster,
  priority = false,
  className = "",
}: {
  src: string;
  poster: string;
  priority?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || failed) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      // Start playing well before the scene is pinned on screen.
      { rootMargin: "60% 0px 60% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [failed]);

  if (failed) {
    return <Image src={poster} alt="" fill sizes="100vw" className={`object-cover ${className}`} />;
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay={priority}
      muted
      loop
      playsInline
      preload={priority ? "auto" : "metadata"}
      onError={() => setFailed(true)}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
