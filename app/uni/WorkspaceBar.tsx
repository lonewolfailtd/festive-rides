"use client";

// Active-assignment workspace bar that turns the dashboard from a launcher
// into a workspace. Picks an active assignment, persists the choice in
// localStorage, shows a countdown to the due date, and emits a single
// "what's next" nudge based on what the student has actually done so far.
//
// The selected id is also broadcast to siblings via a tiny pub-sub on
// `window` so the dashboard cards can append `?assignmentId=...` to their
// links without prop-drilling.

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

const STORAGE_KEY = "uni-active-assignment-v1";
const ACTIVE_EVENT = "uni:active-assignment-changed";

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function formatDueIn(ms: number): { label: string; tone: "ok" | "warn" | "danger" | "overdue" } {
  if (ms < 0) {
    const days = Math.ceil(Math.abs(ms) / 86_400_000);
    return { label: `${days} day${days === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  if (days >= 7) {
    return { label: `due in ${days} days`, tone: "ok" };
  }
  if (days >= 3) {
    return { label: `due in ${days} days`, tone: "warn" };
  }
  if (days >= 1) {
    return { label: `due in ${days}d ${hours}h`, tone: "danger" };
  }
  return { label: `due in ${hours}h`, tone: "danger" };
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ISO yyyy-mm-dd for <input type="date">
function isoDay(ts: number | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayToTs(iso: string): number {
  // Treat the picked date as 23:59 NZ-time-ish so a "due Friday" doesn't go
  // overdue at midnight. Local timezone is fine — Convex stores epoch ms.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 0).getTime();
}

export default function WorkspaceBar() {
  const assignments = useQuery(api.assignments.list);
  const updateAssignment = useMutation(api.assignments.update);
  const createAssignment = useMutation(api.assignments.create);

  const [activeId, setActiveIdLocal] = useState<Id<"assignments"> | null>(null);
  const hydrated = useRef(false);

  // Hydrate selection from localStorage. The hydration guard mirrors the
  // pomodoro timer's pattern so we never overwrite a real selection with
  // null on remount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setActiveIdLocal(raw as Id<"assignments">);
    } catch {}
    hydrated.current = true;
  }, []);

  // If the hydrated id no longer exists (assignment deleted), clear it.
  useEffect(() => {
    if (!assignments || !activeId) return;
    const exists = assignments.some((a) => a._id === activeId);
    if (!exists) {
      setActiveIdLocal(null);
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [assignments, activeId]);

  // Auto-pick the most recent assignment if none chosen and at least one
  // exists. Lowers friction for students with a single assignment.
  useEffect(() => {
    if (!hydrated.current) return;
    if (activeId) return;
    if (!assignments || assignments.length === 0) return;
    const first = assignments[0];
    setActiveIdLocal(first._id);
    try { window.localStorage.setItem(STORAGE_KEY, first._id); } catch {}
  }, [assignments, activeId]);

  // Broadcast change so the dashboard cards (rendered separately) can add
  // ?assignmentId= to their hrefs.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (activeId) window.localStorage.setItem(STORAGE_KEY, activeId);
      else window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: activeId }));
    } catch {}
  }, [activeId]);

  // Pull supporting data scoped to the active assignment so we can compute
  // the "what's next" nudge without round-tripping anything through the AI.
  const analyses = useQuery(
    api.analysisStore.list,
    activeId ? { assignmentId: activeId } : "skip"
  );
  const refs = useQuery(
    api.references.listForAssignment,
    activeId ? { assignmentId: activeId } : "skip"
  );

  const active = useMemo(
    () => assignments?.find((a) => a._id === activeId) ?? null,
    [assignments, activeId]
  );

  // Live tick so the countdown updates without needing a refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const due = active?.dueDate ? formatDueIn(active.dueDate - now) : null;

  // Compute the single most useful next step. Priorities (highest first):
  //   1. No assignments at all → create one
  //   2. No active assignment → pick one
  //   3. Active but no analysis → run Analyser
  //   4. Analysis but <5 references → start adding sources
  //   5. References but no notes/draft signal → start drafting in Coach
  //   6. Otherwise → run AI Checker before submission
  // Every nudge has a target href so it's a one-click action.
  const nudge = useMemo(() => {
    if (!assignments) return null;
    if (assignments.length === 0) {
      return {
        text: "You haven't created an assignment yet — start one to unlock per-assignment references and outlines.",
        cta: "Create assignment",
        href: "/uni/references", // assignment creation lives on references page
      };
    }
    if (!activeId || !active) {
      return {
        text: "Pick an active assignment above so the rest of the dashboard knows what you're working on.",
        cta: null,
        href: null,
      };
    }
    if (analyses === undefined || refs === undefined) return null; // still loading
    if (analyses.length === 0) {
      return {
        text: `No analysis for ${active.name} yet — paste the brief and let the Analyser break it down.`,
        cta: "Open Analyser",
        href: `/uni/analyser?assignmentId=${activeId}`,
      };
    }
    if (refs.length < 5) {
      return {
        text: `Only ${refs.length} reference${refs.length === 1 ? "" : "s"} so far. Most NZ uni assignments expect at least 5–8 — try the Source Finder.`,
        cta: "Find sources",
        href: `/uni/sources?assignmentId=${activeId}`,
      };
    }
    if (refs.length >= 5 && analyses.length > 0) {
      return {
        text: `Outline drafted and ${refs.length} references gathered. Time to draft — Coach can score it once you have something down.`,
        cta: "Open Coach",
        href: `/uni/coach?assignmentId=${activeId}`,
      };
    }
    return {
      text: "Looking good. Run the AI Checker before you submit.",
      cta: "Run AI Checker",
      href: `/uni/checker`,
    };
  }, [assignments, activeId, active, analyses, refs]);

  // Inline due-date editor
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState("");
  const startEditingDue = () => {
    setDueDraft(isoDay(active?.dueDate));
    setEditingDue(true);
  };
  const saveDue = async () => {
    if (!active) return;
    try {
      await updateAssignment({
        id: active._id,
        dueDate: dueDraft ? dayToTs(dueDraft) : undefined,
      });
      toast.success("Due date saved");
      setEditingDue(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  };
  const clearDue = async () => {
    if (!active) return;
    try {
      await updateAssignment({ id: active._id, dueDate: undefined });
      toast.success("Due date cleared");
      setEditingDue(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  };

  // Quick "create assignment" inline
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Give it a name first.");
      return;
    }
    try {
      const id = await createAssignment({ name: newName.trim() });
      setNewName("");
      setCreating(false);
      setActiveIdLocal(id);
      toast.success(`Created "${newName.trim()}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create");
    }
  };

  if (!assignments) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <span className={labelStyle}>Active assignment</span>
          <select
            value={activeId ?? ""}
            onChange={(e) =>
              setActiveIdLocal(e.target.value ? (e.target.value as Id<"assignments">) : null)
            }
            className={inputStyle}
          >
            <option value="">— none selected —</option>
            {assignments.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
                {a.courseCode ? ` · ${a.courseCode}` : ""}
                {a.dueDate ? ` · ${fmtDate(a.dueDate)}` : ""}
              </option>
            ))}
          </select>
        </div>

        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            + New assignment
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <div>
              <span className={labelStyle}>Name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="PSY108 essay 1"
                className={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-3 py-2 text-sm font-medium text-white hover:from-sky-400 hover:to-sky-500"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Due date row */}
      {active && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={labelStyle}>Due</span>
          {editingDue ? (
            <>
              <input
                type="date"
                value={dueDraft}
                onChange={(e) => setDueDraft(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void saveDue()}
                className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
              >
                Save
              </button>
              {active.dueDate && (
                <button
                  type="button"
                  onClick={() => void clearDue()}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingDue(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {active.dueDate ? (
                <>
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    {fmtDate(active.dueDate)}
                  </span>
                  {due && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        due.tone === "overdue"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                          : due.tone === "danger"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                            : due.tone === "warn"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      }`}
                    >
                      {due.label}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400">No date set</span>
              )}
              <button
                type="button"
                onClick={startEditingDue}
                className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                {active.dueDate ? "Edit" : "Set due date"}
              </button>
            </>
          )}
        </div>
      )}

      {/* What's next nudge */}
      {nudge && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex-1 min-w-[12rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
              What's next
            </p>
            <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{nudge.text}</p>
          </div>
          {nudge.cta && nudge.href && (
            <Link
              href={nudge.href}
              className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              {nudge.cta} →
            </Link>
          )}
        </div>
      )}

      {/* Compact progress chips for the active assignment */}
      {active && analyses && refs && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="font-semibold">{analyses.length}</span> analys{analyses.length === 1 ? "is" : "es"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="font-semibold">{refs.length}</span> reference{refs.length === 1 ? "" : "s"}
          </span>
          {active.wordCountTarget && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              target: <span className="font-semibold">{active.wordCountTarget.toLocaleString("en-NZ")}</span> words
            </span>
          )}
        </div>
      )}
    </div>
  );
}
