"use client";

import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import type { Id } from "@/convex/_generated/dataModel";

const MIN_TEXT = 50;
const MAX_TEXT = 100000;

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";

type ParsedReference = {
  sourceType: string;
  fields: Record<string, unknown>;
  formatted: string;
  inTextShort: string;
  inTextNarrative: string;
  sortKey: string;
  issues: string[];
};

type ParseResult = {
  summary: string;
  references: ParsedReference[];
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  journalArticle: "Journal article",
  book: "Book",
  bookChapter: "Book chapter",
  webpage: "Webpage",
  report: "Report",
  thesis: "Thesis",
  newspaperArticle: "Newspaper article",
  other: "Other",
};

// Render a string with *italicised* parts using <em>. Splits on the asterisks.
function renderFormatted(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function BibliographyClient() {
  const parseAction = useAction(api.bibliographyImport.parse);
  const createReference = useMutation(api.references.create);
  const assignments = useQuery(api.assignments.list);

  const [text, setText] = useState("");
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [rowStatus, setRowStatus] = useState<
    Record<number, { status: "pending" | "importing" | "done" | "failed"; error?: string }>
  >({});
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-bibliography");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-bibliography", "1");
    } catch {}
  };

  const textLen = text.length;
  const tooShort = textLen > 0 && textLen < MIN_TEXT;
  const tooLong = textLen > MAX_TEXT;

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const handleParse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setImportedCount(0);
    if (textLen < MIN_TEXT) {
      setError(`Please paste at least ${MIN_TEXT} characters.`);
      return;
    }
    if (textLen > MAX_TEXT) {
      setError(
        `Too long — please trim to ${MAX_TEXT.toLocaleString("en-NZ")} characters or split into chunks.`
      );
      return;
    }
    setRunning(true);
    try {
      const res = (await parseAction({ text })) as ParseResult;
      setResult(res);
      // Default: every parsed entry is checked
      const initial: Record<number, boolean> = {};
      res.references.forEach((_, i) => {
        initial[i] = true;
      });
      setSelected(initial);
      setRowStatus({});
      toast.success(
        `Parsed ${res.references.length} reference${res.references.length === 1 ? "" : "s"}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not parse the bibliography. Please try again."
      );
    } finally {
      setRunning(false);
    }
  };

  const toggleAll = (value: boolean) => {
    if (!result) return;
    const next: Record<number, boolean> = {};
    result.references.forEach((_, i) => {
      next[i] = value;
    });
    setSelected(next);
  };

  const handleImport = async () => {
    if (!result) return;
    const toImportIndices = result.references
      .map((_, i) => i)
      .filter((i) => selected[i]);
    if (toImportIndices.length === 0) {
      toast.error("No references selected");
      return;
    }
    setImporting(true);
    setImportedCount(0);
    // Mark all selected rows as pending up front
    setRowStatus((prev) => {
      const next = { ...prev };
      for (const i of toImportIndices) {
        next[i] = { status: "pending" };
      }
      return next;
    });
    const toastId = toast.loading(
      `Importing 0 of ${toImportIndices.length} references…`
    );
    let done = 0;
    let failed = 0;
    const BATCH_SIZE = 5;
    for (let start = 0; start < toImportIndices.length; start += BATCH_SIZE) {
      const batch = toImportIndices.slice(start, start + BATCH_SIZE);
      // Mark the batch as importing
      setRowStatus((prev) => {
        const next = { ...prev };
        for (const i of batch) {
          next[i] = { status: "importing" };
        }
        return next;
      });
      const results = await Promise.allSettled(
        batch.map((i) => {
          const ref = result.references[i];
          return createReference({
            assignmentId:
              assignmentId
                ? (assignmentId as Id<"assignments">)
                : undefined,
            sourceType: ref.sourceType,
            fields: ref.fields,
            formatted: ref.formatted,
            inTextShort: ref.inTextShort,
            inTextNarrative: ref.inTextNarrative,
            sortKey: ref.sortKey,
          });
        })
      );
      setRowStatus((prev) => {
        const next = { ...prev };
        results.forEach((r, k) => {
          const i = batch[k];
          if (r.status === "fulfilled") {
            next[i] = { status: "done" };
          } else {
            const msg =
              r.reason instanceof Error
                ? r.reason.message
                : "Import failed";
            next[i] = { status: "failed", error: msg };
            // eslint-disable-next-line no-console
            console.error("Import failed", r.reason);
          }
        });
        return next;
      });
      for (const r of results) {
        if (r.status === "fulfilled") done += 1;
        else failed += 1;
      }
      setImportedCount(done);
      toast.loading(
        `Imported ${done} of ${toImportIndices.length}${failed > 0 ? ` (${failed} failed)` : ""}…`,
        { id: toastId }
      );
    }
    setImporting(false);
    if (failed === 0) {
      toast.success(
        `Imported ${done} reference${done === 1 ? "" : "s"}`,
        {
          id: toastId,
          action: {
            label: "View references",
            onClick: () => {
              window.location.href = "/uni/references";
            },
          },
        }
      );
    } else {
      toast.success(
        `Imported ${done} (${failed} failed)`,
        { id: toastId }
      );
    }
  };

  const handleReset = () => {
    setText("");
    setResult(null);
    setError(null);
    setSelected({});
    setImportedCount(0);
    setRowStatus({});
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Bibliography Importer"
        title="Paste a reference list — get APA 7 entries"
        description="Drop in any reference list (Word doc, EndNote export, mixed APA 6 and APA 7, whatever). We parse each entry, normalise it to APA 7 and bulk-import the ones you want."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                Quick start
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Paste a chunk of references in any format into the big text area.</li>
                <li>Optional: pick the assignment you want them attached to.</li>
                <li>Click Parse — each reference is normalised to strict APA 7.</li>
                <li>Review the table. Untick any you don&rsquo;t want. Watch the amber notes for missing data.</li>
                <li>Click Import — selected entries land in your references list, ready to copy into Word.</li>
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

      <section className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
        <form onSubmit={handleParse} className="space-y-4">
          <div>
            <span className={labelStyle}>Attach to assignment (optional)</span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className={inputStyle}
            >
              <option value="">No assignment</option>
              {(assignments ?? []).map((a) => (
                <option key={a._id} value={a._id}>
                  {a.courseCode ? `${a.courseCode} · ` : ""}
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={labelStyle}>Reference list</span>
              <span
                className={`text-xs ${
                  tooLong
                    ? "text-rose-500 dark:text-rose-400"
                    : tooShort
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-slate-500 dark:text-slate-400"
                }`}
                title={`${textLen.toLocaleString()} of ${MAX_TEXT.toLocaleString()} characters`}
              >
                {textLen.toLocaleString("en-NZ")} chars
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              required
              placeholder="Paste your reference list here. Any format is fine — we&rsquo;ll sort it out."
              className={`${inputStyle} resize-y font-mono`}
            />
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || tooShort || tooLong || textLen === 0}
              className={buttonPrimary}
            >
              {running ? "Parsing…" : "Parse"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={running || importing}
              className={buttonSecondary}
            >
              Reset
            </button>
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
              Parse summary
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-900 dark:text-slate-100">
              {result.summary}
            </p>
          </section>

          {result.references.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Parsed references ({result.references.length})
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => toggleAll(true)} className={buttonSecondary}>
                    Select all
                  </button>
                  <button type="button" onClick={() => toggleAll(false)} className={buttonSecondary}>
                    Deselect all
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {result.references.map((ref, i) => {
                  const status = rowStatus[i];
                  const tone =
                    status?.status === "done"
                      ? "bg-emerald-50 dark:bg-emerald-950/20"
                      : status?.status === "failed"
                        ? "bg-rose-50 dark:bg-rose-950/20"
                        : status?.status === "importing"
                          ? "bg-sky-50 dark:bg-sky-950/20"
                          : "";
                  return (
                  <li key={i} className={`flex gap-3 py-3 px-2 ${tone}`}>
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={!!selected[i]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [i]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                        aria-label={`Import ${ref.sortKey}`}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-200">
                          {SOURCE_TYPE_LABELS[ref.sourceType] ?? ref.sourceType}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {ref.inTextShort}
                        </span>
                        {status?.status === "done" && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                            ✓ Imported
                          </span>
                        )}
                        {status?.status === "failed" && (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
                            ✗ Failed
                          </span>
                        )}
                        {status?.status === "importing" && (
                          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-medium text-white">
                            Importing…
                          </span>
                        )}
                        {status?.status === "pending" && (
                          <span className="rounded-full bg-slate-400 px-2 py-0.5 text-xs font-medium text-white">
                            Queued
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                        {renderFormatted(ref.formatted)}
                      </p>
                      {status?.status === "failed" && status.error && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          {status.error}
                        </p>
                      )}
                      {ref.issues && ref.issues.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {ref.issues.map((issue, j) => (
                            <li
                              key={j}
                              className="text-xs text-amber-600 dark:text-amber-400"
                            >
                              ! {issue}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedCount} of {result.references.length} selected
                  {importedCount > 0 && ` · ${importedCount} imported`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {importedCount > 0 && (
                    <Link href="/uni/references" className={buttonSecondary}>
                      View references
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || selectedCount === 0}
                    className={buttonPrimary}
                  >
                    {importing
                      ? `Importing… (${importedCount}/${selectedCount})`
                      : `Import ${selectedCount} selected reference${selectedCount === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      )}
    </main>
  );
}
