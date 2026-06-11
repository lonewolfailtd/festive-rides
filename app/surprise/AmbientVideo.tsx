"use client";

// Ambient scene film — plays by itself like the moon cover. Tuned for fast
// starts:
//  - Only ONE orientation's video is ever mounted (use useIsDesktop in the
//    parent) so we don't download the hidden variant.
//  - An IntersectionObserver with a generous rootMargin starts buffering and
//    playing ~60% of a viewport BEFORE the scene arrives, so it's already
//    moving when it pins.
//  - `priority` (for the cover) = autoplay + eager preload for instant start.
//  - Falls back to the poster still if the clip is missing/fails.

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
