"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

const MIN_TEXT = 100;
const MAX_TEXT = 50000;

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";
const sectionCard =
  "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none";

type Citation = {
  text: string;
  type: "parenthetical" | "narrative";
  authorLast: string;
  year: string;
  page: string | null;
  paragraphIndex: number;
};

type ExtractResult = {
  citations: Citation[];
  paragraphsWithNoCitations: number[];
  summary: string;
  missingFromRefList: string[];
  unusedRefs: { id: string; label: string }[];
  totalCitations: number;
  totalRefs: number;
};

export default function CitationsClient() {
  const extract = useAction(api.citations.extract);
  const assignments = useQuery(api.assignments.list);

  const [text, setText] = useState("");
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-citations");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-citations", "1");
    } catch {}
  };

  const textLen = text.length;
  const tooShort = textLen > 0 && textLen < MIN_TEXT;
  const tooLong = textLen > MAX_TEXT;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    if (textLen < MIN_TEXT) {
      toast.error(`Paste at least ${MIN_TEXT} characters of your draft.`);
      return;
    }
    if (textLen > MAX_TEXT) {
      toast.error(`Draft is too long — trim to ${MAX_TEXT} characters or fewer.`);
      return;
    }
    setRunning(true);
    try {
      const res = (await extract({
        text,
        assignmentId:
          assignmentId === ""
            ? undefined
            : (assignmentId as Id<"assignments">),
      })) as ExtractResult;
      setResult(res);
      if (res.totalCitations === 0) {
        toast.message("No citations found in this draft.");
      } else {
        toast.success(`Found ${res.totalCitations} citations.`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not extract citations."
      );
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setText("");
    setResult(null);
  };

  const mismatchCount =
    (result?.missingFromRefList.length ?? 0) +
    (result?.unusedRefs.length ?? 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Citation Extractor"
        title="Find every citation and cross-check your references"
        description="Paste your draft. We pull out every in-text citation, match them against your saved references list, and flag what's missing or unused before your marker does."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                Quick start
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Pick the assignment your draft belongs to so we can match against the right references list.</li>
                <li>Paste your draft into the big text area.</li>
                <li>
                  Click Extract — every parenthetical and narrative citation is pulled out
                  and cross-checked against your saved references.
                </li>
                <li>
                  Anything in the rose card will lose you marks. Anything in the amber card
                  is dead weight you should either cite or remove.
                </li>
              </ol>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="Dismiss"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <section className={`mb-6 ${sectionCard}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className={labelStyle}>Assignment</span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className={inputStyle}
            >
              <option value="">All references (no assignment filter)</option>
              {assignments?.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                  {a.courseCode ? ` — ${a.courseCode}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose an assignment to cross-check against just that assignment&rsquo;s references list.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={labelStyle}>Your draft</span>
              <span
                className={`text-xs ${
                  tooLong
                    ? "text-rose-500 dark:text-rose-400"
                    : tooShort
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {textLen.toLocaleString("en-NZ")} / {MAX_TEXT.toLocaleString("en-NZ")} characters
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              required
              placeholder="Paste your draft here. At least 100 characters."
              className={`${inputStyle} resize-y font-mono`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || tooShort || tooLong || textLen === 0}
              className={buttonPrimary}
            >
              {running ? "Extracting…" : "Extract citations"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={running}
              className={buttonSecondary}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {running && !result && (
        <div className={sectionCard}>
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
          <section className="grid grid-cols-3 gap-3">
            <div className={`${sectionCard} text-center`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Citations
              </p>
              <p className="mt-2 text-3xl font-bold text-sky-500">
                {result.totalCitations}
              </p>
            </div>
            <div className={`${sectionCard} text-center`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                References
              </p>
              <p className="mt-2 text-3xl font-bold text-sky-500">
                {result.totalRefs}
              </p>
            </div>
            <div className={`${sectionCard} text-center`}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Mismatches
              </p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  mismatchCount === 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {mismatchCount}
              </p>
            </div>
          </section>

          {result.summary && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Summary
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                {result.summary}
              </p>
            </section>
          )}

          {result.missingFromRefList.length > 0 && (
            <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                These will lose you marks
              </h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Cited in your draft but missing from your references list. Add a matching reference for each.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-900 dark:text-slate-100">
                {result.missingFromRefList.map((m, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(m);
                          toast.success("Copied — paste into the References add form", {
                            action: {
                              label: "Open References →",
                              onClick: () => {
                                window.location.href =
                                  assignmentId === ""
                                    ? "/uni/references"
                                    : `/uni/references?assignmentId=${assignmentId}`;
                              },
                            },
                          });
                        } catch {
                          toast.error("Couldn't copy");
                        }
                      }}
                      className="block w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-left font-mono text-xs text-rose-900 transition-colors hover:border-rose-500 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-200 dark:hover:bg-rose-950/40"
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.unusedRefs.length > 0 && (
            <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Unused references
              </h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                These are in your references list but never cited in the draft. Either cite them or remove them — markers penalise dead weight.
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-900 dark:text-slate-100">
                {result.unusedRefs.map((r) => (
                  <li key={r.id}>{r.label}</li>
                ))}
              </ul>
            </section>
          )}

          {result.paragraphsWithNoCitations.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Paragraphs with no citations
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Paragraphs of pure assertion. Each one needs at least one source backing the claim.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.paragraphsWithNoCitations.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-800 dark:text-amber-200"
                  >
                    Paragraph {p + 1}
                  </span>
                ))}
              </div>
            </section>
          )}

          {result.citations.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                All citations
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2 pr-3 font-medium">Citation</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Author</th>
                      <th className="py-2 pr-3 font-medium">Year</th>
                      <th className="py-2 pr-3 font-medium">Page</th>
                      <th className="py-2 pr-3 font-medium">¶</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.citations.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-900"
                      >
                        <td className="py-2 pr-3 font-mono text-slate-900 dark:text-slate-100">
                          {c.text}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                          {c.type}
                        </td>
                        <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                          {c.authorLast}
                        </td>
                        <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                          {c.year}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                          {c.page ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                          {c.paragraphIndex + 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </motion.div>
      )}
    </main>
  );
}
