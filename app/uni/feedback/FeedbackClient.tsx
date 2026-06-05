"use client";

// Feedback Memory — save the marker's comments on each assignment, then find
// the recurring patterns across them all. Turns one-off feedback into a
// personal improvement loop.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

type Severity = "recurring" | "occasional" | "one-off";

interface Pattern {
  theme: string;
  severity: Severity;
  occurrences: string[];
  whatMarkersSaid: string;
  fixNextTime: string;
}

interface PatternResult {
  summary: string;
  patterns: Pattern[];
  topFocus: string[];
  strengths: string[];
}

const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-950 dark:to-slate-950";

const SEVERITY_INFO: Record<Severity, { label: string; pill: string }> = {
  recurring: {
    label: "Recurring",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  },
  occasional: {
    label: "Occasional",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  "one-off": {
    label: "One-off",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function FeedbackRow({
  id,
  name,
  grade,
  initial,
}: {
  id: Id<"assignments">;
  name: string;
  grade?: number;
  initial: string;
}) {
  const update = useMutation(api.assignments.update);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== initial.trim();

  const save = async () => {
    setSaving(true);
    try {
      await update({ id, markerFeedback: value.trim() });
      toast.success(`Saved feedback for "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</h3>
        {typeof grade === "number" && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{grade}%</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Paste the marker's overall comments for this assignment…"
        className={`${inputStyle} resize-y`}
      />
      {dirty && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={save} disabled={saving} className={buttonSecondary}>
            {saving ? "Saving…" : "Save feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedbackClient() {
  const assignments = useQuery(api.assignments.list);
  const analyse = useAction(api.feedbackMemory.analysePatterns);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatternResult | null>(null);
  const [analysedCount, setAnalysedCount] = useState(0);

  // Clear stale results if the user navigates back with new data.
  useEffect(() => {
    setResult(null);
  }, [assignments?.length]);

  const withFeedback =
    assignments?.filter((a) => (a.markerFeedback ?? "").trim().length > 0) ?? [];

  const handleAnalyse = async () => {
    setError(null);
    setRunning(true);
    setResult(null);
    try {
      const r = await analyse({});
      setResult(r.result as PatternResult);
      setAnalysedCount(r.assignmentsAnalysed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Feedback Memory"
        title="Turn marker feedback into a plan"
        description="Save the marker's comments on each assignment here. Once you have a couple, find the patterns — the things that keep costing you marks — so you can fix them before the next one."
      />

      <section className={`${sectionCard} mb-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Marker comments by assignment
          </h2>
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={running || withFeedback.length === 0}
            className={buttonPrimary}
            title={
              withFeedback.length === 0
                ? "Save feedback on at least one assignment first"
                : "Find recurring patterns across your saved feedback"
            }
          >
            {running ? "Finding patterns…" : "🔍 Find my patterns"}
          </button>
        </div>

        {assignments === undefined ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            No assignments yet. Create one from the dashboard, add the marker&apos;s feedback once
            it&apos;s graded, then come back.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {assignments.map((a) => (
              <FeedbackRow
                key={a._id}
                id={a._id}
                name={a.name}
                grade={a.grade}
                initial={a.markerFeedback ?? ""}
              />
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <section className={sectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Your throughline
              <span className="ml-2 font-normal normal-case tracking-normal text-slate-500 dark:text-slate-400">
                across {analysedCount} assignment{analysedCount === 1 ? "" : "s"}
              </span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {result.summary}
            </p>
            {result.topFocus?.length > 0 && (
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                  Fix these next time
                </div>
                <ol className="mt-2 space-y-1.5">
                  {result.topFocus.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-800 dark:text-slate-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {result.patterns?.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Patterns
              </h2>
              <ul className="mt-4 space-y-3">
                {result.patterns.map((p, i) => {
                  const info = SEVERITY_INFO[p.severity] ?? SEVERITY_INFO["one-off"];
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${info.pill}`}
                        >
                          {info.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {p.theme}
                        </span>
                        {p.occurrences?.length > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {p.occurrences.join(" · ")}
                          </span>
                        )}
                      </div>
                      {p.whatMarkersSaid && (
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          {p.whatMarkersSaid}
                        </p>
                      )}
                      {p.fixNextTime && (
                        <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                          <span className="font-semibold text-sky-700 dark:text-sky-300">
                            Next time:
                          </span>{" "}
                          {p.fixNextTime}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {result.strengths?.length > 0 && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Keep doing this
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                {result.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
