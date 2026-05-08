"use client";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

type RiskLevel = "low" | "medium" | "high";

type FlaggedPhrase = {
  phrase: string;
  risk: RiskLevel;
  reason: string;
  category: "templated" | "verbatim-likely" | "common-cliche" | "uncited-claim" | "other";
};

type SelfCheckResult = {
  summary: string;
  phrases: FlaggedPhrase[];
  overallRisk: RiskLevel;
  advice: string[];
};

const TEXT_MIN = 200;
const TEXT_MAX = 50000;

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)]";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]";

const CATEGORY_LABEL: Record<FlaggedPhrase["category"], string> = {
  templated: "Templated phrasing",
  "verbatim-likely": "Likely verbatim",
  "common-cliche": "Common cliche",
  "uncited-claim": "Uncited claim",
  other: "Other",
};

function riskColour(risk: RiskLevel): {
  text: string;
  bar: string;
  bg: string;
  border: string;
  pill: string;
} {
  if (risk === "low") {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    };
  }
  if (risk === "medium") {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    };
  }
  return {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  };
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export default function PlagiarismClient() {
  const selfCheck = useAction(api.plagiarism.selfCheck);

  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-plagiarism");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-plagiarism", "1");
    } catch {}
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (text.trim().length < TEXT_MIN) {
      setError(`Paste at least ${TEXT_MIN} characters of draft.`);
      return;
    }
    setRunning(true);
    try {
      const res = (await selfCheck({ text })) as SelfCheckResult;
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Self-check failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const overall = result ? riskColour(result.overallRisk) : null;

  const googleUrl = (phrase: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`"${phrase}"`)}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Plagiarism Self-Check"
        title="Spot phrasing that looks plagiarised"
        description="This is a self-check, not a real plagiarism database query. We flag phrases that LOOK plagiarised so you can verify yourself with Google. Paste your draft and we'll flag 6-12 word phrases that read as templated, distinctive or copy-paste-flavoured, with a Google search link so you can verify each one before submission."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Quick start</p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Paste your draft (at least 200 characters).</li>
                <li>Click <em>Run self-check</em> — get an overall risk level and a list of flagged phrases.</li>
                <li>For each flag, click <em>Search Google</em> to see if the phrase appears verbatim online.</li>
                <li>If it does, rewrite in your own words or add a proper citation before submission.</li>
              </ol>
              <p className="mt-2 text-xs text-sky-900/80 dark:text-sky-300/80">
                ⚠  This is a self-check, not a real plagiarism checker. It can&apos;t query Turnitin&apos;s database — it flags phrasing that LOOKS plagiarised so you can verify manually.
              </p>
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
              placeholder="Paste at least 200 characters of your draft. The more text you give, the better the phrase analysis."
              className={`${inputStyle} resize-y font-mono`}
              maxLength={TEXT_MAX}
            />
          </div>

          {error ? <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={running} className={buttonPrimary}>
              {running ? "Scanning…" : "Run self-check"}
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Powered by DeepSeek V4 Flash — your text is sent to OpenRouter and discarded.
            </span>
          </div>
        </form>
      </section>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
            <p>
              <strong>Honest disclaimer:</strong> This isn&apos;t a real plagiarism checker — it can&apos;t query Turnitin&apos;s database. It flags phrasing that LOOKS plagiarised so you can manually verify with Google.
            </p>
          </div>

          <section className={`rounded-2xl border ${overall!.border} ${overall!.bg} p-5 shadow-sm`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Overall risk
              </h2>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${overall!.pill}`}>
                {RISK_LABEL[result.overallRisk]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.summary}
            </p>
          </section>

          {result.phrases.length === 0 ? (
            <section className={sectionCard}>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Nothing distinctive enough to flag. That&apos;s a good sign — but still spot-check anything you remember pulling from a source.
              </p>
            </section>
          ) : (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Flagged phrases ({result.phrases.length})
              </h3>
              {result.phrases.map((p, i) => {
                const c = riskColour(p.risk);
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        #{i + 1} · {CATEGORY_LABEL[p.category] ?? "Other"}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.pill}`}>
                        {RISK_LABEL[p.risk]}
                      </span>
                    </div>
                    <p className="mt-2 text-base italic text-slate-900 dark:text-slate-100">
                      &ldquo;{p.phrase}&rdquo;
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {p.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={googleUrl(p.phrase)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonSecondary}
                      >
                        Search Google
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(p.phrase);
                            toast.success("Phrase copied");
                          } catch {
                            toast.error("Couldn't copy");
                          }
                        }}
                        className={buttonSecondary}
                      >
                        Copy phrase
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {result.advice.length > 0 && (
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                What to do next
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700 dark:text-slate-300">
                {result.advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
      )}
    </main>
  );
}
