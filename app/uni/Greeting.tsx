"use client";

// Personalised greeting strip for the dashboard. Shows a time-of-day
// greeting once the user has set a display name. If no name is set yet,
// shows a one-line "what should we call you?" inline form so the student
// can fill it without trekking to settings.

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/getErrorMessage";

// Time-of-day greeting variants. We pick one stable per day so it doesn't
// shuffle every time the page rerenders, but does feel different across
// days. Random index = (date-of-month) % length.
const GREETINGS = {
  earlyHours: [
    "Working late",
    "Up at this hour",
    "The wee hours, but okay",
    "It's late",
  ],
  morning: [
    "Good morning",
    "Mōrena", // te reo
    "Morning",
    "Up bright and early",
  ],
  afternoon: [
    "Good afternoon",
    "Afternoon",
    "Kia ora", // te reo greeting (any time, but lands well midday)
  ],
  evening: [
    "Good evening",
    "Evening",
    "Ata mārie", // doubles as a "calm evening" greeting
  ],
  night: [
    "Burning the midnight oil",
    "Late one tonight",
    "Almost-tomorrow already",
  ],
} as const;

function timeOfDayLabel(d = new Date()): string {
  const h = d.getHours();
  const day = d.getDate();
  let pool: readonly string[];
  if (h < 5) pool = GREETINGS.earlyHours;
  else if (h < 12) pool = GREETINGS.morning;
  else if (h < 17) pool = GREETINGS.afternoon;
  else if (h < 21) pool = GREETINGS.evening;
  else pool = GREETINGS.night;
  return pool[day % pool.length];
}

// Late-night welfare nudge after 2+ days of post-10pm logins.
// Stored in localStorage so it works without any server tracking.
function checkLateNightStreak(): { streak: number; isLate: boolean } {
  if (typeof window === "undefined") return { streak: 0, isLate: false };
  const now = new Date();
  const isLate = now.getHours() >= 22 || now.getHours() < 5;
  if (!isLate) return { streak: 0, isLate: false };
  try {
    const KEY = "uni-late-night-streak";
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { lastDay: string; count: number })
      : { lastDay: "", count: 0 };
    if (parsed.lastDay === todayKey) {
      return { streak: parsed.count, isLate: true };
    }
    // Was yesterday (within ~36h)? Increment. Otherwise reset.
    let count = 1;
    if (parsed.lastDay) {
      const [y, m, d] = parsed.lastDay.split("-").map(Number);
      const last = new Date(y, m, d).getTime();
      if (now.getTime() - last < 36 * 60 * 60 * 1000) count = parsed.count + 1;
    }
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ lastDay: todayKey, count }),
    );
    return { streak: count, isLate: true };
  } catch {
    return { streak: 0, isLate: true };
  }
}

// First name only — easier to greet, less awkward if the saved value is
// "Sammi Petersen" or "Dr. Sammi". If the user typed a single name, this
// just returns it.
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export default function Greeting() {
  const me = useQuery(api.userSettings.me);
  const setMyProfile = useMutation(api.userSettings.setMyProfile);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Loading shimmer — keeps page height stable until we know name state.
  if (me === undefined) {
    return (
      <div className="mb-4 h-8 w-48 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
    );
  }

  const onSave = async () => {
    const name = draft.trim();
    if (!name) {
      toast.error("Pop your name in first.");
      return;
    }
    setSaving(true);
    try {
      await setMyProfile({ displayName: name });
      toast.success(`Kia ora, ${firstName(name)}.`);
      setEditing(false);
      setDraft("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  // No name yet — first-time inline prompt
  if (!me?.displayName) {
    if (!editing) {
      return (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm dark:border-sky-900/60 dark:bg-sky-950/30">
          <span className="text-sky-900 dark:text-sky-200">
            Welcome <span aria-hidden>👋</span> What should I call you?
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
          >
            Set my name
          </button>
        </div>
      );
    }
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 dark:border-sky-900/60 dark:bg-sky-950/30">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          placeholder="Sammi"
          maxLength={60}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSave();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 min-w-[10rem] rounded-md border border-sky-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-sky-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Later
        </button>
      </div>
    );
  }

  // Name set — render greeting + occasional late-night welfare nudge
  const name = firstName(me.displayName);
  const greeting = `${timeOfDayLabel()}, ${name}.`;
  const { streak, isLate } = checkLateNightStreak();
  // Only nudge on streak of 3+ AND it's actually late right now, so the
  // nudge appears the third night running but not the next morning.
  const shouldNudge = isLate && streak >= 3;
  return (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-slate-600 dark:text-slate-300">{greeting}</p>
      {shouldNudge && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {streak} late nights in a row, {name} — sleep counts more than the
          last 200 words. The draft will still be there tomorrow.
        </p>
      )}
    </div>
  );
}
