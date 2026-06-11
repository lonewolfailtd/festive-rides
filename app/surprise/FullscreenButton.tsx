"use client";

// Shared fullscreen toggle — shown on the shelf and every story page.
// Browsers only grant fullscreen from a user tap, and iPhones don't support
// the API at all for webpages, so the button hides itself when unsupported
// (iOS readers simply keep Safari's chrome).

import { useEffect, useState } from "react";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

export function supportsFullscreen(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function" &&
    document.fullscreenEnabled !== false
  );
}

/** Best-effort enter; safe to call from any user-gesture handler. */
export function enterFullscreen(): void {
  if (!supportsFullscreen() || document.fullscreenElement) return;
  void document.documentElement.requestFullscreen().catch(() => {});
}

export default function FullscreenButton() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(supportsFullscreen());
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Exit full screen" : "Full screen"}
      title={active ? "Exit full screen" : "Full screen"}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60"
      style={FONT}
    >
      <span aria-hidden className="text-base leading-none">
        {active ? "⤢" : "⛶"}
      </span>
      <span className="hidden sm:inline">{active ? "Exit" : "Full screen"}</span>
    </button>
  );
}
