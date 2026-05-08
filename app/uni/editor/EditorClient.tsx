"use client";

// NZ Editor client — Grammarly-style proofreader tuned to NZ English +
// te reo macron checking + APA-aware essay structure analysis. Paste a
// draft, get categorised issues + structural notes.

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

interface Issue {
  category: "spelling" | "grammar" | "punctuation" | "tereo" | "style" | "structure";
  severity: "high" | "medium" | "low";
  where: string;
  // Set only for mechanical fixes (spelling, te reo, Oxford commas,
  // missing apostrophes). Null for grammar/style/structure where the
  // student needs to think it through.
  correctedSpan?: string | null;
  problem: string;
  suggestion: string;
  rule: string;
}

interface StructureNotes {
  introduction?: string;
  bodyParagraphs?: string;
  conclusion?: string;
  flow?: string;
  topImprovements?: string[];
}

interface EditResult {
  summary: string;
  totalIssues: number;
  byCategory: Record<string, number>;
  issues: Issue[];
  structureNotes?: StructureNotes;
}

// Apply mechanical fixes (spelling, te reo, Oxford commas, missing
// apostrophes) to the draft client-side. The model gives us per-issue
// find/replace pairs; we run them sequentially. Skips issues without
// a correctedSpan (grammar/style/structure are deliberately left for
// the student to think about).
function applyMechanicalFixes(originalText: string, issues: Issue[]): {
  text: string;
  applied: number;
  skipped: number;
} {
  let text = originalText;
  let applied = 0;
  let skipped = 0;
  const MECHANICAL: Issue["category"][] = ["spelling", "tereo", "punctuation"];
  for (const issue of issues) {
    if (!MECHANICAL.includes(issue.category)) continue;
    if (!issue.correctedSpan || !issue.where) continue;
    if (issue.correctedSpan === issue.where) continue;
    const idx = text.indexOf(issue.where);
    if (idx < 0) {
      skipped++;
      continue;
    }
    text =
      text.slice(0, idx) +
      issue.correctedSpan +
      text.slice(idx + issue.where.length);
    applied++;
  }
  return { text, applied, skipped };
}

const SEVERITY_RANK: Record<Issue["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const TEXT_MIN = 200;
const TEXT_MAX = 30000;

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]";

const CATEGORY_INFO: Record<
  Issue["category"],
  { label: string; emoji: string; tone: { bg: string; border: string; text: string } }
> = {
  spelling: {
    label: "Spelling",
    emoji: "🅂",
    tone: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      border: "border-rose-200 dark:border-rose-900/60",
      text: "text-rose-800 dark:text-rose-200",
    },
  },
  grammar: {
    label: "Grammar",
    emoji: "🅖",
    tone: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-900/60",
      text: "text-amber-800 dark:text-amber-200",
    },
  },
  punctuation: {
    label: "Punctuation",
    emoji: ";",
    tone: {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      border: "border-violet-200 dark:border-violet-900/60",
      text: "text-violet-800 dark:text-violet-200",
    },
  },
  tereo: {
    label: "Te reo Māori",
    emoji: "ā",
    tone: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-900/60",
      text: "text-emerald-800 dark:text-emerald-200",
    },
  },
  style: {
    label: "Style",
    emoji: "✎",
    tone: {
      bg: "bg-sky-50 dark:bg-sky-950/30",
      border: "border-sky-200 dark:border-sky-900/60",
      text: "text-sky-800 dark:text-sky-200",
    },
  },
  structure: {
    label: "Structure",
    emoji: "▦",
    tone: {
      bg: "bg-slate-100 dark:bg-slate-800/50",
      border: "border-slate-300 dark:border-slate-700",
      text: "text-slate-800 dark:text-slate-200",
    },
  },
};

const SEVERITY_TONE: Record<Issue["severity"], string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

export default function EditorClient() {
  const editAction = useAction(api.nzEditor.edit);

  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [filter, setFilter] = useState<"all" | Issue["category"]>("all");
  // Tracks which issues the student has marked as fixed. Indexed by
  // issue position. Persists in component state for the session — a
  // new edit run resets it.
  const [fixedSet, setFixedSet] = useState<Set<number>>(new Set());
  const [hideFixed, setHideFixed] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  // Linear progress estimate while running. Editor takes 15-30s typically
  // depending on draft length. Same pattern as Quick Import.
  const [progressPct, setProgressPct] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(20);
  const rafRef = useRef<number | null>(null);

  const stopProgressTimer = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startProgressTimer = (textLength: number) => {
    stopProgressTimer();
    // Empirical: ~12s for 1000 chars, ~25s for 5000, ~40s for 15000+.
    // Roughly linear with input size.
    const seconds =
      textLength < 1500 ? 15 : textLength < 6000 ? 25 : textLength < 15000 ? 35 : 50;
    setEstimatedSeconds(seconds);
    setProgressPct(0);
    const startedAt = performance.now();
    const totalMs = seconds * 1000;
    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      const linear = (elapsedMs / totalMs) * 99;
      setProgressPct(Math.min(99, linear));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => stopProgressTimer();
  }, []);

  const progressLabel =
    progressPct < 25
      ? "Reading your draft"
      : progressPct < 55
        ? "Spotting issues"
        : progressPct < 85
          ? "Reviewing structure"
          : "Almost there";
  const secondsLeft = Math.max(
    0,
    Math.ceil((estimatedSeconds * (100 - progressPct)) / 100),
  );

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-editor");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-editor", "1");
    } catch {}
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (text.trim().length < TEXT_MIN) {
      setError(`Paste at least ${TEXT_MIN} characters.`);
      return;
    }
    setRunning(true);
    setResult(null);
    setFixedSet(new Set());
    setHideFixed(false);
    startProgressTimer(text.length);
    try {
      const r = (await editAction({ text })) as EditResult;
      stopProgressTimer();
      setProgressPct(100);
      setResult(r);
      setFilter("all");
    } catch (err) {
      stopProgressTimer();
      setError(err instanceof Error ? err.message : "Edit failed.");
    } finally {
      setRunning(false);
    }
  };

  // Sort by severity (high → low), then keep original order within same
  // severity. Filter by category and optionally hide already-fixed.
  // We keep the original index so the checkbox state ties to a stable id.
  const filteredIssues = result
    ? result.issues
        .map((issue, originalIndex) => ({ issue, originalIndex }))
        .filter(({ issue, originalIndex }) => {
          if (filter !== "all" && issue.category !== filter) return false;
          if (hideFixed && fixedSet.has(originalIndex)) return false;
          return true;
        })
        .sort((a, b) => SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity])
    : [];

  const fixedCount = fixedSet.size;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="NZ Editor"
        title="Polish your draft for NZ English"
        description="Catches NZ-spelling slips, missing macrons on te reo, Oxford-comma drift, weak topic sentences and structural gaps. Tuned for Open Polytech APA 7 essays."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                Quick start
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Paste your draft below (200 to 30,000 characters).</li>
                <li>Click <em>Run editor</em> — issues are categorised: spelling, grammar, punctuation, te reo, style, structure.</li>
                <li>Each issue shows the exact phrase, what&apos;s wrong, what to change it to and why.</li>
                <li>Filter by category to focus on one type at a time.</li>
                <li>The <em>structure notes</em> at the bottom give essay-level improvement suggestions.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="Dismiss"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <section className={`${sectionCard} mb-6`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={labelStyle}>Your draft</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ~{wordCount.toLocaleString("en-NZ")} words
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              maxLength={TEXT_MAX}
              placeholder="Paste your draft here. Minimum 200 characters."
              className={`${inputStyle} max-h-[480px] resize-y overflow-y-auto font-mono`}
            />
          </div>
          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={running} className={buttonPrimary}>
              {running ? "Editing…" : "Run editor"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setResult(null);
                setError(null);
              }}
              className={buttonSecondary}
            >
              Clear
            </button>
          </div>

          {/* Linear progress bar with seconds-left, mirroring Quick Import.
              Only renders while running. */}
          {running && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium">{progressLabel}…</span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {Math.floor(progressPct)}%
                  {progressPct < 99 && secondsLeft > 0 && (
                    <span className="ml-2 text-slate-500 dark:text-slate-400">
                      · ~{secondsLeft}s left
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                  style={{
                    width: `${progressPct}%`,
                    transition: "width 100ms linear",
                  }}
                />
              </div>
            </div>
          )}
        </form>
      </section>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          {/* Summary card */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Overall
              </h2>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {result.totalIssues}
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                  issue{result.totalIssues === 1 ? "" : "s"}
                </span>
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.summary}
            </p>

            {/* Category filter chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                All ({result.totalIssues})
              </button>
              {(Object.keys(CATEGORY_INFO) as Issue["category"][]).map((cat) => {
                const count = result.byCategory[cat] ?? 0;
                if (count === 0) return null;
                const info = CATEGORY_INFO[cat];
                const active = filter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilter(cat)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? `${info.tone.border} ${info.tone.bg} ${info.tone.text}`
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {info.label} ({count})
                  </button>
                );
              })}
            </div>
          </section>

          {/* Auto-corrected draft — mechanical fixes applied client-side
              from per-issue correctedSpan pairs. Faster than asking the
              AI to rewrite the whole draft, and deterministic. */}
          {(() => {
            const corrected = applyMechanicalFixes(text, result.issues);
            if (corrected.applied === 0) return null;
            return (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Auto-corrected draft
                    <span className="ml-2 text-xs font-normal text-emerald-800/80 dark:text-emerald-200/80">
                      ({corrected.applied} fix{corrected.applied === 1 ? "" : "es"} applied)
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(corrected.text);
                        setDraftCopied(true);
                        toast.success(
                          `${corrected.applied} mechanical fixes applied. Paste back into your assignment.`,
                        );
                        setTimeout(() => setDraftCopied(false), 2200);
                      } catch {
                        toast.error("Couldn't copy");
                      }
                    }}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    {draftCopied ? "✓ Copied" : "Copy corrected draft"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                  Spelling, te reo macrons, Oxford commas and missing apostrophes pre-applied. Grammar, style and structure issues are <strong>left untouched</strong> — those need your judgement.
                  {corrected.skipped > 0 && (
                    <span className="ml-1 italic text-amber-800 dark:text-amber-300">
                      ({corrected.skipped} couldn&apos;t be auto-applied — apply manually from the issue list.)
                    </span>
                  )}
                </p>
                <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md border border-emerald-300/60 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 dark:border-emerald-800/60 dark:bg-slate-950 dark:text-slate-200">
                  {corrected.text}
                </pre>
              </section>
            );
          })()}

          {/* Issue list — checkbox per issue, sorted high → low severity */}
          {filteredIssues.length > 0 && (
            <section className={sectionCard}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {filter === "all" ? "All issues" : CATEGORY_INFO[filter].label}{" "}
                  <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {filteredIssues.length} of {result.totalIssues}
                    {fixedCount > 0 && (
                      <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                        · {fixedCount} fixed
                      </span>
                    )}
                  </span>
                </h2>
                {fixedCount > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={hideFixed}
                      onChange={(e) => setHideFixed(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                    />
                    Hide fixed
                  </label>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sorted by severity. Tick the box to mark an issue as addressed.
              </p>
              <ol className="mt-4 space-y-3">
                {filteredIssues.map(({ issue, originalIndex }) => {
                  const info = CATEGORY_INFO[issue.category];
                  const isFixed = fixedSet.has(originalIndex);
                  return (
                    <li
                      key={originalIndex}
                      className={`rounded-lg border p-4 transition-opacity ${
                        isFixed
                          ? "border-emerald-200 bg-emerald-50/50 opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                          : `${info.tone.border} ${info.tone.bg}`
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <input
                          type="checkbox"
                          checked={isFixed}
                          onChange={() => {
                            setFixedSet((prev) => {
                              const next = new Set(prev);
                              if (next.has(originalIndex)) next.delete(originalIndex);
                              else next.add(originalIndex);
                              return next;
                            });
                          }}
                          aria-label="Mark this issue as fixed"
                          className="h-4 w-4 shrink-0 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span
                          className={`inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium ${info.tone.text} ring-1 ring-inset ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60`}
                        >
                          {info.label}
                        </span>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${SEVERITY_TONE[issue.severity]}`}
                          title={`Severity: ${issue.severity}`}
                          aria-label={`Severity: ${issue.severity}`}
                        />
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {issue.severity}
                        </span>
                        {isFixed && (
                          <span className="ml-auto text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            ✓ fixed
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-2 text-sm italic ${
                          isFixed
                            ? "text-slate-500 line-through dark:text-slate-500"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        &ldquo;{issue.where}&rdquo;
                      </p>
                      <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
                        <span className="font-semibold text-rose-700 dark:text-rose-300">
                          Issue:
                        </span>{" "}
                        {issue.problem}
                      </p>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Fix:
                        </span>{" "}
                        {issue.suggestion}
                      </p>
                      <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">
                        {issue.rule}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Structure notes */}
          {result.structureNotes && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Structure review
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Essay-level feedback — what to fix above the sentence level.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.structureNotes.introduction && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Introduction
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {result.structureNotes.introduction}
                    </p>
                  </div>
                )}
                {result.structureNotes.bodyParagraphs && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Body paragraphs
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {result.structureNotes.bodyParagraphs}
                    </p>
                  </div>
                )}
                {result.structureNotes.conclusion && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Conclusion
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {result.structureNotes.conclusion}
                    </p>
                  </div>
                )}
                {result.structureNotes.flow && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Flow & signposting
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {result.structureNotes.flow}
                    </p>
                  </div>
                )}
              </div>
              {result.structureNotes.topImprovements &&
                result.structureNotes.topImprovements.length > 0 && (
                  <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                      Top improvements
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                      {result.structureNotes.topImprovements.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </section>
          )}

          {/* Copy summary */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!result) return;
                const lines: string[] = [];
                lines.push("# NZ Editor — feedback on draft\n");
                lines.push("## Overall");
                lines.push(result.summary + "\n");
                lines.push(`Total issues: ${result.totalIssues}`);
                lines.push(
                  Object.entries(result.byCategory)
                    .map(([k, v]) => `- ${k}: ${v}`)
                    .join("\n") + "\n",
                );
                lines.push("## Issues\n");
                for (const i of result.issues) {
                  lines.push(`### ${i.category} (${i.severity})`);
                  lines.push(`> "${i.where}"`);
                  lines.push(`- Issue: ${i.problem}`);
                  lines.push(`- Fix: ${i.suggestion}`);
                  lines.push(`- Rule: ${i.rule}\n`);
                }
                if (result.structureNotes) {
                  lines.push("## Structure review\n");
                  if (result.structureNotes.introduction)
                    lines.push(`**Introduction**: ${result.structureNotes.introduction}\n`);
                  if (result.structureNotes.bodyParagraphs)
                    lines.push(`**Body paragraphs**: ${result.structureNotes.bodyParagraphs}\n`);
                  if (result.structureNotes.conclusion)
                    lines.push(`**Conclusion**: ${result.structureNotes.conclusion}\n`);
                  if (result.structureNotes.flow)
                    lines.push(`**Flow**: ${result.structureNotes.flow}\n`);
                  if (result.structureNotes.topImprovements?.length) {
                    lines.push("**Top improvements**:");
                    for (const t of result.structureNotes.topImprovements) lines.push(`- ${t}`);
                  }
                }
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("Copied feedback as markdown");
                } catch {
                  toast.error("Couldn't copy");
                }
              }}
              className={buttonSecondary}
            >
              Copy as markdown
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}
