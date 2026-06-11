"use client";

// Shared fullscreen toggle — shown on the shelf and every story page.
// Browsers only grant fullscreen from a user tap, and iPhones don't support
// the API at all for webpages, so the button hides itself when unsupported
// (iOS readers simply keep Safari's chrome).

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

/* ------------------------------------------------------------- Prompt -- */
// Soft centred pop-up so readers who'd never spot the corner button still
// get the hint. Shows once per visit (sessionStorage), only where fullscreen
// is actually supported, and never while already fullscreen.
const PROMPT_KEY = "surprise-fs-prompt-v1";

export function FullscreenPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!supportsFullscreen() || document.fullscreenElement) return;
    try {
      if (window.sessionStorage.getItem(PROMPT_KEY)) return;
    } catch {}
    const t = window.setTimeout(() => setShow(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = (goFullscreen: boolean) => {
    try {
      window.sessionStorage.setItem(PROMPT_KEY, "1");
    } catch {}
    setShow(false);
    if (goFullscreen) enterFullscreen();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-6 backdrop-blur-[2px]"
          style={FONT}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-white/15 bg-[#10162e]/95 px-6 py-6 text-center shadow-[0_18px_50px_rgba(0,0,0,.6)]"
          >
            <span className="text-3xl" aria-hidden>⛶</span>
            <p className="text-lg font-semibold text-white">Best watched in full screen</p>
            <p className="text-sm text-white/65">For the full storybook magic ✨</p>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="mt-1 w-full rounded-full bg-gradient-to-b from-sky-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-95"
            >
              Go full screen
            </button>
            <button
              type="button"
              onClick={() => dismiss(false)}
              className="text-xs text-white/50 transition hover:text-white/80"
            >
              maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
