"use client";

// APA Reference-List Validator — paste a finished reference list, get a
// per-entry APA 7 verdict (ok / minor / major) with specific errors and a
// corrected version. Validate-only; does not touch the saved reference list.

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

type Status = "ok" | "minor" | "major";

interface Entry {
  raw: string;
  status: Status;
  issues: string[];
  corrected: string;
}

interface ReviewResult {
  overall: { entryCount: number; cleanCount: number; summary: string };
  entries: Entry[];
}

const MIN = 20;
const MAX = 15000;

const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-950 dark:to-slate-950";

const STATUS_INFO: Record<Status, { label: string; pill: string }> = {
  ok: {
    label: "OK",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  minor: {
    label: "Minor",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  major: {
    label: "Major",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  },
};

// Render *asterisk*-wrapped spans as italics (APA italic convention used by
// the backend, matching the Bibliography Importer).
function renderItalics(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <em key={i}>{p.slice(1, -1)}</em>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

export default function ApaCheckClient() {
  const review = useAction(api.apaReview.review);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (text.trim().length < MIN) {
      setError(`Paste at least one full reference (${MIN}+ characters).`);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = (await review({ referenceList: text })) as ReviewResult;
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed.");
    } finally {
      setRunning(false);
    }
  };

  const copyCorrected = async (s: string) => {
    // Strip the *asterisks* so the clipboard gets clean text (Word italics
    // are applied by hand — same as the rest of the tool).
    try {
      await navigator.clipboard.writeText(s.replace(/\*/g, ""));
      toast.success("Corrected reference copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="APA Reference Check"
        title="Validate your reference list before you submit"
        description="Paste your finished reference list. Every entry is checked against APA 7 — you get the specific errors and a corrected version. It doesn't touch your saved references; it's purely a last-minute formatting check."
      />

      <section className={`${sectionCard} mb-6`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Your reference list
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {text.length.toLocaleString("en-NZ")} / {MAX.toLocaleString("en-NZ")}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              maxLength={MAX}
              placeholder={"Paste each reference on its own line, e.g.\n\nSmith, J. (2019). The title of the article. Journal of Things, 24(3), 100-115."}
              className={`${inputStyle} resize-y font-mono`}
            />
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <button type="submit" disabled={running} className={buttonPrimary}>
            {running ? "Checking…" : "Check APA 7"}
          </button>
        </form>
      </section>

      {result && (
        <div className="space-y-5">
          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Result
              </h2>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {result.overall.cleanCount} / {result.overall.entryCount} clean
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.overall.summary}
            </p>
          </section>

          {result.entries.map((en, i) => {
            const info = STATUS_INFO[en.status] ?? STATUS_INFO.minor;
            return (
              <section key={i} className={sectionCard}>
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {en.raw}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${info.pill}`}
                  >
                    {info.label}
                  </span>
                </div>

                {en.issues.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                    {en.issues.map((iss, j) => (
                      <li key={j}>{iss}</li>
                    ))}
                  </ul>
                )}

                {en.status !== "ok" && en.corrected && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-emerald-900 dark:text-emerald-200">
                        {renderItalics(en.corrected)}
                      </p>
                      <button
                        type="button"
                        onClick={() => copyCorrected(en.corrected)}
                        className="shrink-0 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
