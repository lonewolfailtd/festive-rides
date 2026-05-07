"use client";

// Compact pomodoro timer for the dashboard. State persists across reloads via
// localStorage so a session keeps running visually if the student navigates
// between tools. Keeps the public surface tiny — no settings UI, just the
// classic 25/5 cadence (configurable via two button presses).

import { useEffect, useRef, useState } from "react";

type Phase = "focus" | "break";

const FOCUS_MINUTES_DEFAULT = 25;
const BREAK_MINUTES_DEFAULT = 5;

const STORAGE_KEY = "uni-pomodoro-v1";

type SavedState = {
  phase: Phase;
  remaining: number; // ms
  endsAt: number | null; // epoch ms when current run will end (null if paused)
  completedFocus: number;
  focusMins: number;
  breakMins: number;
};

const defaultState = (): SavedState => ({
  phase: "focus",
  remaining: FOCUS_MINUTES_DEFAULT * 60_000,
  endsAt: null,
  completedFocus: 0,
  focusMins: FOCUS_MINUTES_DEFAULT,
  breakMins: BREAK_MINUTES_DEFAULT,
});

function loadState(): SavedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as SavedState;
    // If a run was active, recompute remaining from endsAt so a tab reload
    // doesn't reset the clock.
    if (parsed.endsAt) {
      const remaining = Math.max(0, parsed.endsAt - Date.now());
      return { ...parsed, remaining };
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

const formatMs = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function PomodoroTimer() {
  const [state, setState] = useState<SavedState>(defaultState);
  const tickRef = useRef<number | null>(null);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setState(loadState());
  }, []);

  // Persist on every state change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Tick while running. We compute remaining from endsAt rather than
  // decrementing — that keeps the clock accurate even if the tab was
  // backgrounded (browsers throttle setInterval).
  useEffect(() => {
    if (!state.endsAt) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    const tick = () => {
      setState((prev) => {
        if (!prev.endsAt) return prev;
        const remaining = Math.max(0, prev.endsAt - Date.now());
        if (remaining <= 0) {
          // Phase complete — flip phase and either auto-start break, or stop.
          const nextPhase: Phase = prev.phase === "focus" ? "break" : "focus";
          const nextDurationMs =
            nextPhase === "focus"
              ? prev.focusMins * 60_000
              : prev.breakMins * 60_000;
          // Subtle "ding" via Web Audio so the student knows time's up
          try {
            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = nextPhase === "break" ? 660 : 880;
              osc.connect(gain);
              gain.connect(ctx.destination);
              gain.gain.setValueAtTime(0.001, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
              osc.start();
              osc.stop(ctx.currentTime + 0.65);
            }
          } catch {}
          return {
            ...prev,
            phase: nextPhase,
            remaining: nextDurationMs,
            endsAt: null, // pause at phase boundary; student presses Start to continue
            completedFocus:
              prev.phase === "focus" ? prev.completedFocus + 1 : prev.completedFocus,
          };
        }
        return { ...prev, remaining };
      });
    };
    tickRef.current = window.setInterval(tick, 250);
    tick();
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.endsAt]);

  const isRunning = state.endsAt !== null;
  const totalForPhase =
    (state.phase === "focus" ? state.focusMins : state.breakMins) * 60_000;
  const progress = 1 - state.remaining / totalForPhase;

  const start = () => {
    setState((prev) => ({
      ...prev,
      endsAt: Date.now() + prev.remaining,
    }));
  };
  const pause = () => {
    setState((prev) => {
      if (!prev.endsAt) return prev;
      return { ...prev, endsAt: null, remaining: Math.max(0, prev.endsAt - Date.now()) };
    });
  };
  const reset = () => {
    setState((prev) => ({
      ...prev,
      remaining: (prev.phase === "focus" ? prev.focusMins : prev.breakMins) * 60_000,
      endsAt: null,
    }));
  };
  const skipPhase = () => {
    setState((prev) => {
      const nextPhase: Phase = prev.phase === "focus" ? "break" : "focus";
      return {
        ...prev,
        phase: nextPhase,
        remaining: (nextPhase === "focus" ? prev.focusMins : prev.breakMins) * 60_000,
        endsAt: null,
      };
    });
  };
  const setDurations = (focus: number, breakMins: number) => {
    setState((prev) => {
      // If we change duration mid-pause, also reset remaining for the
      // current phase so the display matches.
      const remaining =
        prev.phase === "focus" ? focus * 60_000 : breakMins * 60_000;
      return { ...prev, focusMins: focus, breakMins, remaining, endsAt: null };
    });
  };

  const phaseLabel = state.phase === "focus" ? "Focus" : "Break";
  const phaseColour =
    state.phase === "focus"
      ? "from-sky-500 to-sky-600"
      : "from-emerald-500 to-emerald-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Study session
          </p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            {phaseLabel} · {state.completedFocus} focus block
            {state.completedFocus === 1 ? "" : "s"} done today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={`${state.focusMins}/${state.breakMins}`}
            onChange={(e) => {
              const [f, b] = e.target.value.split("/").map(Number);
              setDurations(f, b);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-sky-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="25/5">25 / 5 (classic)</option>
            <option value="50/10">50 / 10 (deep)</option>
            <option value="15/3">15 / 3 (short)</option>
            <option value="45/15">45 / 15 (long)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-center gap-3">
        <span className="font-mono text-5xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatMs(state.remaining)}
        </span>
        <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {state.phase}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full bg-gradient-to-r ${phaseColour} transition-all duration-300`}
          style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isRunning ? (
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:from-amber-400 hover:to-amber-500"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-b ${phaseColour} px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px`}
          >
            {state.remaining < totalForPhase ? "Resume" : `Start ${phaseLabel.toLowerCase()}`}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={skipPhase}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
        >
          Skip to {state.phase === "focus" ? "break" : "focus"}
        </button>
      </div>
    </div>
  );
}
