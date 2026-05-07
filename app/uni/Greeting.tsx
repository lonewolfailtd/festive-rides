"use client";

// Personalised greeting strip for the dashboard. Shows a time-of-day
// greeting once the user has set a display name. If no name is set yet,
// shows a one-line "what should we call you?" inline form so the student
// can fill it without trekking to settings.

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

function timeOfDayLabel(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Burning the midnight oil";
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
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
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
            Welcome 👋 What should I call you?
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

  // Name set — render greeting
  const greeting = `${timeOfDayLabel()}, ${firstName(me.displayName)}.`;
  return (
    <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
      {greeting}
    </p>
  );
}
