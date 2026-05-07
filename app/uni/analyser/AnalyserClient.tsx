"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";
const sectionCard =
  "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none";

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
  const iterate = useAction(api.analyser.iterate);
  const toggleBulletMutation = useMutation(api.analysisStore.toggleBullet);
  const removeAnalysis = useMutation(api.analysisStore.remove);

  const assignments = useQuery(api.assignments.list);
  const savedAnalyses = useQuery(api.analysisStore.list, {});

  const [assignmentId, setAssignmentId] = useState<Id<"assignments"> | "">("");
  const [analysisId, setAnalysisId] = useState<Id<"analyses"> | null>(null);
  const [extractingPdf, setExtractingPdf] = useState<null | "brief" | "rubric">(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [brief, setBrief] = useState("");
  const [rubric, setRubric] = useState("");
  const [wordCountTarget, setWordCountTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [checkedBullets, setCheckedBullets] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);

  // Reactively sync local state when the saved analysis updates (e.g. after
  // a checkbox toggle saves to Convex). We track the current analysisId and
  // pull from savedAnalyses.
  useEffect(() => {
    if (!analysisId || !savedAnalyses) return;
    const current = savedAnalyses.find((a) => a._id === analysisId);
    if (current) {
      setCheckedBullets(new Set(current.checkedBullets ?? []));
    }
  }, [analysisId, savedAnalyses]);

  const loadSaved = (a: NonNullable<typeof savedAnalyses>[number]) => {
    setAnalysisId(a._id);
    setAssignmentId(a.assignmentId ?? "");
    setBrief(a.brief);
    setRubric(a.rubric ?? "");
    setWordCountTarget(a.wordCountTarget ? String(a.wordCountTarget) : "");
    setResult(a.result as AnalysisResult);
    setCheckedBullets(new Set(a.checkedBullets ?? []));
    setError(null);
    setShowFeedback(false);
  };

  // Extract text from a PDF the user uploads, populate the brief textarea.
  // Uses Mozilla's pdfjs-dist via dynamic import + CDN-loaded worker so the
  // ~2MB JS only downloads when first needed.
  const handlePdfUpload = async (file: File, target: "brief" | "rubric") => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Please choose a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF is over 20MB — please trim and try again.");
      return;
    }
    setExtractingPdf(target);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const total = doc.numPages;
      setPdfProgress({ done: 0, total });
      const parts: string[] = [];
      for (let i = 1; i <= total; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ");
        parts.push(text);
        setPdfProgress({ done: i, total });
      }
      let extracted = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
      if (extracted.length < 30) {
        toast.error(
          "Couldn't pull text from that PDF — it might be scanned / image-based. Try OCR'ing it first."
        );
        return;
      }
      let truncated = false;
      if (extracted.length > BRIEF_LIMIT) {
        extracted = extracted.slice(0, BRIEF_LIMIT);
        truncated = true;
      }
      if (target === "brief") setBrief(extracted);
      else setRubric(extracted);
      toast.success(
        truncated
          ? `Extracted ${total} pages — trimmed to ${BRIEF_LIMIT} chars`
          : `Extracted ${total} pages from "${file.name}" into ${target}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF extraction failed");
    } finally {
      setExtractingPdf(null);
      setPdfProgress(null);
    }
  };

  const sendKeywordsToSources = (keywords: string[]) => {
    const q = keywords.slice(0, 6).join(" ");
    const url = `/uni/sources?q=${encodeURIComponent(q)}`;
    window.location.href = url;
  };

  const sendBriefToCoach = () => {
    try {
      window.sessionStorage.setItem("uni:coach:prefilled-brief", brief);
      window.location.href = "/uni/coach";
    } catch {
      window.location.href = "/uni/coach";
    }
  };

  const onToggleBullet = async (sectionIdx: number, bulletIdx: number) => {
    if (!analysisId) return;
    const key = `${sectionIdx}:${bulletIdx}`;
    // optimistic update
    setCheckedBullets((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      await toggleBulletMutation({ id: analysisId, bulletKey: key });
    } catch {
      // revert on error
      setCheckedBullets((s) => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      toast.error("Couldn't save your tick");
    }
  };

  const onIterate = async () => {
    if (!analysisId || !feedback.trim()) {
      toast.error("Add some feedback first.");
      return;
    }
    setIterating(true);
    try {
      const res = (await iterate({ id: analysisId, feedback })) as {
        result: AnalysisResult;
      };
      setResult(res.result);
      setCheckedBullets(new Set()); // outline likely changed; reset
      setFeedback("");
      setShowFeedback(false);
      toast.success("Updated with your feedback");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't iterate.");
    } finally {
      setIterating(false);
    }
  };

  const onDeleteAnalysis = async () => {
    if (!analysisId) return;
    const id = analysisId;
    toast(`Delete this saved plan?`, {
      duration: 8000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await removeAnalysis({ id });
            toast.success("Plan deleted");
            setAnalysisId(null);
            setResult(null);
            setBrief("");
            setRubric("");
            setWordCountTarget("");
            setCheckedBullets(new Set());
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't delete");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

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
        assignmentId?: Id<"assignments">;
      } = { brief };
      if (rubric.trim()) args.rubric = rubric;
      if (wordCountTarget.trim()) {
        const n = Number(wordCountTarget);
        if (Number.isFinite(n) && n > 0) args.wordCountTarget = Math.round(n);
      }
      if (assignmentId) args.assignmentId = assignmentId;
      const res = (await analyse(args)) as {
        id: Id<"analyses">;
        result: AnalysisResult;
      };
      setResult(res.result);
      setAnalysisId(res.id);
      setCheckedBullets(new Set());
      setOpenSections({});
      toast.success("Plan saved");
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

      {savedAnalyses && savedAnalyses.length > 0 && (
        <section className={`${sectionCard} mb-6`}>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300">
              Saved plans ({savedAnalyses.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {savedAnalyses.map((a) => {
                const assignment = assignments?.find((x) => x._id === a.assignmentId);
                const summary =
                  (a.result as AnalysisResult | null)?.keyQuestion ??
                  a.brief.slice(0, 80);
                const isCurrent = a._id === analysisId;
                return (
                  <li key={a._id}>
                    <button
                      type="button"
                      onClick={() => loadSaved(a)}
                      className={`block w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                        isCurrent
                          ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-900/30"
                          : "border-slate-200 bg-white hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-700"
                      }`}
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {assignment ? assignment.name : "Unassigned"}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">{summary}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Saved {new Date(a._creationTime).toLocaleDateString("en-NZ", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      )}

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
              <div className="flex items-center gap-3">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300 ${
                    extractingPdf !== null ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePdfUpload(f, "brief");
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={extractingPdf !== null}
                  />
                  <span aria-hidden>📄</span>
                  <span>
                    {extractingPdf === "brief"
                      ? pdfProgress
                        ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                        : "Reading PDF…"
                      : "Upload PDF"}
                  </span>
                </label>
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
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={labelStyle}>Save this plan to:</span>
              <select
                value={assignmentId}
                onChange={(e) =>
                  setAssignmentId(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as Id<"assignments">)
                  )
                }
                className={`${inputStyle} mt-0 max-w-[20rem]`}
              >
                <option value="">No assignment (unassigned)</option>
                {assignments?.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.courseCode ? `${a.courseCode} — ${a.name}` : a.name}
                  </option>
                ))}
              </select>
              <Link
                href="/uni/references"
                className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                + Manage assignments
              </Link>
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
            <div className="flex items-baseline justify-between">
              <span className={labelStyle}>Marking rubric (optional)</span>
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300 ${
                  extractingPdf !== null ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePdfUpload(f, "rubric");
                    e.target.value = "";
                  }}
                  className="hidden"
                  disabled={extractingPdf !== null}
                />
                <span aria-hidden>📄</span>
                <span>
                  {extractingPdf === "rubric"
                    ? pdfProgress
                      ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                      : "Reading PDF…"
                    : "Upload PDF"}
                </span>
              </label>
            </div>
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
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Outline
              </h3>
              {analysisId && result.outline.length > 0 && (() => {
                const total = result.outline.reduce((sum, o) => sum + o.bullets.length, 0);
                const done = checkedBullets.size;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                return (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {done}/{total} ticked ({pct}%)
                  </span>
                );
              })()}
            </div>
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
                        <ul className="space-y-1.5 px-3 pb-3 pt-1 text-sm text-slate-800 dark:text-slate-200">
                          {o.bullets.map((b, j) => {
                            const key = `${i}:${j}`;
                            const checked = checkedBullets.has(key);
                            return (
                              <li key={j} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => void onToggleBullet(i, j)}
                                  disabled={!analysisId}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                                />
                                <span
                                  className={
                                    checked
                                      ? "text-slate-500 line-through dark:text-slate-500"
                                      : ""
                                  }
                                >
                                  {b}
                                </span>
                              </li>
                            );
                          })}
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
              <div className="flex flex-wrap gap-2">
                {result.researchKeywords.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => sendKeywordsToSources(result.researchKeywords)}
                      className={buttonPrimary}
                      title="Open Source Finder pre-loaded with these keywords"
                    >
                      Search on OpenAlex →
                    </button>
                    <button onClick={copyKeywords} className={buttonSecondary}>
                      {copiedKeywords ? "Copied" : "Copy keywords"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {result.researchKeywords.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No keywords yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.researchKeywords.map((k, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendKeywordsToSources([k])}
                    className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-800 ring-1 ring-sky-200 transition-colors hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700/50 dark:hover:bg-sky-900/60"
                    title={`Search "${k}" on OpenAlex`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Workflow: send to Coach when ready to draft */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Next step
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Once you've drafted some of this, take it to the Draft Coach for scored feedback.
                </p>
              </div>
              <button
                type="button"
                onClick={sendBriefToCoach}
                className={buttonPrimary}
              >
                Send brief to Draft Coach →
              </button>
            </div>
          </section>

          {/* Refine the analysis with feedback */}
          {analysisId && (
            <section className={sectionCard}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Refine this plan
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFeedback((s) => !s)}
                    className={buttonSecondary}
                  >
                    {showFeedback ? "Cancel" : "Add feedback"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteAnalysis()}
                    className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
                  >
                    Delete plan
                  </button>
                </div>
              </div>
              {showFeedback && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                    placeholder={`e.g. "Make the outline focus more on Mātauranga Māori frameworks" or "The word-count split feels off — give the discussion more space"`}
                    className={`${inputStyle} text-sm`}
                  />
                  <button
                    type="button"
                    onClick={() => void onIterate()}
                    disabled={iterating || !feedback.trim()}
                    className={buttonPrimary}
                  >
                    {iterating ? "Refining…" : "Refine with feedback"}
                  </button>
                </div>
              )}
            </section>
          )}
        </motion.div>
      )}
    </main>
  );
}
