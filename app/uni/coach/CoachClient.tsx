"use client";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../PageHeader";
import { useStoredState } from "@/lib/useStoredState";

const MAX_DRAFT = 30000;
const MIN_DRAFT = 100;

const countWords = (s: string): number => {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
};

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";

type ScoreEntry = { score: number; feedback: string };

type CoachResult = {
  overallSummary: string;
  scores: {
    structure: ScoreEntry;
    argument: ScoreEntry;
    evidenceUse: ScoreEntry;
    citationDensity: ScoreEntry;
    tone: ScoreEntry;
  };
  missingElements: string[];
  specificImprovements: { where: string; issue: string; suggestion: string }[];
  nzEnglishFlags: string[];
  oxfordCommaFlags: string[];
};

const DIMENSION_LABELS: Record<keyof CoachResult["scores"], string> = {
  structure: "Structure",
  argument: "Argument",
  evidenceUse: "Evidence use",
  citationDensity: "Citation density",
  tone: "Tone",
};

function scoreColour(score: number): {
  text: string;
  bar: string;
  bg: string;
  border: string;
} {
  if (score <= 2) {
    return {
      text: "text-rose-700 dark:text-rose-300",
      bar: "bg-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
    };
  }
  if (score === 3) {
    return {
      text: "text-amber-700 dark:text-amber-300",
      bar: "bg-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    };
  }
  return {
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  };
}

function ScoreCard({
  label,
  entry,
}: {
  label: string;
  entry: ScoreEntry;
}) {
  const score = Math.max(1, Math.min(5, Math.round(entry.score)));
  const colour = scoreColour(score);
  return (
    <div
      className={`rounded-2xl border ${colour.border} ${colour.bg} p-4 shadow-sm`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          {label}
        </h3>
        <span className={`text-2xl font-bold ${colour.text}`}>
          {score}
          <span className="text-sm text-slate-500 dark:text-slate-400">/5</span>
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= score ? colour.bar : "bg-slate-100 dark:bg-slate-800"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {entry.feedback}
      </p>
    </div>
  );
}

function buildMarkdown(r: CoachResult): string {
  const lines: string[] = [];
  lines.push("# Draft coach feedback\n");
  lines.push("## Overall summary\n");
  lines.push(r.overallSummary + "\n");
  lines.push("## Scores\n");
  (Object.keys(r.scores) as (keyof CoachResult["scores"])[]).forEach((k) => {
    const s = r.scores[k];
    lines.push(`- **${DIMENSION_LABELS[k]}** (${s.score}/5): ${s.feedback}`);
  });
  lines.push("");
  if (r.missingElements.length > 0) {
    lines.push("## Missing elements\n");
    r.missingElements.forEach((m) => lines.push(`- ${m}`));
    lines.push("");
  }
  if (r.specificImprovements.length > 0) {
    lines.push("## Specific improvements\n");
    r.specificImprovements.forEach((i) => {
      lines.push(`- _"${i.where}"_`);
      lines.push(`  - Issue: ${i.issue}`);
      lines.push(`  - Suggestion: ${i.suggestion}`);
    });
    lines.push("");
  }
  if (r.nzEnglishFlags.length > 0) {
    lines.push("## NZ English flags\n");
    r.nzEnglishFlags.forEach((f) => lines.push(`- ${f}`));
    lines.push("");
  }
  if (r.oxfordCommaFlags.length > 0) {
    lines.push("## Oxford comma flags\n");
    r.oxfordCommaFlags.forEach((f) => lines.push(`- ${f}`));
    lines.push("");
  }
  return lines.join("\n");
}

export default function CoachClient() {
  const coach = useAction(api.coach.coach);

  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState("");
  const [wordTarget, setWordTarget] = useStoredState<string>("uni-coach-word-target", "3000");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-coach");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { window.localStorage.setItem("uni-tool-onboarded-coach", "1"); } catch {}
  };

  const draftWords = countWords(draft);
  const target = Number(wordTarget) || 0;
  const targetTolerance = target * 0.1; // ±10% per most NZ uni style guides
  const wordStatus: "ok" | "under" | "over" | "none" =
    target === 0
      ? "none"
      : draftWords < target - targetTolerance
        ? "under"
        : draftWords > target + targetTolerance
          ? "over"
          : "ok";

  // Prefill brief from sessionStorage (handed over from the Analyser).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const prefill = window.sessionStorage.getItem("uni:coach:prefilled-brief");
      if (prefill && prefill.trim()) {
        setBrief(prefill.trim());
        window.sessionStorage.removeItem("uni:coach:prefilled-brief");
      }
    } catch {
      // ignore (private mode etc.)
    }
  }, []);

  const draftLen = draft.length;
  const tooShort = draftLen > 0 && draftLen < MIN_DRAFT;
  const tooLong = draftLen > MAX_DRAFT;

  const dimensions = useMemo(
    () =>
      result
        ? (Object.keys(result.scores) as (keyof CoachResult["scores"])[]).map(
            (k) => ({ key: k, label: DIMENSION_LABELS[k], entry: result.scores[k] })
          )
        : [],
    [result]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (draftLen < MIN_DRAFT) {
      setError(
        `Your draft is a bit short — please paste at least ${MIN_DRAFT} characters.`
      );
      return;
    }
    if (draftLen > MAX_DRAFT) {
      setError(
        `Your draft is too long. Please trim it to ${MAX_DRAFT} characters or fewer.`
      );
      return;
    }
    setRunning(true);
    try {
      const res = (await coach({
        draft,
        brief: brief.trim() ? brief : undefined,
      })) as CoachResult;
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get feedback. Please try again."
      );
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setDraft("");
    setBrief("");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildMarkdown(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Draft Coach"
        title="Get scored feedback on your draft"
        description="Paste your draft and the assignment brief. The coach scores structure, argument, evidence, citation density and tone, then suggests specific improvements."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Quick start</p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Paste the assignment brief in the optional brief box, OR open the Analyser to send one over.</li>
                <li>Paste your draft into the big text area.</li>
                <li>Pick the word-count target that matches your assignment level.</li>
                <li>Click Get feedback — you&rsquo;ll get scored ratings on structure, argument, evidence, citation density and tone.</li>
                <li>Specific improvements quote your own text and tell you what to change.</li>
              </ol>
            </div>
            <button type="button" onClick={dismissOnboarding} aria-label="Dismiss" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[12rem]">
              <span className={labelStyle}>Word count target</span>
              <select
                value={wordTarget}
                onChange={(e) => setWordTarget(e.target.value)}
                className={inputStyle}
              >
                <option value="0">No target</option>
                <option value="1000">1,000 words (100-level)</option>
                <option value="1500">1,500 words</option>
                <option value="2000">2,000 words (200-level)</option>
                <option value="2500">2,500 words</option>
                <option value="3000">3,000 words (300-level)</option>
                <option value="3500">3,500 words</option>
                <option value="4000">4,000 words (honors)</option>
                <option value="5000">5,000 words (postgrad)</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              NZ uni style guides usually allow ±10% around the target.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={labelStyle}>Your draft</span>
              <span
                className={`text-xs ${
                  tooLong || wordStatus === "over"
                    ? "text-rose-500 dark:text-rose-400"
                    : tooShort
                      ? "text-amber-500 dark:text-amber-400"
                      : wordStatus === "under"
                        ? "text-amber-600 dark:text-amber-400"
                        : wordStatus === "ok"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500 dark:text-slate-400"
                }`}
                title={`${draftLen.toLocaleString()} of ${MAX_DRAFT.toLocaleString()} characters`}
              >
                {draftWords.toLocaleString("en-NZ")}
                {target > 0 && (
                  <>
                    {" / "}
                    {target.toLocaleString("en-NZ")} words
                    {wordStatus === "ok" && " ✓"}
                    {wordStatus === "under" && ` (need ~${Math.max(0, Math.round(target - targetTolerance) - draftWords)} more)`}
                    {wordStatus === "over" && ` (over by ~${draftWords - Math.round(target + targetTolerance)})`}
                  </>
                )}
                {target === 0 && " words"}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              required
              placeholder="Paste your draft here. At least 100 characters."
              className={`${inputStyle} resize-y font-mono max-h-96 overflow-y-auto`}
            />
          </div>

          <div>
            <span className={labelStyle}>Assignment brief (optional)</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Paste the brief, marking criteria or rubric for tailored feedback."
              className={`${inputStyle} resize-y`}
            />
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || tooShort || tooLong || draftLen === 0}
              className={buttonPrimary}
            >
              {running ? "Reviewing…" : "Get feedback"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={running}
              className={buttonSecondary}
            >
              Reset
            </button>
            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className={`${buttonSecondary} ml-auto`}
              >
                {copied ? "Copied" : "Copy summary as markdown"}
              </button>
            )}
          </div>
        </form>
      </section>

      {running && !result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-11/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-9/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-10/12 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Overall summary
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-900 dark:text-slate-100">
              {result.overallSummary}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Scores
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dimensions.map((d) => (
                <ScoreCard key={d.key} label={d.label} entry={d.entry} />
              ))}
            </div>
          </section>

          {result.missingElements.length > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Missing elements
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-900 dark:text-slate-100">
                {result.missingElements.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          {result.specificImprovements.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Specific improvements
              </h2>
              <ul className="mt-4 space-y-4">
                {result.specificImprovements.map((imp, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
                  >
                    <p className="text-sm italic text-slate-700 dark:text-slate-300">
                      &ldquo;{imp.where}&rdquo;
                    </p>
                    <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold text-rose-700 dark:text-rose-300">
                        Issue:
                      </span>{" "}
                      {imp.issue}
                    </p>
                    <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        Suggestion:
                      </span>{" "}
                      {imp.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.nzEnglishFlags.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                NZ English flags
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.nzEnglishFlags.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-800 dark:text-sky-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {result.oxfordCommaFlags.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Oxford comma flags
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.oxfordCommaFlags.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-800 dark:text-amber-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </main>
  );
}
