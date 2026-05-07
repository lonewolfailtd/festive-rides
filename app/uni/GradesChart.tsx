"use client";

// Tiny SVG line chart of grades over time. Renders nothing if the student
// has fewer than two graded assignments — there's no story to tell yet.
// Uses pure SVG (no Chart.js / Recharts) because the chart is small and a
// 3KB chart library would dwarf its own footprint.

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import EmptyState from "./EmptyState";

const W = 600;
const H = 140;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

export default function GradesChart() {
  const assignments = useQuery(api.assignments.list);

  const points = useMemo(() => {
    if (!assignments) return [];
    return assignments
      .filter(
        (a): a is typeof a & { submittedAt: number; grade: number } =>
          a.submittedAt !== undefined && a.grade !== undefined
      )
      .sort((a, b) => a.submittedAt - b.submittedAt);
  }, [assignments]);

  if (points.length < 2) {
    // Placeholder so the 2-col dashboard layout doesn't collapse to one
    // empty column when the student hasn't graded enough assignments yet.
    return (
      <EmptyState
        icon="📊"
        title="No grades yet"
        body={
          points.length === 0
            ? "Mark assignments as graded to see your trend here."
            : "One grade in. Add another to see the line."
        }
        variant="default"
      />
    );
  }

  const minTime = points[0].submittedAt;
  const maxTime = points[points.length - 1].submittedAt;
  const timeSpan = maxTime - minTime || 1;

  const minGrade = Math.min(0, ...points.map((p) => p.grade)) - 5;
  const maxGrade = 100;
  const gradeSpan = maxGrade - minGrade;

  const x = (t: number) =>
    PAD_L + ((t - minTime) / timeSpan) * (W - PAD_L - PAD_R);
  const y = (g: number) =>
    PAD_T + ((maxGrade - g) / gradeSpan) * (H - PAD_T - PAD_B);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.submittedAt)} ${y(p.grade)}`)
    .join(" ");

  // Trend: simple linear regression slope of grade over index — don't need
  // a real time-weighted regression for a sanity-check chart.
  const indices = points.map((_, i) => i);
  const grades = points.map((p) => p.grade);
  const n = points.length;
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = grades.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((a, i) => a + i * grades[i], 0);
  const sumXX = indices.reduce((a, i) => a + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const trendDir = slope > 1 ? "up" : slope < -1 ? "down" : "flat";
  const avg = sumY / n;

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Grades over time
          </p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            Average <span className="font-semibold">{avg.toFixed(1)}%</span> across {n} assignment{n === 1 ? "" : "s"}
            {trendDir === "up" && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· trending up</span>}
            {trendDir === "down" && <span className="ml-1 text-amber-600 dark:text-amber-400">· trending down</span>}
            {trendDir === "flat" && <span className="ml-1 text-slate-500">· steady</span>}
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-32 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Grades over time chart"
      >
        {/* Y gridlines at 50 / 75 / 100 */}
        {[50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(g)}
              y2={y(g)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={PAD_L - 6}
              y={y(g) + 3}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 text-[10px]"
            >
              {g}
            </text>
          </g>
        ))}
        {/* The line itself */}
        <path
          d={pathD}
          fill="none"
          className="stroke-sky-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Data points + tooltips via <title> */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(p.submittedAt)}
              cy={y(p.grade)}
              r={4}
              className={
                p.grade >= 80
                  ? "fill-emerald-500"
                  : p.grade >= 60
                    ? "fill-sky-500"
                    : p.grade >= 50
                      ? "fill-amber-500"
                      : "fill-rose-500"
              }
            />
            <title>
              {p.name} — {p.grade}%{p.gradeLetter ? ` (${p.gradeLetter})` : ""} · {new Date(p.submittedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
            </title>
          </g>
        ))}
        {/* X-axis labels (first + last point) */}
        <text x={x(minTime)} y={H - 8} textAnchor="start" className="fill-slate-500 dark:fill-slate-400 text-[10px]">
          {new Date(minTime).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
        </text>
        <text x={x(maxTime)} y={H - 8} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[10px]">
          {new Date(maxTime).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
        </text>
      </svg>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        Hover any point to see the assignment, grade and date.
      </p>
    </div>
  );
}
