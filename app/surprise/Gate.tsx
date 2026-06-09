"use client";

// Passcode gate for the storybook. Posts the code to the server-side
// /surprise/unlock route (so the real code never ships to the browser).

import { useState } from "react";

export default function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setChecking(true);
    try {
      const res = await fetch("/surprise/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        try {
          window.localStorage.setItem("surprise-unlocked-v1", "1");
        } catch {}
        onUnlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1020] px-6 text-center"
      style={{ fontFamily: "var(--font-fredoka), system-ui, sans-serif" }}
    >
      {/* Soft starfield glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-500/30 via-sky-500/10 to-transparent blur-3xl"
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-5xl" aria-hidden>
          🌿✨
        </div>
        <h1 className="text-2xl font-semibold text-white">A little surprise</h1>
        <p className="mt-2 text-sm text-white/60">
          Enter the family passcode to come inside.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <input
            type="password"
            inputMode="text"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            placeholder="Passcode"
            aria-label="Passcode"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-wide text-white placeholder-white/30 outline-none transition focus:border-sky-400/70 focus:ring-4 focus:ring-sky-400/15"
          />
          {error && (
            <p className="text-sm text-rose-300">That&apos;s not quite it — try again.</p>
          )}
          <button
            type="submit"
            disabled={checking || !code.trim()}
            className="w-full rounded-2xl bg-gradient-to-b from-sky-400 to-indigo-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {checking ? "Opening…" : "Open the surprise"}
          </button>
        </form>
      </div>
    </main>
  );
}
