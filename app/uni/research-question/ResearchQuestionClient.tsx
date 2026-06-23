"use client";

// Research Question Builder — scaffolds a student to write their OWN research
// question from a "future direction". Never writes the finished question.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import { getErrorMessage } from "@/lib/getErrorMessage";

interface BuildResult {
  componentsToDefine: { component: string; prompt: string }[];
  frame: string;
  frameOptions: string[];
  selfCheck: { criterion: string; ask: string }[];
  critique: {
    hasDraft: boolean;
    strengths: string[];
    issues: string[];
    directionToFix: string;
  };
  pitfalls: string[];
}

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-950 dark:to-slate-950";

export default function ResearchQuestionClient() {
  const build = useAction(api.researchQuestion.build);

  const [futureDirection, setFutureDirection] = useState("");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [articleContext, setArticleContext] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildResult | null>(null);

  const runBuild = async () => {
    setError(null);
    if (futureDirection.trim().length < 15) {
      setError("Describe the future direction your question should build on (at least 15 characters).");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      let activeAssignment = "";
      try {
        activeAssignment = localStorage.getItem("uni-active-assignment-v1") ?? "";
      } catch {
        activeAssignment = "";
      }
      const r = (await build({
        futureDirection,
        draftQuestion: draftQuestion.trim() || undefined,
        articleContext: articleContext.trim() || undefined,
        ...(activeAssignment
          ? { assignmentId: activeAssignment as Id<"assignments"> }
          : {}),
      })) as BuildResult;
      setResult(r);
    } catch (err) {
      setError(getErrorMessage(err, "Build failed."));
    } finally {
      setRunning(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await runBuild();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Research Question Builder"
        title="Build a testable research question — in your own words"
        description="Stuck turning a 'future direction' into a proper research question? This breaks it into parts, hands you a fill-in-the-blank frame, and checks your draft against the rubric words (specific, clear, testable). It won't write the question for you — that's the bit markers want from you."
      />

      <section className={`${sectionCard} mb-6`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelStyle} htmlFor="fd">
              The future direction to build on
            </label>
            <textarea
              id="fd"
              value={futureDirection}
              onChange={(e) => setFutureDirection(e.target.value)}
              rows={3}
              placeholder="e.g. Future research could test whether the memory intervention works for older adults, not just students."
              className={`${inputStyle} resize-y`}
            />
          </div>
          <div>
            <label className={labelStyle} htmlFor="dq">
              Your draft question (optional — we&apos;ll critique it, not rewrite it)
            </label>
            <textarea
              id="dq"
              value={draftQuestion}
              onChange={(e) => setDraftQuestion(e.target.value)}
              rows={2}
              placeholder="Paste your attempt if you have one."
              className={`${inputStyle} resize-y`}
            />
          </div>
          <div>
            <label className={labelStyle} htmlFor="ac">
              Article / topic context (optional)
            </label>
            <input
              id="ac"
              type="text"
              value={articleContext}
              onChange={(e) => setArticleContext(e.target.value)}
              placeholder="Brief topic or article focus, for grounding."
              className={inputStyle}
            />
          </div>
          {error && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              <button
                type="button"
                onClick={() => void runBuild()}
                disabled={running}
                className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-sky-300"
              >
                Try again
              </button>
            </div>
          )}
          <button type="submit" disabled={running} className={buttonPrimary}>
            {running ? "Building…" : "Build the scaffold"}
          </button>
        </form>
      </section>

      {running && !result && (
        <div className={sectionCard} role="status" aria-label="Building the scaffold">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-11/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-9/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-10/12 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Components */}
          {result.componentsToDefine?.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Decide these parts first
              </h2>
              <ul className="mt-3 space-y-3">
                {result.componentsToDefine.map((c, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.component}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{c.prompt}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Frames */}
          <section className={sectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Fill-in-the-blank frames
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Fill the [brackets] with your own answers from above. The structure is the scaffold —
              the content is yours.
            </p>
            {result.frame && (
              <p className="mt-3 rounded-lg border-2 border-sky-300 bg-sky-50 px-4 py-3 font-mono text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                {result.frame}
              </p>
            )}
            {result.frameOptions?.length > 0 && (
              <ul className="mt-3 space-y-2">
                {result.frameOptions.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Critique (only when a draft was given) */}
          {result.critique?.hasDraft && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                On your draft question
              </h2>
              {result.critique.strengths?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Working well
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                    {result.critique.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.critique.issues?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-rose-700 dark:text-rose-400">
                    Tighten these
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                    {result.critique.issues.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.critique.directionToFix && (
                <p className="mt-3 text-sm text-slate-900 dark:text-slate-100">
                  <span className="font-semibold text-sky-700 dark:text-sky-300">Direction:</span>{" "}
                  {result.critique.directionToFix}
                </p>
              )}
            </section>
          )}

          {/* Self-check */}
          {result.selfCheck?.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Check your question against the rubric
              </h2>
              <ul className="mt-3 space-y-2">
                {result.selfCheck.map((c, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                    <span className="shrink-0 font-semibold text-sky-700 dark:text-sky-300">
                      {c.criterion}:
                    </span>
                    <span>{c.ask}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pitfalls */}
          {result.pitfalls?.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Common pitfalls
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                {result.pitfalls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
