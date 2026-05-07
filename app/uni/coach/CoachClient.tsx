"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";

const MAX_DRAFT = 30000;
const MIN_DRAFT = 100;

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";
const buttonPrimary =
  "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60";
const buttonSecondary =
  "rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800";

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
      text: "text-rose-400",
      bar: "bg-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
    };
  }
  if (score === 3) {
    return {
      text: "text-amber-400",
      bar: "bg-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    };
  }
  return {
    text: "text-emerald-400",
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
      className={`rounded-2xl border ${colour.border} ${colour.bg} p-4`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          {label}
        </h3>
        <span className={`text-2xl font-bold ${colour.text}`}>
          {score}
          <span className="text-sm text-slate-400">/5</span>
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= score ? colour.bar : "bg-slate-800"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
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
  const { signOut } = useAuthActions();
  const coach = useAction(api.coach.coach);

  const [draft, setDraft] = useState("");
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [copied, setCopied] = useState(false);

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
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-sky-400">Draft coach</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Get feedback on your draft
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Paste your draft to get scores, missing elements and specific
            improvements. Add the assignment brief for sharper feedback.{" "}
            <Link href="/uni" className="text-sky-400 hover:text-sky-300">
              Back to dashboard
            </Link>
          </p>
        </div>
        <button onClick={() => signOut()} className={buttonSecondary}>
          Sign out
        </button>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={labelStyle}>Your draft</span>
              <span
                className={`text-xs ${
                  tooLong
                    ? "text-rose-400"
                    : tooShort
                      ? "text-amber-400"
                      : "text-slate-500"
                }`}
              >
                {draftLen.toLocaleString()} / {MAX_DRAFT.toLocaleString()}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              required
              placeholder="Paste your draft here. At least 100 characters."
              className={`${inputStyle} resize-y font-mono`}
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

          {error && <p className="text-sm text-rose-400">{error}</p>}

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

      {result && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Overall summary
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-100">
              {result.overallSummary}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
                Missing elements
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-100">
                {result.missingElements.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          {result.specificImprovements.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Specific improvements
              </h2>
              <ul className="mt-4 space-y-4">
                {result.specificImprovements.map((imp, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                  >
                    <p className="text-sm italic text-slate-300">
                      &ldquo;{imp.where}&rdquo;
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      <span className="font-semibold text-rose-300">
                        Issue:
                      </span>{" "}
                      {imp.issue}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      <span className="font-semibold text-emerald-300">
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
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                NZ English flags
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.nzEnglishFlags.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {result.oxfordCommaFlags.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Oxford comma flags
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.oxfordCommaFlags.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
