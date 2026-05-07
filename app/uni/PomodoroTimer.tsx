"use client";

// Floating pomodoro timer that lives in the uni layout, so it appears on
// every uni page and keeps ticking while the student moves between tools.
//
// Compact by default (rounded pill in the bottom-right). Click to expand
// to full controls. State persists across reloads via localStorage; we use
// a state-based hydration flag (NOT a ref) to avoid clobbering saved state
// on remount — see the long comment on `hydrated` below.

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
  const [expanded, setExpanded] = useState(false);

  // Hydration flag is STATE not ref. Refs update synchronously, which means
  // when both effects run in the same commit, the persist effect would see
  // hydrated.current=true (just set by the load effect) but state=defaultState
  // (because setState is async) and stamp the default into localStorage.
  // Using state means the persist effect's dep array still sees `hydrated:false`
  // on first run and skips, then re-runs with the loaded state in the next
  // render after both setStates are reconciled.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Persist on every state change — but ONLY after hydration, so we never
  // clobber saved state with the placeholder defaultState.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  // Sync across tabs / pages of the same site. If another tab updates
  // localStorage (e.g. starts the timer there), pick that change up here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as SavedState;
        if (parsed.endsAt) {
          parsed.remaining = Math.max(0, parsed.endsAt - Date.now());
        }
        setState(parsed);
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Tick while running. Compute remaining from endsAt rather than
  // decrementing — keeps the clock accurate even if the tab was
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
          const nextPhase: Phase = prev.phase === "focus" ? "break" : "focus";
          const nextDurationMs =
            nextPhase === "focus"
              ? prev.focusMins * 60_000
              : prev.breakMins * 60_000;
          // Subtle "ding" via Web Audio
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
            endsAt: null,
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
    setState((prev) => ({ ...prev, endsAt: Date.now() + prev.remaining }));
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
  const ringColour =
    state.phase === "focus"
      ? "stroke-sky-500"
      : "stroke-emerald-500";

  // SSR-safe: render nothing until mounted, so server HTML matches the
  // client's hydrated render.
  if (!hydrated) return null;

  // Compact pill (collapsed): bottom-right, click to expand.
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title={`${phaseLabel} · click to expand`}
        className={`fixed bottom-4 right-4 z-50 group flex items-center gap-2 rounded-full border bg-white/95 px-3 py-2 shadow-lg backdrop-blur transition-all hover:shadow-xl dark:bg-slate-900/95 ${
          isRunning
            ? state.phase === "focus"
              ? "border-sky-300 dark:border-sky-700"
              : "border-emerald-300 dark:border-emerald-700"
            : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="2.5"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              className={ringColour}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={62.83}
              strokeDashoffset={62.83 * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          </svg>
          {isRunning ? (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state.phase === "focus" ? "bg-sky-500" : "bg-emerald-500"
              } animate-pulse`}
              aria-hidden
            />
          ) : (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state.remaining < totalForPhase
                  ? "bg-amber-500"
                  : "bg-slate-400 dark:bg-slate-500"
              }`}
              aria-hidden
            />
          )}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatMs(state.remaining)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {state.phase}
        </span>
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Study session
          </p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            {phaseLabel} · {state.completedFocus} focus block
            {state.completedFocus === 1 ? "" : "s"} done today
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse"
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-3">
        <select
          value={`${state.focusMins}/${state.breakMins}`}
          onChange={(e) => {
            const [f, b] = e.target.value.split("/").map(Number);
            setDurations(f, b);
          }}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="25/5">25 / 5 (classic)</option>
          <option value="50/10">50 / 10 (deep)</option>
          <option value="15/3">15 / 3 (short)</option>
          <option value="45/15">45 / 15 (long)</option>
        </select>
      </div>

      <div className="mt-3 flex items-baseline justify-center gap-3">
        <span className="font-mono text-5xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatMs(state.remaining)}
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
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-2 text-sm font-medium text-white hover:from-amber-400 hover:to-amber-500"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-b ${phaseColour} px-4 py-2 text-sm font-medium text-white hover:-translate-y-px transition-all`}
          >
            {state.remaining < totalForPhase ? "Resume" : `Start ${phaseLabel.toLowerCase()}`}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={skipPhase}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
        >
          Skip to {state.phase === "focus" ? "break" : "focus"}
        </button>
      </div>
    </div>
  );
}
