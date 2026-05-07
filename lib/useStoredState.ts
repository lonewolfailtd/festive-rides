"use client";

import { useEffect, useState } from "react";

// useState that syncs with localStorage. SSR-safe (initial state is always
// the fallback; localStorage value is hydrated after mount). Hydration is
// gated by a state flag so the persist effect doesn't clobber the saved
// value on first render — same pattern the pomodoro timer uses.
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, hydrated]);
  return [value, setValue] as const;
}
