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
import {
  COURSE_COLOURS,
  DEFAULT_COURSE_COLOUR,
  colourFor,
  type CourseColour,
} from "@/lib/courseColours";
import { getErrorMessage } from "@/lib/getErrorMessage";

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
  const courses = useQuery(api.courses.list, {});
  const updateAssignment = useMutation(api.assignments.update);
  const createAssignment = useMutation(api.assignments.create);
  const removeAssignment = useMutation(api.assignments.remove);
  const markSubmitted = useMutation(api.assignments.markSubmitted);
  const unmarkSubmitted = useMutation(api.assignments.unmarkSubmitted);
  const setGrade = useMutation(api.assignments.setGrade);
  const createCourse = useMutation(api.courses.create);
  const updateCourse = useMutation(api.courses.update);

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
  //   3. Active is submitted, no grade → waiting for marker
  //   4. Active is graded → celebrate / move on
  //   5. Active but no analysis → run Analyser
  //   6. Analysis but <5 references → start adding sources
  //   7. References but no notes/draft signal → start drafting in Coach
  //   8. Otherwise → run AI Checker before submission
  // Every nudge has a target href so it's a one-click action.
  const nudge = useMemo(() => {
    if (!assignments) return null;
    if (assignments.length === 0) {
      return {
        text: "You haven't created an assignment yet — start one to unlock per-assignment references and outlines.",
        cta: "Create assignment",
        href: "/uni/references",
      };
    }
    if (!activeId || !active) {
      return {
        text: "Pick an active assignment above so the rest of the dashboard knows what you're working on.",
        cta: null,
        href: null,
      };
    }
    if (active.submittedAt && active.grade !== undefined) {
      return {
        text: `Graded ${active.grade}%${active.gradeLetter ? ` (${active.gradeLetter})` : ""}. Pick another assignment to keep the streak going.`,
        cta: null,
        href: null,
      };
    }
    if (active.submittedAt) {
      return {
        text: "Submitted — waiting on the marker. Add your grade here once you get it back so the dashboard tracks your progress.",
        cta: null,
        href: null,
      };
    }
    if (analyses === undefined || refs === undefined) return null;
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

  // Submission + grade state
  const [editingGrade, setEditingGrade] = useState(false);
  const [gradeNumDraft, setGradeNumDraft] = useState("");
  const [gradeLetterDraft, setGradeLetterDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const startEditingGrade = () => {
    setGradeNumDraft(active?.grade !== undefined ? String(active.grade) : "");
    setGradeLetterDraft(active?.gradeLetter ?? "");
    setFeedbackDraft(active?.markerFeedback ?? "");
    setEditingGrade(true);
  };
  const saveGrade = async () => {
    if (!active) return;
    const num = gradeNumDraft.trim() ? Number(gradeNumDraft) : undefined;
    if (num !== undefined && (isNaN(num) || num < 0 || num > 100)) {
      toast.error("Grade must be a number between 0 and 100.");
      return;
    }
    try {
      await setGrade({
        id: active._id,
        grade: num,
        gradeLetter: gradeLetterDraft.trim() || undefined,
        markerFeedback: feedbackDraft.trim() || undefined,
      });
      toast.success("Grade saved");
      setEditingGrade(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };

  const handleMarkSubmitted = async () => {
    if (!active) return;
    try {
      await markSubmitted({ id: active._id });
      toast.success("Marked submitted");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };
  const handleUnsubmit = async () => {
    if (!active) return;
    if (!confirm("Undo submission? This also clears any grade you've recorded.")) return;
    try {
      await unmarkSubmitted({ id: active._id });
      toast.success("Submission cleared");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };

  // Course assignment for the active assignment
  const handleSetCourse = async (courseId: Id<"courses"> | "") => {
    if (!active) return;
    try {
      await updateAssignment({
        id: active._id,
        courseId: courseId === "" ? undefined : courseId,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };

  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");

  // Delete the active assignment. Sonner toast with action button matches
  // the references-delete pattern. References + analyses keep their old
  // assignmentId — they stay in the user's library, just unattached.
  const handleDeleteAssignment = () => {
    if (!active) return;
    const target = active;
    toast(`Delete "${target.name}"?`, {
      description:
        "References and analyses linked to it will stay in your library but become unattached.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await removeAssignment({ id: target._id });
            // Clear active so the dashboard doesn't try to render the
            // now-gone assignment.
            setActiveIdLocal(null);
            try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
            try {
              window.dispatchEvent(
                new CustomEvent(ACTIVE_EVENT, { detail: null }),
              );
            } catch {}
            toast.success(`Deleted "${target.name}"`);
          } catch (err) {
            toast.error(
              getErrorMessage(err, "Couldn't delete"),
            );
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
      duration: 8000,
    });
  };
  const [newCourseColour, setNewCourseColour] =
    useState<CourseColour>(DEFAULT_COURSE_COLOUR);
  const [editingColour, setEditingColour] = useState(false);
  const handleCreateCourse = async () => {
    if (!newCourseCode.trim() || !newCourseName.trim()) {
      toast.error("Both code and name are required.");
      return;
    }
    try {
      const id = await createCourse({
        code: newCourseCode.trim().toUpperCase(),
        name: newCourseName.trim(),
        colour: newCourseColour,
      });
      if (active) await updateAssignment({ id: active._id, courseId: id });
      setNewCourseCode("");
      setNewCourseName("");
      setNewCourseColour(DEFAULT_COURSE_COLOUR);
      setCreatingCourse(false);
      toast.success(`Course ${newCourseCode.trim().toUpperCase()} created`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create"));
    }
  };

  // Active course (looked up from active assignment) and its colour entry.
  const activeCourse = useMemo(
    () => courses?.find((c) => c._id === active?.courseId) ?? null,
    [courses, active]
  );
  const activeColour = colourFor(activeCourse?.colour);

  const handleSetCourseColour = async (key: CourseColour) => {
    if (!activeCourse) return;
    try {
      await updateCourse({ id: activeCourse._id, colour: key });
      setEditingColour(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };

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
      toast.error(getErrorMessage(err, "Couldn't save"));
    }
  };
  const clearDue = async () => {
    if (!active) return;
    try {
      await updateAssignment({ id: active._id, dueDate: undefined });
      toast.success("Due date cleared");
      setEditingDue(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save"));
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
      toast.error(getErrorMessage(err, "Couldn't create"));
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
          <div className="relative">
            {activeCourse && (
              <span
                className={`pointer-events-none absolute left-3 top-1/2 z-10 mt-0.5 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${activeColour.dot}`}
                aria-hidden
              />
            )}
          <select
            value={activeId ?? ""}
            onChange={(e) =>
              setActiveIdLocal(e.target.value ? (e.target.value as Id<"assignments">) : null)
            }
            className={`${inputStyle} ${activeCourse ? "pl-7" : ""}`}
          >
            <option value="">— none selected —</option>
            {assignments.map((a) => {
              const c = courses?.find((c) => c._id === a.courseId);
              const prefix = c ? c.code : a.courseCode;
              return (
                <option key={a._id} value={a._id}>
                  {prefix ? `${prefix} · ` : ""}
                  {a.name}
                  {a.submittedAt ? " ✓" : ""}
                  {a.grade !== undefined ? ` (${a.grade}%)` : ""}
                  {!a.submittedAt && a.dueDate ? ` · ${fmtDate(a.dueDate)}` : ""}
                </option>
              );
            })}
          </select>
          </div>
        </div>

        {!creating ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
            >
              + New assignment
            </button>
            {active && (
              <button
                type="button"
                onClick={handleDeleteAssignment}
                title={`Delete "${active.name}"`}
                aria-label={`Delete "${active.name}"`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition-colors hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
            <div className="flex-1 min-w-[10rem]">
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

      {/* Course row */}
      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={labelStyle}>Course</span>
          {creatingCourse ? (
            <>
              <input
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                placeholder="PSY108"
                className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                onKeyDown={(e) => e.key === "Escape" && setCreatingCourse(false)}
                autoFocus
              />
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Introduction to Psychology"
                className="flex-1 min-w-[10rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                onKeyDown={(e) => e.key === "Escape" && setCreatingCourse(false)}
              />
              <div
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-900"
                role="radiogroup"
                aria-label="Course colour"
              >
                {COURSE_COLOURS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={newCourseColour === c.key}
                    aria-label={c.label}
                    onClick={() => setNewCourseColour(c.key)}
                    className={`h-4 w-4 rounded-full ${c.dot} ${
                      newCourseColour === c.key
                        ? "ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-900"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleCreateCourse()}
                className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setCreatingCourse(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {activeCourse && (
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${activeColour.dot}`}
                  aria-hidden
                  title={`Course colour: ${activeColour.key}`}
                />
              )}
              <select
                value={active.courseId ?? ""}
                onChange={(e) =>
                  void handleSetCourse(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as Id<"courses">)
                  )
                }
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">— no course —</option>
                {(courses ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
              {activeCourse && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEditingColour((v) => !v)}
                    aria-label="Edit course colour"
                    title="Edit course colour"
                    className={`flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${activeColour.dot}`}
                      aria-hidden
                    />
                  </button>
                  {editingColour && (
                    <div
                      className="absolute left-0 top-8 z-10 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                      role="radiogroup"
                      aria-label="Pick course colour"
                    >
                      {COURSE_COLOURS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          role="radio"
                          aria-checked={activeColour.key === c.key}
                          aria-label={c.label}
                          onClick={() => void handleSetCourseColour(c.key)}
                          className={`h-5 w-5 rounded-full ${c.dot} ${
                            activeColour.key === c.key
                              ? "ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-900"
                              : "opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setCreatingCourse(true)}
                className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                + New course
              </button>
            </>
          )}
        </div>
      )}

      {/* Submission + grade row */}
      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={labelStyle}>Status</span>
          {!active.submittedAt ? (
            <button
              type="button"
              onClick={() => void handleMarkSubmitted()}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
            >
              <span aria-hidden>✓</span> Mark submitted
            </button>
          ) : editingGrade ? (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={gradeNumDraft}
                onChange={(e) => setGradeNumDraft(e.target.value)}
                placeholder="%"
                className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={gradeLetterDraft}
                onChange={(e) => setGradeLetterDraft(e.target.value)}
                placeholder="A+ / Pass"
                className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Marker feedback (optional)"
                className="basis-full sm:basis-auto sm:flex-1 sm:min-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void saveGrade()}
                className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingGrade(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                <span aria-hidden>✓</span> Submitted {new Date(active.submittedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
              </span>
              {active.grade !== undefined && (
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                  {active.grade}%{active.gradeLetter ? ` · ${active.gradeLetter}` : ""}
                </span>
              )}
              <button
                type="button"
                onClick={startEditingGrade}
                className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                {active.grade !== undefined ? "Edit grade" : "Add grade"}
              </button>
              <button
                type="button"
                onClick={() => void handleUnsubmit()}
                className="ml-auto text-xs text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}

      {/* Stage dots — compact 4-step progress for the active assignment.
          Brief analysed → references gathered → submitted → graded.
          Filled = done, hollow = not yet. The current focus is the first
          unfilled dot, ringed in sky for emphasis. */}
      {active && analyses && refs && (
        <div className="mt-4">
          {(() => {
            const stages = [
              { label: "Analysed", done: analyses.length > 0 },
              { label: "Sourced", done: refs.length >= 5 },
              { label: "Submitted", done: !!active.submittedAt },
              { label: "Graded", done: active.grade !== undefined },
            ];
            // First unfilled stage is the "current focus"
            const focusIdx = stages.findIndex((s) => !s.done);
            return (
              <ol className="flex flex-wrap items-center gap-y-2 gap-x-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {stages.map((s, i) => {
                  const isFocus = i === focusIdx;
                  return (
                    <li key={s.label} className="flex items-center gap-1.5">
                      <span
                        className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${
                          s.done
                            ? "bg-emerald-500"
                            : isFocus
                              ? "bg-white ring-2 ring-sky-500 dark:bg-slate-900"
                              : "bg-slate-200 dark:bg-slate-800"
                        }`}
                        aria-hidden
                      >
                        {s.done && (
                          <svg viewBox="0 0 12 12" className="h-2 w-2 fill-white">
                            <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={
                          s.done
                            ? "text-emerald-700 dark:text-emerald-300"
                            : isFocus
                              ? "text-sky-700 dark:text-sky-300"
                              : ""
                        }
                      >
                        {s.label}
                      </span>
                      {i < stages.length - 1 && (
                        <span
                          aria-hidden
                          className={`mx-1 h-px w-4 ${
                            stages[i + 1].done || s.done
                              ? "bg-emerald-300 dark:bg-emerald-800"
                              : "bg-slate-200 dark:bg-slate-800"
                          }`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            );
          })()}
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
            {activeCourse && (
              <span className={`h-2 w-2 rounded-full ${activeColour.dot}`} aria-hidden />
            )}
            <span className="font-semibold">{analyses.length}</span> analys{analyses.length === 1 ? "is" : "es"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {activeCourse && (
              <span className={`h-2 w-2 rounded-full ${activeColour.dot}`} aria-hidden />
            )}
            <span className="font-semibold">{refs.length}</span> reference{refs.length === 1 ? "" : "s"}
          </span>
          {active.wordCountTarget && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {activeCourse && (
                <span className={`h-2 w-2 rounded-full ${activeColour.dot}`} aria-hidden />
              )}
              target: <span className="font-semibold">{active.wordCountTarget.toLocaleString("en-NZ")}</span> words
            </span>
          )}
        </div>
      )}
    </div>
  );
}
