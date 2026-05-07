"use client";

// Month-grid calendar showing the student's assignments (by due date) and
// NZ public + regional holidays. Click a day to see what's on that day in
// a side panel; click an assignment to jump to it.
//
// The grid is 7 cols × 6 rows so every month renders with the same shape
// (no row reflow when months have 28/29/30/31 days). Sundays first to
// match NZ calendar convention.

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "../EmptyState";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import { NZ_HOLIDAYS, type NzHoliday, toIsoDay, buildIcs } from "@/lib/nzHolidays";
import { useStoredState } from "@/lib/useStoredState";
import { colourFor } from "@/lib/courseColours";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Assignment = {
  _id: Id<"assignments">;
  name: string;
  courseCode?: string;
  courseId?: Id<"courses">;
  dueDate?: number;
  wordCountTarget?: number;
  submittedAt?: number;
  grade?: number;
  gradeLetter?: string;
};

// Build the 42-cell grid (6 weeks × 7 days) starting on the Sunday on or
// before the 1st of `month`.
function buildGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0 = Sun
  const start = new Date(year, month, 1 - firstDayOfWeek);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Convert the convex .cloud URL to its .site sibling, where HTTP routes live.
// e.g. https://fabulous-hippopotamus-112.convex.cloud → https://fabulous-hippopotamus-112.convex.site
function convexHttpBase(): string {
  const cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  return cloudUrl.replace(".convex.cloud", ".convex.site");
}

export default function CalendarClient() {
  const assignments = useQuery(api.assignments.list);
  const courses = useQuery(api.courses.list, {});
  const updateAssignment = useMutation(api.assignments.update);

  // Map of courseId -> colour entry. Used to colour assignment chips by
  // course; submitted assignments stay emerald and override course colour.
  const courseColourById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof colourFor>>();
    for (const c of courses ?? []) {
      map.set(c._id, colourFor(c.colour));
    }
    return map;
  }, [courses]);
  const myToken = useQuery(api.icalSubscription.getMyToken);
  const ensureToken = useMutation(api.icalSubscription.ensureToken);
  const rotateToken = useMutation(api.icalSubscription.rotateToken);
  const revokeToken = useMutation(api.icalSubscription.revokeToken);

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [showRegional, setShowRegional] = useStoredState<boolean>("uni-calendar-show-regional", true);
  const [draggingId, setDraggingId] = useState<Id<"assignments"> | null>(null);

  // Index data for fast lookups during render
  const holidaysByDay = useMemo(() => {
    const map = new Map<string, NzHoliday[]>();
    for (const h of NZ_HOLIDAYS) {
      const list = map.get(h.date) ?? [];
      list.push(h);
      map.set(h.date, list);
    }
    return map;
  }, []);

  const assignmentsByDay = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    if (!assignments) return map;
    for (const a of assignments) {
      if (!a.dueDate) continue;
      const iso = toIsoDay(new Date(a.dueDate));
      const list = map.get(iso) ?? [];
      list.push(a);
      map.set(iso, list);
    }
    return map;
  }, [assignments]);

  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  const goPrev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedIso(toIsoDay(today));
  };

  const selectedHolidays = selectedIso ? holidaysByDay.get(selectedIso) ?? [] : [];
  const selectedAssignments = selectedIso ? assignmentsByDay.get(selectedIso) ?? [] : [];

  // Drag-and-drop: drop an assignment chip onto another day to reschedule.
  const onDropOnDay = async (iso: string) => {
    if (!draggingId) return;
    setDraggingId(null);
    try {
      const [y, m, d] = iso.split("-").map(Number);
      const newDue = new Date(y, m - 1, d, 23, 59, 0).getTime();
      await updateAssignment({ id: draggingId, dueDate: newDue });
      toast.success("Due date updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="Calendar"
        title="Assignments and NZ public holidays"
        description="See what's due when, with NZ national holidays and regional anniversaries marked. Drag an assignment to reschedule it."
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            ← Prev
          </button>
          <h2 className="px-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 min-w-[12rem] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 rounded-md bg-sky-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-sky-500"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showRegional}
              onChange={(e) => setShowRegional(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
            />
            Show regional anniversaries
          </label>
          <button
            type="button"
            onClick={() => {
              // Build .ics from current data and trigger a download.
              // Holidays cover the visible window; assignments cover all
              // assignments with a due date.
              const events: { uid: string; date: string; summary: string; description?: string; category?: string }[] = [];
              for (const h of NZ_HOLIDAYS) {
                if (!showRegional && h.type === "regional") continue;
                events.push({
                  uid: `nz-holiday-${h.date}-${h.name.replace(/\W+/g, "")}@uni-citation`,
                  date: h.date,
                  summary: h.name,
                  description: h.region ? `${h.region} regional anniversary.` : h.notes,
                  category:
                    h.type === "national"
                      ? "Public Holiday"
                      : h.type === "matariki"
                        ? "Matariki"
                        : "Regional Anniversary",
                });
              }
              if (assignments) {
                for (const a of assignments) {
                  if (!a.dueDate) continue;
                  events.push({
                    uid: `assignment-${a._id}@uni-citation`,
                    date: toIsoDay(new Date(a.dueDate)),
                    summary: `${a.courseCode ? `${a.courseCode}: ` : ""}${a.name} — DUE`,
                    description: a.wordCountTarget
                      ? `Target: ${a.wordCountTarget} words.`
                      : undefined,
                    category: "Assignment",
                  });
                }
              }
              const ics = buildIcs(events);
              const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "uni-calendar.ics";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast.success(`Exported ${events.length} events. Import the .ics into Google or Apple Calendar.`);
            }}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            ⤓ Export to Google / Apple Calendar
          </button>
        </div>
      </div>

      {/* Desktop / tablet: month grid (sm and up) */}
      <div className="hidden sm:block">
      {/* Day-name header row */}
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="px-2 py-1 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          const iso = toIsoDay(d);
          const inMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const isSelected = selectedIso === iso;
          const dayHolidays = (holidaysByDay.get(iso) ?? []).filter(
            (h) => showRegional || h.type !== "regional"
          );
          const dayAssignments = assignmentsByDay.get(iso) ?? [];
          const hasNational = dayHolidays.some((h) => h.type === "national");
          const hasMatariki = dayHolidays.some((h) => h.type === "matariki");
          const hasRegional = dayHolidays.some((h) => h.type === "regional");

          let cellTone = "bg-white dark:bg-slate-950";
          if (hasNational) cellTone = "bg-rose-50 dark:bg-rose-950/30";
          else if (hasMatariki) cellTone = "bg-amber-50 dark:bg-amber-950/30";
          else if (hasRegional) cellTone = "bg-sky-50 dark:bg-sky-950/30";

          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIso(iso)}
              onDragOver={(e) => {
                if (draggingId) e.preventDefault();
              }}
              onDrop={() => void onDropOnDay(iso)}
              className={`min-h-[4rem] sm:min-h-[5.5rem] rounded-md border p-1 sm:p-1.5 text-left transition-colors ${cellTone} ${
                inMonth
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-slate-100 opacity-50 dark:border-slate-900"
              } ${
                isSelected
                  ? "ring-2 ring-sky-500"
                  : isToday
                    ? "ring-2 ring-sky-300 dark:ring-sky-700"
                    : "hover:border-sky-300 dark:hover:border-sky-700"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-xs font-semibold ${
                    isToday
                      ? "rounded-full bg-sky-600 px-1.5 text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {d.getDate()}
                </span>
                {dayHolidays[0] && (
                  <span
                    className={`hidden sm:inline truncate max-w-[60%] text-[10px] font-medium ${
                      dayHolidays[0].type === "national"
                        ? "text-rose-700 dark:text-rose-300"
                        : dayHolidays[0].type === "matariki"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-sky-700 dark:text-sky-300"
                    }`}
                    title={dayHolidays.map((h) => h.name).join(" · ")}
                  >
                    {dayHolidays[0].name.replace(/\(observed\)/, "(obs)")}
                  </span>
                )}
                {dayHolidays[0] && (
                  <span
                    className={`sm:hidden h-1.5 w-1.5 shrink-0 rounded-full ${
                      dayHolidays[0].type === "national"
                        ? "bg-rose-500"
                        : dayHolidays[0].type === "matariki"
                          ? "bg-amber-500"
                          : "bg-sky-500"
                    }`}
                    aria-hidden
                    title={dayHolidays.map((h) => h.name).join(" · ")}
                  />
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayAssignments.slice(0, 3).map((a) => {
                  const colour = a.courseId ? courseColourById.get(a.courseId) : undefined;
                  const chipColourClasses = a.submittedAt
                    ? "bg-emerald-600 text-white"
                    : colour
                      ? `${colour.chipBg} ${colour.chipText}`
                      : "bg-sky-600 text-white";
                  return (
                  <div
                    key={a._id}
                    draggable={!a.submittedAt}
                    onDragStart={() => !a.submittedAt && setDraggingId(a._id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate ${
                      a.submittedAt
                        ? "bg-emerald-600 text-white"
                        : `cursor-grab active:cursor-grabbing ${chipColourClasses}`
                    }`}
                    title={
                      a.submittedAt
                        ? `Submitted ${new Date(a.submittedAt).toLocaleDateString("en-NZ")}${a.grade !== undefined ? ` · ${a.grade}%` : ""}`
                        : `Due: ${a.name}${a.courseCode ? ` (${a.courseCode})` : ""}`
                    }
                  >
                    {a.submittedAt ? "✓ " : ""}{a.courseCode ? `${a.courseCode}: ` : ""}{a.name}
                  </div>
                  );
                })}
                {dayAssignments.length > 3 && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    +{dayAssignments.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      </div>

      {/* Mobile: stacked agenda (below sm) */}
      <div className="block sm:hidden">
        {(() => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const rows: { iso: string; date: Date; holidays: NzHoliday[]; assignments: Assignment[] }[] = [];
          for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const iso = toIsoDay(d);
            const hs = (holidaysByDay.get(iso) ?? []).filter(
              (h) => showRegional || h.type !== "regional"
            );
            const ass = assignmentsByDay.get(iso) ?? [];
            if (hs.length === 0 && ass.length === 0) continue;
            rows.push({ iso, date: d, holidays: hs, assignments: ass });
          }
          if (rows.length === 0) {
            return (
              <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Nothing scheduled this month.
              </p>
            );
          }
          return (
            <ul className="space-y-3">
              {rows.map((r) => {
                const isToday = isSameDay(r.date, today);
                const isSelected = selectedIso === r.iso;
                return (
                  <li
                    key={r.iso}
                    className={`rounded-lg border p-3 ${
                      isSelected
                        ? "border-sky-500 ring-2 ring-sky-500"
                        : isToday
                          ? "border-sky-300 dark:border-sky-700"
                          : "border-slate-200 dark:border-slate-800"
                    } bg-white dark:bg-slate-950`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIso(r.iso)}
                      className="block w-full text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {r.date.toLocaleDateString("en-NZ", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        {isToday && (
                          <span className="ml-2 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            Today
                          </span>
                        )}
                      </p>
                    </button>
                    {r.holidays.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.holidays.map((h, i) => (
                          <span
                            key={i}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              h.type === "national"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                                : h.type === "matariki"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                  : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                            }`}
                            title={h.region ?? h.notes}
                          >
                            {h.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.assignments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {r.assignments.map((a) => {
                          const colour = a.courseId ? courseColourById.get(a.courseId) : undefined;
                          const cls = a.submittedAt
                            ? "bg-emerald-600 text-white"
                            : colour
                              ? `${colour.chipBg} ${colour.chipText}`
                              : "bg-sky-600 text-white";
                          return (
                          <button
                            key={a._id}
                            type="button"
                            onClick={() => setSelectedIso(r.iso)}
                            className={`block w-full rounded px-2 py-1 text-left text-xs font-medium ${cls}`}
                          >
                            {a.submittedAt ? "✓ " : ""}
                            {a.courseCode ? `${a.courseCode}: ` : ""}
                            {a.name}
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-200 dark:bg-rose-900/60" />
          National holiday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-900/60" />
          Matariki
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sky-200 dark:bg-sky-900/60" />
          Regional anniversary
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sky-600" />
          Assignment due
        </span>
        <span className="ml-auto italic">
          Drag an assignment to reschedule.
        </span>
      </div>

      {/* Selected day detail */}
      {selectedIso && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {new Date(selectedIso).toLocaleDateString("en-NZ", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedIso(null)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Close
            </button>
          </div>

          {selectedHolidays.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Public holidays
              </p>
              <ul className="mt-1 space-y-1">
                {selectedHolidays.map((h, i) => (
                  <li
                    key={i}
                    className={`text-sm ${
                      h.type === "national"
                        ? "text-rose-700 dark:text-rose-300"
                        : h.type === "matariki"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    <strong>{h.name}</strong>
                    {h.region && <span className="ml-1 text-slate-500 dark:text-slate-400">— {h.region}</span>}
                    {h.notes && <span className="ml-1 italic text-slate-500 dark:text-slate-400">({h.notes})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedAssignments.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Assignments due
              </p>
              <ul className="mt-1 space-y-2">
                {selectedAssignments.map((a) => (
                  <li
                    key={a._id}
                    className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/60 dark:bg-sky-950/30"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {a.name}
                      {a.courseCode && (
                        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                          {a.courseCode}
                        </span>
                      )}
                    </p>
                    {a.wordCountTarget && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Target: {a.wordCountTarget.toLocaleString("en-NZ")} words
                      </p>
                    )}
                    {a.submittedAt && (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          ✓ Submitted {new Date(a.submittedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                        </span>
                        {a.grade !== undefined && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                            {a.grade}%{a.gradeLetter ? ` · ${a.gradeLetter}` : ""}
                          </span>
                        )}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Link
                        href={`/uni/analyser?assignmentId=${a._id}`}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                      >
                        Open in Analyser
                      </Link>
                      <Link
                        href={`/uni/coach?assignmentId=${a._id}`}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                      >
                        Open in Coach
                      </Link>
                      <Link
                        href={`/uni/references?assignmentId=${a._id}`}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                      >
                        References
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            selectedHolidays.length === 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Nothing scheduled.
              </p>
            )
          )}
        </div>
      )}

      {/* Live subscription panel */}
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
          Subscribe live to Google / Apple / Outlook
        </h3>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Better than the .ics download — your calendar app will re-fetch this URL every few hours and stay in sync as you add or reschedule assignments.
        </p>

        {myToken === undefined ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : myToken === null ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await ensureToken({});
                toast.success("Subscription URL ready");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't create");
              }
            }}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white hover:from-emerald-400 hover:to-emerald-500"
          >
            Generate subscription URL
          </button>
        ) : (
          (() => {
            const base = convexHttpBase();
            const url = `${base}/ical/${myToken.token}.ics`;
            // For Google Calendar's "From URL" import, http(s) is fine.
            // For one-click subscribe on macOS / iOS / Outlook, the
            // webcal:// scheme triggers a "Subscribe to Calendar" prompt.
            const webcalUrl = url.replace(/^https?:\/\//, "webcal://");
            return (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-[16rem] rounded-md border border-emerald-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Copied to clipboard");
                      } catch {
                        toast.error("Couldn't copy");
                      }
                    }}
                    className="rounded-md border border-emerald-400 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                  >
                    Copy
                  </button>
                  <a
                    href={webcalUrl}
                    className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    One-click subscribe (Apple / Outlook)
                  </a>
                </div>

                <details className="text-sm text-slate-700 dark:text-slate-300">
                  <summary className="cursor-pointer font-medium hover:text-emerald-700 dark:hover:text-emerald-300">
                    How to add this to Google Calendar / Apple Calendar
                  </summary>
                  <div className="mt-2 space-y-3 pl-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Google Calendar (web)</p>
                      <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-xs">
                        <li>Open Google Calendar in a browser.</li>
                        <li>Left sidebar → click the <strong>+</strong> next to &ldquo;Other calendars&rdquo; → <strong>From URL</strong>.</li>
                        <li>Paste the URL above and click <strong>Add calendar</strong>.</li>
                        <li>It appears under &ldquo;Other calendars&rdquo; and re-fetches every few hours.</li>
                      </ol>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Apple Calendar (Mac / iPhone)</p>
                      <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-xs">
                        <li>Click the <strong>One-click subscribe</strong> button above (uses webcal://).</li>
                        <li>Or: Mac &mdash; File → New Calendar Subscription → paste the URL.</li>
                        <li>Or: iPhone &mdash; Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste.</li>
                      </ol>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Outlook</p>
                      <ol className="mt-1 ml-4 list-decimal space-y-0.5 text-xs">
                        <li>Outlook web: Add calendar → Subscribe from web → paste the URL.</li>
                        <li>Outlook desktop: Add Calendar → From Internet → paste.</li>
                      </ol>
                    </div>
                  </div>
                </details>

                <div className="flex flex-wrap items-center gap-3 border-t border-emerald-200 pt-3 dark:border-emerald-900/40">
                  {(() => {
                    const ageMs = Date.now() - myToken.createdAt;
                    const ageDays = Math.floor(ageMs / 86_400_000);
                    const stale = ageDays >= 180;
                    return (
                      <span
                        className={`text-xs ${
                          stale
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        Anyone with this URL can read your calendar. Created {new Date(myToken.createdAt).toLocaleDateString("en-NZ")}
                        {ageDays > 0 && ` (${ageDays} day${ageDays === 1 ? "" : "s"} ago)`}
                        .
                        {stale && " It's been over 6 months — consider rotating to limit exposure."}
                      </span>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Generate a new URL? The old one will stop working immediately and any existing subscriptions will need to be re-added.")) return;
                      try {
                        await rotateToken({});
                        toast.success("URL rotated");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't rotate");
                      }
                    }}
                    className="ml-auto rounded-md border border-amber-400 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  >
                    Rotate URL
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Revoke the URL? Existing subscriptions will stop receiving updates.")) return;
                      try {
                        await revokeToken({});
                        toast.success("Subscription revoked");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't revoke");
                      }
                    }}
                    className="rounded-md border border-rose-400 bg-white px-2 py-1 text-xs text-rose-800 hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-900/30"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Upcoming list (next 30 days) */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Next 30 days
        </h3>
        <ul className="mt-3 space-y-1.5">
          {(() => {
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const end = new Date(start.getTime() + 30 * 86_400_000);
            const items: { iso: string; date: Date; label: string; tone: "asg" | "nat" | "mat" | "reg" }[] = [];
            for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
              const d = new Date(t);
              const iso = toIsoDay(d);
              const hs = (holidaysByDay.get(iso) ?? []).filter((h) => showRegional || h.type !== "regional");
              for (const h of hs) {
                items.push({
                  iso,
                  date: d,
                  label: h.name,
                  tone: h.type === "national" ? "nat" : h.type === "matariki" ? "mat" : "reg",
                });
              }
              const ass = assignmentsByDay.get(iso) ?? [];
              for (const a of ass) {
                items.push({
                  iso,
                  date: d,
                  label: `${a.courseCode ? `${a.courseCode}: ` : ""}${a.name} due`,
                  tone: "asg",
                });
              }
            }
            if (items.length === 0) {
              return (
                <li className="list-none">
                  <EmptyState
                    icon="🗓️"
                    title="Nothing in the next 30 days"
                    body="Add a due date to one of your assignments and it'll show up here."
                    cta={{ label: "Set a due date", href: "/uni" }}
                    variant="soft"
                  />
                </li>
              );
            }
            return items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {it.date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    it.tone === "asg"
                      ? "bg-sky-600"
                      : it.tone === "nat"
                        ? "bg-rose-500"
                        : it.tone === "mat"
                          ? "bg-amber-500"
                          : "bg-sky-400"
                  }`}
                  aria-hidden
                />
                <span className="text-slate-700 dark:text-slate-300">{it.label}</span>
              </li>
            ));
          })()}
        </ul>
      </div>
    </main>
  );
}
