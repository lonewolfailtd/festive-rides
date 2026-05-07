"use client";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useMemo, useState } from "react";
import PageHeader from "../PageHeader";

type AnalysisResult = {
  summary: string;
  keyQuestion: string;
  taskVerbs: { verb: string; meaning: string }[];
  rubricBreakdown: { criterion: string; weightPercent: number; focus: string }[];
  wordCountSplit: { section: string; words: number; purpose: string }[];
  outline: { section: string; bullets: string[] }[];
  sourceTypesNeeded: string[];
  researchKeywords: string[];
  warnings: string[];
};

const inputStyle =
  "mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";
const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const buttonPrimary =
  "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60";
const buttonSecondary =
  "rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:bg-slate-100 dark:bg-slate-800";
const sectionCard =
  "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5";

const BRIEF_LIMIT = 12000;

function buildMarkdown(r: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Assignment plan");
  lines.push("");
  lines.push("## Summary");
  lines.push(r.summary);
  lines.push("");
  lines.push("## The actual question");
  lines.push(`> ${r.keyQuestion}`);
  lines.push("");
  if (r.warnings.length) {
    lines.push("## Warnings");
    for (const w of r.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Task verbs");
  for (const t of r.taskVerbs) lines.push(`- **${t.verb}** — ${t.meaning}`);
  lines.push("");
  lines.push("## Marking criteria");
  const sortedRubric = [...r.rubricBreakdown].sort(
    (a, b) => b.weightPercent - a.weightPercent,
  );
  for (const c of sortedRubric)
    lines.push(`- **${c.criterion}** (${c.weightPercent}%) — ${c.focus}`);
  lines.push("");
  lines.push("## Word-count split");
  for (const s of r.wordCountSplit)
    lines.push(`- **${s.section}** — ${s.words} words. ${s.purpose}`);
  lines.push("");
  lines.push("## Outline");
  for (const o of r.outline) {
    lines.push(`### ${o.section}`);
    for (const b of o.bullets) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push("## Source types needed");
  for (const s of r.sourceTypesNeeded) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Research keywords");
  lines.push(r.researchKeywords.join(", "));
  return lines.join("\n");
}

export default function AnalyserClient() {
  const analyse = useAction(api.analyser.analyse);

  const [brief, setBrief] = useState("");
  const [rubric, setRubric] = useState("");
  const [wordCountTarget, setWordCountTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);

  const sortedRubric = useMemo(() => {
    if (!result) return [];
    return [...result.rubricBreakdown].sort(
      (a, b) => b.weightPercent - a.weightPercent,
    );
  }, [result]);

  const totalSplitWords = useMemo(() => {
    if (!result) return 0;
    return result.wordCountSplit.reduce((sum, s) => sum + (s.words || 0), 0);
  }, [result]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (brief.trim().length < 30) {
      setError("Please paste a brief of at least 30 characters.");
      return;
    }
    if (brief.length > BRIEF_LIMIT) {
      setError(`Brief is too long (${brief.length} of ${BRIEF_LIMIT} characters).`);
      return;
    }
    setRunning(true);
    try {
      const args: {
        brief: string;
        rubric?: string;
        wordCountTarget?: number;
      } = { brief };
      if (rubric.trim()) args.rubric = rubric;
      if (wordCountTarget.trim()) {
        const n = Number(wordCountTarget);
        if (Number.isFinite(n) && n > 0) args.wordCountTarget = Math.round(n);
      }
      const res = (await analyse(args)) as AnalysisResult;
      setResult(res);
      setOpenSections({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setBrief("");
    setRubric("");
    setWordCountTarget("");
    setError(null);
    setResult(null);
    setOpenSections({});
  };

  const copyPlan = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(buildMarkdown(result));
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  };

  const copyKeywords = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.researchKeywords.join(", "));
    setCopiedKeywords(true);
    setTimeout(() => setCopiedKeywords(false), 2000);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Assignment Analyser"
        title="Plan your assignment"
        description="Paste your brief and (optionally) the rubric and word-count target. You'll get the actual question, task verbs, suggested outline, word-count split, and source types to look for."
      />

      <section className={`${sectionCard} mb-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Paste your assignment
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Drop in the brief and (optionally) the rubric. We will pull out the
          task verbs, organise an outline and suggest where to focus your
          research.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className={labelStyle}>Assignment brief</span>
              <span
                className={`text-xs ${
                  brief.length > BRIEF_LIMIT
                    ? "text-rose-400"
                    : "text-slate-500"
                }`}
              >
                {brief.length} / {BRIEF_LIMIT}
              </span>
            </div>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={BRIEF_LIMIT}
              rows={10}
              placeholder="Paste the full brief, including any context, questions and submission requirements."
              className={`${inputStyle} font-mono text-sm`}
              required
            />
          </div>

          <div>
            <span className={labelStyle}>Marking rubric (optional)</span>
            <textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={5}
              placeholder="Paste the rubric or criteria, if you have one."
              className={`${inputStyle} font-mono text-sm`}
            />
          </div>

          <div className="max-w-xs">
            <span className={labelStyle}>Word count target (optional)</span>
            <input
              type="number"
              min={0}
              value={wordCountTarget}
              onChange={(e) => setWordCountTarget(e.target.value)}
              placeholder="e.g. 2000"
              className={inputStyle}
            />
          </div>

          {error && (
            <div className="rounded-md border border-rose-700/60 bg-rose-950/40 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || brief.trim().length === 0}
              className={buttonPrimary}
            >
              {running ? "Thinking…" : "Analyse"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className={buttonSecondary}
              disabled={running}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {result && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Your plan</h2>
            <button onClick={copyPlan} className={buttonSecondary}>
              {copiedPlan ? "Copied" : "Copy plan as markdown"}
            </button>
          </div>

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Summary
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
              {result.summary}
            </p>
          </section>

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              The actual question
            </h3>
            <blockquote className="mt-3 border-l-4 border-sky-500 bg-white dark:bg-slate-950 px-4 py-3 text-sm italic text-slate-900 dark:text-slate-100">
              {result.keyQuestion}
            </blockquote>
          </section>

          {result.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
                Warnings
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Task verbs
            </h3>
            {result.taskVerbs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No task verbs identified.
              </p>
            ) : (
              <dl className="mt-3 space-y-3">
                {result.taskVerbs.map((t, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
                    <dt className="text-sm font-semibold text-sky-400">
                      {t.verb}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Marking criteria
            </h3>
            {sortedRubric.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No rubric breakdown provided.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Criterion</th>
                      <th className="py-2 pr-3">Weight</th>
                      <th className="py-2">Focus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sortedRubric.map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 align-top font-medium text-slate-900 dark:text-slate-100">
                          {c.criterion}
                        </td>
                        <td className="py-2 pr-3 align-top text-sky-400">
                          {c.weightPercent}%
                        </td>
                        <td className="py-2 align-top text-slate-700 dark:text-slate-300">
                          {c.focus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={sectionCard}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Word-count split
              </h3>
              {totalSplitWords > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: {totalSplitWords} words
                </span>
              )}
            </div>
            {result.wordCountSplit.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No split suggested.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {result.wordCountSplit.map((s, i) => {
                  const pct =
                    totalSplitWords > 0
                      ? Math.round((s.words / totalSplitWords) * 100)
                      : 0;
                  return (
                    <li key={i}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {s.section}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {s.words} words ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-sky-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.purpose}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Outline
            </h3>
            {result.outline.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No outline returned.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {result.outline.map((o, i) => {
                  const open = openSections[i] ?? true;
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSections((s) => ({ ...s, [i]: !open }))
                        }
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-white dark:bg-slate-900"
                      >
                        <span>{o.section}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {open ? "Hide" : "Show"}
                        </span>
                      </button>
                      {open && (
                        <ul className="list-disc space-y-1 px-8 pb-3 pt-1 text-sm text-slate-800 dark:text-slate-200">
                          {o.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={sectionCard}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Source types needed
            </h3>
            {result.sourceTypesNeeded.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Nothing specific suggested.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.sourceTypesNeeded.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1 text-xs text-slate-800 dark:text-slate-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className={sectionCard}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Research keywords
              </h3>
              {result.researchKeywords.length > 0 && (
                <button onClick={copyKeywords} className={buttonSecondary}>
                  {copiedKeywords ? "Copied" : "Copy keywords"}
                </button>
              )}
            </div>
            {result.researchKeywords.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No keywords yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.researchKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-sky-900/40 px-3 py-1 text-xs text-sky-200 ring-1 ring-sky-700/50"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
