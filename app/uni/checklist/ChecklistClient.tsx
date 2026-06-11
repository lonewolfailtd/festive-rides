"use client";

// Completion Checklist — a dead-simple "have I answered every part?" list.
//
// Why this exists: analysing real Open Polytechnic result sheets showed the
// single biggest mark-loser is leaving a whole required task blank — a
// student scoring 70-78% on what they attempted still landed a C because two
// sections were never written. Submission Audit catches this at the very
// end; this catches it days earlier, while there's still time to act.
//
// The tasks come straight from the assignment brief (reusing the Question
// Unpacker's extractTasks action) or can be added by hand. The student ticks
// each one as they draft it. Done state is persisted on the assignment.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery, useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import { getErrorMessage } from "@/lib/getErrorMessage";

const ACTIVE_EVENT = "uni:active-assignment-changed";
const STORAGE_KEY = "uni-active-assignment-v1";

interface ChecklistItem {
  id: string;
  label: string;
  marks?: number;
  done: boolean;
}

const inputStyle =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-950 dark:to-slate-950";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for older browsers — varies the value by length + content.
    return `t_${Math.abs(Date.now()).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

export default function ChecklistClient() {
  const assignments = useQuery(api.assignments.list);
  const setChecklist = useMutation(api.assignments.setTaskChecklist);
  const toggleTask = useMutation(api.assignments.toggleTask);
  const extractTasks = useAction(api.questionUnpacker.extractTasks);

  const [activeId, setActiveId] = useState<Id<"assignments"> | "">("");
  const [pulling, setPulling] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  // Resolve the active assignment from (in priority order) the URL
  // ?assignmentId= param, then localStorage, then the most recent. Mirrors
  // the pattern used by the other tools, plus we honour the deep-link param
  // the dashboard cards append.
  useEffect(() => {
    let initial: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      initial = params.get("assignmentId");
    } catch {}
    if (!initial) {
      try {
        initial = window.localStorage.getItem(STORAGE_KEY);
      } catch {}
    }
    if (initial) setActiveId(initial as Id<"assignments">);

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setActiveId((detail as Id<"assignments">) ?? "");
    };
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_EVENT, onChange);
  }, []);

  // Default to the most recent assignment once the list loads if nothing is
  // selected yet.
  useEffect(() => {
    if (!activeId && assignments && assignments.length > 0) {
      setActiveId(assignments[0]._id);
    }
  }, [assignments, activeId]);

  const active = assignments?.find((a) => a._id === activeId);
  const items: ChecklistItem[] = useMemo(
    () => (active?.taskChecklist as ChecklistItem[] | undefined) ?? [],
    [active],
  );

  const doneCount = items.filter((t) => t.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const undoneMarks = items
    .filter((t) => !t.done && typeof t.marks === "number")
    .reduce((s, t) => s + (t.marks ?? 0), 0);

  const persist = async (next: ChecklistItem[]) => {
    if (!activeId) return;
    try {
      await setChecklist({ id: activeId as Id<"assignments">, taskChecklist: next });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };

  const handlePull = async () => {
    if (!active) return;
    if (!active.brief || active.brief.trim().length < 100) {
      toast.error(
        "This assignment has no brief saved. Add the brief (Quick Import or edit the assignment) first, or add tasks by hand below.",
      );
      return;
    }
    setPulling(true);
    try {
      const r = await extractTasks({ briefText: active.brief });
      if (!r.tasks.length) {
        toast.warning("No tasks detected in the brief. Add them by hand below.");
        return;
      }
      // Preserve done state for any task whose label already exists, so
      // re-pulling doesn't wipe progress.
      const prevByLabel = new Map(items.map((t) => [t.label.trim(), t]));
      const next: ChecklistItem[] = r.tasks.map((t) => {
        const prev = prevByLabel.get(t.label.trim());
        return {
          id: prev?.id ?? newId(),
          label: t.label,
          marks: prev?.marks,
          done: prev?.done ?? false,
        };
      });
      await persist(next);
      toast.success(`Loaded ${next.length} task${next.length === 1 ? "" : "s"} from the brief`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't pull tasks"));
    } finally {
      setPulling(false);
    }
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    await persist([...items, { id: newId(), label, done: false }]);
    setNewLabel("");
  };

  const handleDelete = async (id: string) => {
    await persist(items.filter((t) => t.id !== id));
  };

  const handleToggle = async (id: string) => {
    if (!activeId) return;
    // Optimistic-ish: rely on Convex reactivity to refresh after the
    // mutation. toggleTask flips just the one item server-side.
    try {
      await toggleTask({ id: activeId as Id<"assignments">, taskId: id });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update"));
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Completion Checklist"
        title="Tick off every task before you submit"
        description="The simplest way to not throw away marks: a list of every part your assignment asks for. Leaving a whole section blank is the biggest mark-loser there is — this makes sure you don't."
      />

      {/* Assignment picker */}
      <section className={`${sectionCard} mb-6`}>
        {assignments === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No assignments yet. Create one from the dashboard (or use Quick Import to drop in a
            brief PDF), then come back here.
          </p>
        ) : (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Assignment
            </span>
            <select
              value={activeId}
              onChange={(e) => setActiveId(e.target.value as Id<"assignments">)}
              className={`${inputStyle} mt-1`}
            >
              {assignments.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {active && (
        <>
          {/* Progress + status banner */}
          <section className={`${sectionCard} mb-6`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {active.name}
              </h2>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {doneCount} / {total} done{total > 0 ? ` · ${pct}%` : ""}
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {total > 0 && doneCount < total && (
              <div className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <span aria-hidden>⚠️</span> {total - doneCount} task{total - doneCount === 1 ? "" : "s"} still to do
                {undoneMarks > 0 ? ` — up to ${undoneMarks} marks at stake` : ""}. Don&apos;t
                submit with a blank section.
              </div>
            )}
            {total > 0 && doneCount === total && (
              <div className="mt-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span aria-hidden>✓</span> Every task is ticked off. Run the Submission Audit next for a final rubric
                check.
              </div>
            )}
          </section>

          {/* Task list */}
          <section className={`${sectionCard} mb-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
              <button
                type="button"
                onClick={handlePull}
                disabled={pulling}
                className={buttonSecondary}
                title="Read the saved brief and list every task automatically"
              >
                {pulling ? (
                  "Reading brief…"
                ) : (
                  <>
                    <span aria-hidden>⬇</span> Pull tasks from brief
                  </>
                )}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                No tasks yet. Pull them from the brief above, or add them by hand below.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => handleToggle(t.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        t.done
                          ? "text-slate-400 line-through dark:text-slate-600"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {t.label}
                      {typeof t.marks === "number" && (
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                          ({t.marks} marks)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      aria-label="Delete task"
                      className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add by hand */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAdd();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Add a task by hand, e.g. 'Task 3: Apply the research'"
                className={inputStyle}
              />
              <button type="submit" disabled={!newLabel.trim()} className={buttonPrimary}>
                Add
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
