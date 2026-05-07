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
  notificationsEnabled: boolean;
  // 0–1 multiplier on the chime peak gain. 0 mutes the chime entirely.
  // Default 0.5 → peak ~0.22 (matches the previous hardcoded default).
  volume: number;
};

const DEFAULT_VOLUME = 0.5;

const defaultState = (): SavedState => ({
  phase: "focus",
  remaining: FOCUS_MINUTES_DEFAULT * 60_000,
  endsAt: null,
  completedFocus: 0,
  focusMins: FOCUS_MINUTES_DEFAULT,
  breakMins: BREAK_MINUTES_DEFAULT,
  notificationsEnabled: false,
  volume: DEFAULT_VOLUME,
});

// Play a 3-note arpeggio rather than a single beep. Sounds more like "time
// is up" and less like a phone alert. Different chords for focus→break vs
// break→focus so the student can tell them apart with their eyes shut.
//
// Note: each oscillator gets its own AudioContext rather than sharing — on
// mobile Safari, AudioContexts can fall asleep between phases and the new
// session needs a fresh context to play.
function playChime(forPhase: Phase, volume = DEFAULT_VOLUME) {
  // 0 = muted; skip the audio context entirely
  if (volume <= 0) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const notes =
      forPhase === "break"
        ? [523.25, 659.25, 783.99] // C5 E5 G5
        : [392.0, 523.25, 659.25]; // G4 C5 E5

    const noteDuration = 0.45;
    const noteOverlap = 0.18;
    // Volume curve: slider 0–1 → gain peak 0–0.6. Above ~0.6 the sine starts
    // to clip noticeably on most laptop speakers, so we cap the slope.
    const peakGain = Math.max(0.0001, Math.min(0.6, volume * 0.6));

    notes.forEach((freq, i) => {
      const startAt = ctx.currentTime + i * (noteDuration - noteOverlap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + noteDuration);
      osc.start(startAt);
      osc.stop(startAt + noteDuration + 0.05);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, (notes.length * (noteDuration - noteOverlap) + noteDuration + 0.2) * 1000);
  } catch {
    // ignore — audio is best-effort
  }
}

function fireNotification(forPhase: Phase, completedFocus: number): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const title =
      forPhase === "break"
        ? "Break time"
        : "Back to it";
    const body =
      forPhase === "break"
        ? `Focus block done${completedFocus > 0 ? ` (${completedFocus} today)` : ""}. Stretch, water, look out a window.`
        : "Break's up. Click to dismiss and start the next focus block.";
    // `renotify` and `badge` are valid options that browsers honour but
    // aren't yet in TypeScript's NotificationOptions lib type. Cast through
    // a permissive shape so the build doesn't reject them.
    const opts = {
      body,
      tag: "uni-pomodoro",
      renotify: true,
      requireInteraction: true,
      icon: "/uni-icon.svg",
      badge: "/uni-icon.svg",
      silent: false,
    } as NotificationOptions;
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}

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
          const newCompleted =
            prev.phase === "focus" ? prev.completedFocus + 1 : prev.completedFocus;
          // 3-note arpeggio at the user's chosen volume
          playChime(nextPhase, prev.volume);
          // OS-level notification (require interaction so it doesn't auto-dismiss)
          if (prev.notificationsEnabled) {
            fireNotification(nextPhase, newCompleted);
          }
          // Flash the tab title so a backgrounded tab still gets her attention
          try {
            const orig = document.title;
            const flashTitle =
              nextPhase === "break" ? "⏰ BREAK · Uni" : "⏰ FOCUS · Uni";
            let flashing = true;
            let i = 0;
            const flash = window.setInterval(() => {
              document.title = i % 2 === 0 ? flashTitle : orig;
              i++;
              if (i > 10 || !flashing) {
                window.clearInterval(flash);
                document.title = orig;
              }
            }, 700);
            // Stop flashing as soon as the page is focused again
            const stop = () => {
              flashing = false;
              window.clearInterval(flash);
              document.title = orig;
              window.removeEventListener("focus", stop);
              document.removeEventListener("visibilitychange", stop);
            };
            window.addEventListener("focus", stop);
            document.addEventListener("visibilitychange", stop);
          } catch {}
          return {
            ...prev,
            phase: nextPhase,
            remaining: nextDurationMs,
            endsAt: null,
            completedFocus: newCompleted,
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
        className={`fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 group flex items-center gap-1.5 sm:gap-2 rounded-full border bg-white/95 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-lg backdrop-blur transition-all hover:shadow-xl dark:bg-slate-900/95 ${
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

      <div className="mt-3 flex items-center gap-2">
        <select
          value={`${state.focusMins}/${state.breakMins}`}
          onChange={(e) => {
            const [f, b] = e.target.value.split("/").map(Number);
            setDurations(f, b);
          }}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="25/5">25 / 5 (classic)</option>
          <option value="50/10">50 / 10 (deep)</option>
          <option value="15/3">15 / 3 (short)</option>
          <option value="45/15">45 / 15 (long)</option>
        </select>
        <button
          type="button"
          onClick={async () => {
            /* notifications toggle */
            // If turning OFF, just toggle.
            if (state.notificationsEnabled) {
              setState((p) => ({ ...p, notificationsEnabled: false }));
              return;
            }
            // Need to ask permission. Browsers only prompt once — if denied,
            // they remember and we can't re-prompt. Fall back to chime + tab
            // flash in that case.
            if (typeof Notification === "undefined") return;
            if (Notification.permission === "granted") {
              setState((p) => ({ ...p, notificationsEnabled: true }));
              return;
            }
            if (Notification.permission === "denied") {
              alert(
                "Notifications are blocked in your browser settings for this site. Look for the lock icon in the address bar to allow them."
              );
              return;
            }
            try {
              const result = await Notification.requestPermission();
              if (result === "granted") {
                setState((p) => ({ ...p, notificationsEnabled: true }));
                // Test ping so she knows it works
                new Notification("Notifications enabled", {
                  body: "I'll ping you when each focus block or break ends.",
                  tag: "uni-pomodoro-test",
                  icon: "/uni-icon.svg",
                });
              }
            } catch {}
          }}
          title={
            state.notificationsEnabled
              ? "Click to turn off"
              : "Click to ask your browser for permission"
          }
          className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
            state.notificationsEnabled
              ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          }`}
        >
          {state.notificationsEnabled ? "🔔 On" : "🔕 Off"}
        </button>
      </div>

      {/* Volume slider + test chime */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setState((p) => ({ ...p, volume: p.volume > 0 ? 0 : DEFAULT_VOLUME }))
          }
          aria-label={state.volume > 0 ? "Mute chime" : "Unmute chime"}
          className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          title={state.volume > 0 ? "Mute" : "Unmute"}
        >
          {state.volume <= 0 ? "🔇" : state.volume < 0.4 ? "🔈" : state.volume < 0.7 ? "🔉" : "🔊"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.volume}
          onChange={(e) =>
            setState((p) => ({ ...p, volume: Number(e.target.value) }))
          }
          aria-label="Chime volume"
          className="flex-1 accent-sky-500"
        />
        <button
          type="button"
          onClick={() => playChime(state.phase === "focus" ? "break" : "focus", state.volume)}
          title="Play test chime at current volume"
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
        >
          Test
        </button>
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
