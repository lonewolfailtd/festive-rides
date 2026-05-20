"use client";

// Article Q&A — upload an article PDF, paste assignment questions,
// get verbatim-quote-backed answers extracted from the article.
//
// Different from Source Lens: this tool assumes you've already
// committed to reading this specific paper for a specific assignment
// question. It's a research-notes extractor, not a relevance judge.
//
// Hard product principle: the tool returns facts and verbatim quotes.
// The student writes the answer paragraph themselves. No essay drafting.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import { loadPdfjs } from "@/lib/pdfjs";

const ACTIVE_EVENT = "uni:active-assignment-changed";
const STORAGE_KEY = "uni-active-assignment-v1";

const TEXT_MIN = 500;
const TEXT_MAX = 200000;

// Default questions — based on common Open Polytechnic AS-style
// "read article and answer" tasks. Saves typing for the common case;
// students can edit/delete what doesn't apply.
const DEFAULT_QUESTIONS = [
  "Are the authors credible? Explain why.",
  "Is the journal academically credible? Explain why.",
  "What is the aim of the research?",
  "How many participants were in the study?",
  "What are the relevant demographics of the participants?",
  "What is the name of one of the materials used? Give two example items from it.",
  "What is one key finding of the research?",
  "What is one limitation the article identifies?",
  "What is one future direction the article suggests?",
].join("\n");

interface SupportingQuote {
  quote: string;
  section: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
  supportingQuotes: SupportingQuote[];
  confidence: "high" | "medium" | "low";
  notesForStudent?: string | null;
}

interface QAResult {
  articleSummary: string;
  authors: {
    names: string[];
    affiliations?: string | null;
    credibilityNotes: string;
  };
  journal: {
    name?: string | null;
    indexingNotes: string;
  };
  apaReference: string;
  answers: QuestionAnswer[];
  missingQuestions: string[];
  // 3-5 Source Finder search queries the AI thinks the student could
  // run to find supporting sources beyond this one article. Renders
  // as clickable chips that open Source Finder pre-filled.
  suggestedSearches?: string[];
}

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]";

const CONFIDENCE_TONE: Record<QuestionAnswer["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// Whitespace + smart-character normalisation so AI-emitted quotes
// match against the pdfjs-extracted text even when the AI tweaked
// spaces, dashes or curly quotes. Same approach as the Source Lens
// Reader's highlight matcher.
function normaliseForMatch(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

// Find a quote inside the extracted article text, returning the
// surrounding context. Returns null if the quote can't be located
// (rare but possible if the AI paraphrased very slightly).
function findContext(
  text: string,
  quote: string,
  contextChars = 350,
): { before: string; match: string; after: string; pageHint: string } | null {
  if (!text || !quote || quote.length < 10) return null;
  const normText = normaliseForMatch(text);
  const normQuote = normaliseForMatch(quote);
  const idx = normText.indexOf(normQuote);
  if (idx < 0) return null;
  // Map normalised idx back to original-text position. Approximate
  // (collapsed-whitespace runs in original become one space in
  // normalised), but good enough for "show me ~350 chars around this".
  let origStart = 0;
  let normCursor = 0;
  while (origStart < text.length && normCursor < idx) {
    if (/\s/.test(text[origStart])) {
      while (origStart < text.length && /\s/.test(text[origStart])) {
        origStart++;
      }
      normCursor++;
    } else {
      origStart++;
      normCursor++;
    }
  }
  // Find the end of the match similarly. For simplicity, just take
  // the next N original characters where N = quote length plus some
  // padding for normalised whitespace collapse.
  const origEnd = Math.min(
    text.length,
    origStart + Math.ceil(normQuote.length * 1.5),
  );
  const beforeStart = Math.max(0, origStart - contextChars);
  const afterEnd = Math.min(text.length, origEnd + contextChars);
  // Find the nearest [Page N] marker that appears before the match
  // — gives the student a clear page reference even if the AI's
  // section label was vague.
  const beforeText = text.slice(0, origStart);
  const pageMatches = beforeText.match(/\[Page (\d+)\]/g);
  const pageHint = pageMatches
    ? `Around p. ${pageMatches[pageMatches.length - 1].match(/\d+/)?.[0] ?? "?"}`
    : "";
  return {
    before: text.slice(beforeStart, origStart),
    match: text.slice(origStart, origEnd),
    after: text.slice(origEnd, afterEnd),
    pageHint,
  };
}

export default function ArticleQAClient() {
  const answerAction = useAction(api.articleQA.answer);
  const extractQuestionsAction = useAction(api.articleQA.extractQuestions);
  const assignments = useQuery(api.assignments.list);

  const [activeId, setActiveId] = useState<Id<"assignments"> | "">("");
  const [articleText, setArticleText] = useState("");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QAResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Snapshot of the article text + filename used in the LAST successful
  // Q&A run. We need this to (a) show context around each quote, and
  // (b) open the in-app reader with the same text. Stored separately
  // from `articleText` (the textarea content) because the user might
  // edit/clear the textarea after running and we still want the
  // results panel to work.
  const [lastRunText, setLastRunText] = useState<string>("");
  const [lastRunSourceLabel, setLastRunSourceLabel] = useState<string>("");
  // Per-quote 'show context' toggle. Keyed by `${answerIdx}-${quoteIdx}`.
  const [contextOpen, setContextOpen] = useState<Record<string, boolean>>({});

  // Separate loading flag for the 'extract questions from brief' button.
  // Independent from the PDF extraction flag so they don't collide.
  const [extractingQuestions, setExtractingQuestions] = useState(false);

  // Task focus — empty = extract all tasks; "Task 2" / "Part A" / etc
  // filters the extraction to just that section. After an extraction
  // run we also stash the detectedTasks array so users can quickly
  // re-extract for a different task.
  const [taskFocus, setTaskFocus] = useState("");
  const [detectedTasks, setDetectedTasks] = useState<string[]>([]);

  // Honest elapsed timer.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastRunSeconds, setLastRunSeconds] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const stopTimer = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const startTimer = () => {
    stopTimer();
    setElapsedSeconds(0);
    const startedAt = performance.now();
    const tick = (now: number) => {
      setElapsedSeconds((now - startedAt) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopTimer(), []);

  // Onboarding flag.
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-article-qa");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-article-qa", "1");
    } catch {}
  };

  // Auto-pull active assignment from workspace bar.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setActiveId(stored as Id<"assignments">);
    } catch {}
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setActiveId((detail as Id<"assignments">) ?? "");
    };
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_EVENT, onChange);
  }, []);

  const activeAssignment = assignments?.find((x) => x._id === activeId);

  // PDF upload handler — extracts text client-side, populates the
  // textarea. Same pdfjs pattern as Source Lens Upload PDF.
  const handlePdfUpload = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      toast.error("PDF over 30MB — please trim.");
      return;
    }
    setExtracting(true);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await loadPdfjs();
      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const total = doc.numPages;
      setPdfProgress({ done: 0, total });
      const parts: string[] = [];
      const maxPages = Math.min(total, 50);
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const t = content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ");
        parts.push(`[Page ${i}]\n${t}`);
        setPdfProgress({ done: i, total: maxPages });
      }
      let extracted = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
      if (extracted.length < TEXT_MIN) {
        toast.error(
          "Couldn't extract enough text from this PDF — may be a scanned image (no OCR).",
        );
        return;
      }
      if (extracted.length > TEXT_MAX) extracted = extracted.slice(0, TEXT_MAX);
      setArticleText(extracted);
      toast.success(
        `Extracted ${maxPages} page${maxPages === 1 ? "" : "s"} from "${file.name}"`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF extraction failed");
    } finally {
      setExtracting(false);
      setPdfProgress(null);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (articleText.trim().length < TEXT_MIN) {
      setError(
        `Paste or upload an article — at least ${TEXT_MIN} characters of extracted text.`,
      );
      return;
    }
    const questionList = questions
      .split("\n")
      .map((q) => q.trim())
      // Strip leading numbering like "1." or "1)" so they don't count
      // toward the meaningful chars; the AI's question echo will be
      // cleaner without it too.
      .map((q) => q.replace(/^\s*\d+[.)]\s*/, ""))
      .filter((q) => q.length > 0);
    if (questionList.length === 0) {
      setError("Paste at least one question.");
      return;
    }
    if (questionList.length > 20) {
      setError("Too many questions — limit to 20 per run.");
      return;
    }

    setRunning(true);
    setResult(null);
    setLastRunSeconds(null);
    setContextOpen({}); // reset per-quote expand state from prior runs
    const startedAt = performance.now();
    startTimer();
    try {
      const r = (await answerAction({
        extractedText: articleText,
        questions: questionList,
        assignmentBrief: activeAssignment?.brief ?? undefined,
        assignmentName: activeAssignment?.name ?? undefined,
      })) as QAResult;
      setResult(r);
      // Snapshot the article text so "show context" + the in-app
      // reader can use exactly what the AI analysed, even if the
      // student later edits the textarea.
      setLastRunText(articleText);
      setLastRunSourceLabel(
        (r.authors?.names ?? []).slice(0, 2).join(", ") ||
          activeAssignment?.name ||
          "Article",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Article Q&A failed.");
    } finally {
      stopTimer();
      setLastRunSeconds((performance.now() - startedAt) / 1000);
      setRunning(false);
    }
  };

  const charCount = articleText.length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Article Q&A"
        title="Read an article, get verbatim answers"
        description="Upload an academic article PDF, paste your assignment questions, and the AI extracts facts with verbatim supporting quotes. Designed for 'read this article and answer' assessment tasks. You write your own response — the tool just hands you the research notes."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                How this works
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Upload the article PDF (your browser extracts text — same engine as Quick Import).</li>
                <li>The questions textarea is pre-filled with common Open Polytech-style questions. Edit / clear / paste your own.</li>
                <li>Click Run. ~30-60 seconds later, each question has a factual answer + verbatim quotes from the article + section reference + confidence rating.</li>
                <li>You write your assignment paragraph in your own words, using the extracted facts and the auto-generated APA reference.</li>
              </ol>
              <p className="text-xs text-sky-900/80 dark:text-sky-200/80">
                <strong>This tool never writes your answer for you</strong> — it extracts facts you cite. Same ethic as Source Lens.
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
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Active assignment indicator */}
          {activeAssignment ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
              Active assignment: <strong>{activeAssignment.name}</strong>
              {activeAssignment.brief && (
                <span className="ml-2 text-emerald-700 dark:text-emerald-300">
                  · brief loaded as context
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No active assignment — questions will be answered without
              assignment-specific framing. Select an assignment from the
              dashboard for extra context.
            </div>
          )}

          {/* Article PDF / text input */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={labelStyle}>Article (PDF upload or paste text)</span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 transition-colors hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-500 dark:hover:bg-sky-900/40 ${
                    extracting ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void handlePdfUpload(f);
                    }}
                    className="hidden"
                    disabled={extracting}
                  />
                  <span aria-hidden>📄</span>
                  <span>
                    {extracting
                      ? pdfProgress
                        ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                        : "Reading PDF…"
                      : "Upload article PDF"}
                  </span>
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {charCount.toLocaleString("en-NZ")} chars
                </span>
              </div>
            </div>
            <textarea
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              rows={8}
              maxLength={TEXT_MAX}
              placeholder="Article text will appear here after upload. You can also paste raw text directly — anything from 500 characters up to 200,000 (~50 pages)."
              className={`${inputStyle} max-h-[280px] resize-y overflow-y-auto font-mono`}
            />
          </div>

          {/* Questions input */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={labelStyle}>
                Questions (one per line, copy from your assignment)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Extract questions from active assignment's brief.
                    Only shown when the assignment has a stored brief
                    (came from Quick Import). Cheap Flash-tier call. */}
                {activeAssignment?.brief && (
                  <>
                    {/* Task focus — narrow extraction to one task/part.
                        Empty = extract all article-related questions. */}
                    <input
                      type="text"
                      value={taskFocus}
                      onChange={(e) => setTaskFocus(e.target.value)}
                      placeholder="Task 2"
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
                      title="Optional: narrow extraction to a specific task/part. E.g., 'Task 2' or 'Part A'. Leave blank for all questions."
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (extractingQuestions) return;
                        setExtractingQuestions(true);
                        try {
                          const r = (await extractQuestionsAction({
                            assignmentBrief: activeAssignment.brief!,
                            taskFilter: taskFocus.trim() || undefined,
                          })) as {
                            questions: string[];
                            detectedTasks: string[];
                          };
                          setDetectedTasks(r.detectedTasks ?? []);
                          if (r.questions.length === 0) {
                            toast.info(
                              taskFocus.trim()
                                ? `No questions found for "${taskFocus}" in the brief. Try a different task or clear the filter.`
                                : "No article-related questions found in the brief. Paste them manually.",
                            );
                            return;
                          }
                          setQuestions(r.questions.join("\n"));
                          toast.success(
                            `Extracted ${r.questions.length} question${r.questions.length === 1 ? "" : "s"}${taskFocus.trim() ? ` for ${taskFocus}` : ""}.`,
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Couldn't extract questions",
                          );
                        } finally {
                          setExtractingQuestions(false);
                        }
                      }}
                      disabled={extractingQuestions}
                      className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 transition-colors hover:border-violet-500 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:border-violet-500 dark:hover:bg-violet-900/40"
                      title="Auto-extract the article-related questions from your active assignment's brief. Optionally narrow to a specific task using the input on the left."
                    >
                      {extractingQuestions ? "Extracting…" : "🪄 From brief"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setQuestions(DEFAULT_QUESTIONS)}
                  className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-300"
                >
                  Reset to default
                </button>
              </div>
            </div>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              rows={9}
              placeholder="Paste questions, one per line. Numbering (1., 2., etc.) is fine — we'll strip it."
              className={`${inputStyle} resize-y font-mono`}
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Up to 20 questions per run. More than that, split into batches.
            </p>
            {/* Detected-task chips — quick "re-extract for X" shortcuts.
                Only shows after we've done one extraction and the AI
                reported multiple sections in the brief. */}
            {detectedTasks.length > 1 && activeAssignment?.brief && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Detected:
                </span>
                {detectedTasks.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={extractingQuestions}
                    onClick={() => {
                      setTaskFocus(t);
                      // Re-extract immediately for the clicked task
                      void (async () => {
                        if (extractingQuestions) return;
                        setExtractingQuestions(true);
                        try {
                          const r = (await extractQuestionsAction({
                            assignmentBrief: activeAssignment.brief!,
                            taskFilter: t,
                          })) as {
                            questions: string[];
                            detectedTasks: string[];
                          };
                          if (r.questions.length === 0) {
                            toast.info(`No questions found for "${t}".`);
                            return;
                          }
                          setQuestions(r.questions.join("\n"));
                          toast.success(
                            `Switched to ${t} (${r.questions.length} questions).`,
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Couldn't extract questions",
                          );
                        } finally {
                          setExtractingQuestions(false);
                        }
                      })();
                    }}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-60 ${
                      taskFocus.trim() === t
                        ? "border-violet-500 bg-violet-100 font-medium text-violet-900 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-100"
                        : "border-slate-300 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {taskFocus && (
                  <button
                    type="button"
                    onClick={() => setTaskFocus("")}
                    className="text-[11px] text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    clear
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || extracting}
              className={buttonPrimary}
            >
              {running ? "Reading article…" : "Answer questions"}
            </button>
            <button
              type="button"
              onClick={() => {
                setArticleText("");
                setResult(null);
                setError(null);
              }}
              className={buttonSecondary}
            >
              Clear article
            </button>
          </div>

          {running && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium">
                  Reading article and answering your questions…
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {Math.floor(elapsedSeconds)}s elapsed
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                <div
                  className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                  style={{ animation: "articleqa-slide 1.4s ease-in-out infinite" }}
                />
              </div>
              <style>{`
                @keyframes articleqa-slide {
                  0% { left: -33%; }
                  50% { left: 50%; }
                  100% { left: 100%; }
                }
              `}</style>
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
          {/* Article summary + credibility + APA reference */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Article overview
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* Open the full article reader with all the AI's
                    supporting quotes highlighted on the article text.
                    Reuses /uni/sources/reader which already does this
                    for Source Lens Deep Read — we just transform our
                    Q&A answers into the paragraphQuote shape it
                    expects. Handoff is via sessionStorage. */}
                {lastRunText && (
                  <button
                    type="button"
                    onClick={() => {
                      // Flatten all supporting quotes across all
                      // answers into paragraphQuote shape. Tag each
                      // with "Q{n}: {question}" as the section so
                      // when the reader shows the sidebar, the
                      // student can see which question each
                      // highlight is for.
                      const paragraphQuotes = result.answers.flatMap(
                        (a, ai) =>
                          a.supportingQuotes.map((q) => ({
                            section: `Q${ai + 1}: ${q.section}`,
                            quote: q.quote,
                            whyItMatters: a.answer,
                          })),
                      );
                      const sessionKey = `uni-source-reader-qa-${Date.now()}`;
                      const payload = {
                        sourceTitle:
                          lastRunSourceLabel || "Article (Article Q&A)",
                        sourceAuthors: result.authors.names ?? [],
                        sourceJournal: result.journal.name ?? undefined,
                        sourceText: lastRunText,
                        analysis: {
                          relevance: {
                            score: 8,
                            verdict:
                              "Highlights are the verbatim quotes Article Q&A used to answer your questions. Click any item in the sidebar to jump to it in the article.",
                          },
                          keyClaims: [],
                          quotablePhrases: [],
                          rubricFit: [],
                          suggestedCitation: result.apaReference ?? "",
                          skipIfRubricRequires: [],
                          abstractLimitation: "",
                          deepRead: true,
                          paragraphQuotes,
                        },
                        assignmentName: activeAssignment?.name,
                      };
                      try {
                        window.sessionStorage.setItem(
                          sessionKey,
                          JSON.stringify(payload),
                        );
                      } catch {
                        toast.error(
                          "Browser storage full — can't open reader.",
                        );
                        return;
                      }
                      window.open(
                        `/uni/sources/reader?session=${encodeURIComponent(sessionKey)}`,
                        "_blank",
                        "noopener",
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-500 dark:hover:bg-amber-900/40"
                    title="Open the article with all supporting quotes highlighted in a new tab"
                  >
                    📖 Read article with highlights
                  </button>
                )}
                {lastRunSeconds !== null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {lastRunSeconds < 60
                      ? `${lastRunSeconds.toFixed(1)}s`
                      : `${Math.floor(lastRunSeconds / 60)}m ${Math.floor(lastRunSeconds % 60)}s`}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {result.articleSummary}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Authors
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {result.authors.names.join(", ") || "Not identified"}
                </p>
                {result.authors.affiliations && (
                  <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">
                    {result.authors.affiliations}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                  {result.authors.credibilityNotes}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Journal
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {result.journal.name ?? "Not identified"}
                </p>
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                  {result.journal.indexingNotes}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                  APA 7 reference (auto-generated)
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.apaReference);
                      toast.success("Copied APA reference");
                    } catch {
                      toast.error("Couldn't copy");
                    }
                  }}
                  className="text-[11px] text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
                >
                  Copy
                </button>
              </div>
              <p className="mt-1 break-words font-mono text-xs text-emerald-900 dark:text-emerald-200">
                {result.apaReference}
              </p>
              <p className="mt-1.5 text-[11px] italic text-emerald-900/70 dark:text-emerald-200/70">
                Verify against the publisher's page — fields marked [unknown] need filling in.
              </p>
            </div>
          </section>

          {/* Per-question answers */}
          <section className={sectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Answers
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use these as research notes. Write your assignment paragraph in
              your own words, citing the article via the supporting quotes.
            </p>
            <ol className="mt-4 space-y-4">
              {result.answers.map((a, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Q{i + 1}. {a.question}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_TONE[a.confidence]}`}
                      title="Confidence the article actually contains this answer"
                    >
                      {a.confidence} confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    <strong className="text-sky-700 dark:text-sky-300">
                      Answer:
                    </strong>{" "}
                    {a.answer}
                  </p>
                  {a.supportingQuotes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Supporting quotes
                      </p>
                      <ul className="mt-1 space-y-1.5">
                        {a.supportingQuotes.map((q, j) => {
                          const ctxKey = `${i}-${j}`;
                          const isContextOpen =
                            contextOpen[ctxKey] ?? false;
                          // Try to locate the quote in the article
                          // text we used during the run. If found,
                          // we can offer expanded context.
                          const context = isContextOpen
                            ? findContext(lastRunText, q.quote)
                            : null;
                          return (
                            <li
                              key={j}
                              className="rounded-md border-l-2 border-amber-400 bg-amber-50/40 px-2 py-1 dark:border-amber-500 dark:bg-amber-950/20"
                            >
                              <p className="italic text-xs text-slate-800 dark:text-slate-200">
                                &ldquo;{q.quote}&rdquo;
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                  — {q.section}
                                </p>
                                {/* Only show the toggle if we have the
                                    extracted text in memory (i.e.
                                    after a successful run). */}
                                {lastRunText && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setContextOpen((s) => ({
                                        ...s,
                                        [ctxKey]: !isContextOpen,
                                      }))
                                    }
                                    className="text-[11px] font-medium text-amber-700 hover:text-amber-600 dark:text-amber-300"
                                  >
                                    {isContextOpen
                                      ? "Hide context"
                                      : "📍 Show in PDF context"}
                                  </button>
                                )}
                              </div>
                              {isContextOpen && (
                                <div className="mt-1.5 rounded-md border border-amber-200 bg-white p-2 dark:border-amber-900/60 dark:bg-slate-900">
                                  {context ? (
                                    <>
                                      {context.pageHint && (
                                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                          {context.pageHint}
                                        </p>
                                      )}
                                      <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                                        …
                                        <span className="opacity-70">
                                          {context.before}
                                        </span>
                                        <mark className="bg-amber-300/80 px-0.5 dark:bg-amber-500/40 dark:text-amber-100">
                                          {context.match}
                                        </mark>
                                        <span className="opacity-70">
                                          {context.after}
                                        </span>
                                        …
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-[11px] italic text-slate-500 dark:text-slate-400">
                                      Couldn&apos;t locate this quote in the
                                      extracted text — the AI may have
                                      slightly paraphrased. The verbatim
                                      quote above is what to cite.
                                    </p>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {a.notesForStudent && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      ⚠ {a.notesForStudent}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Missing questions warning */}
          {result.missingQuestions.length > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/60 dark:bg-rose-950/30">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">
                Couldn&apos;t answer from the article
              </h2>
              <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-200/80">
                The article doesn&apos;t contain enough information to answer
                these. You&apos;ll need a different source — or rephrase the
                question to match what the article does cover.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-900 dark:text-rose-200">
                {result.missingQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Suggested follow-up searches — close the loop on the
              assignment's "support any other factual information with
              suitable sources" requirement. Each chip opens Source
              Finder pre-filled with the query in a new tab. */}
          {result.suggestedSearches && result.suggestedSearches.length > 0 && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                Find more supporting sources
              </h2>
              <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                Click any topic to open Source Finder pre-filled with the
                query. Useful for the &ldquo;support any other factual
                information with suitable sources&rdquo; part of your
                assignment.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.suggestedSearches.map((q, i) => (
                  <a
                    key={i}
                    href={`/uni/sources?q=${encodeURIComponent(q)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-800 transition-colors hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/40"
                  >
                    🔍 {q}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Copy all as markdown */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const lines: string[] = [];
                lines.push("# Article Q&A — research notes\n");
                lines.push("## Article overview\n");
                lines.push(result.articleSummary + "\n");
                lines.push(
                  `**Authors:** ${result.authors.names.join(", ") || "—"}`,
                );
                if (result.authors.affiliations)
                  lines.push(`_${result.authors.affiliations}_`);
                lines.push(`\n${result.authors.credibilityNotes}\n`);
                lines.push(
                  `**Journal:** ${result.journal.name ?? "—"}\n${result.journal.indexingNotes}\n`,
                );
                lines.push(
                  `## APA 7 reference\n\n${result.apaReference}\n`,
                );
                lines.push("## Answers\n");
                for (const a of result.answers) {
                  lines.push(
                    `### ${a.question}\n\n**Answer (${a.confidence}):** ${a.answer}`,
                  );
                  for (const q of a.supportingQuotes) {
                    lines.push(`> "${q.quote}"\n> — ${q.section}`);
                  }
                  if (a.notesForStudent)
                    lines.push(`\n*⚠ ${a.notesForStudent}*`);
                  lines.push("");
                }
                if (result.missingQuestions.length > 0) {
                  lines.push("## Couldn't answer from article\n");
                  for (const q of result.missingQuestions) lines.push(`- ${q}`);
                }
                if (
                  result.suggestedSearches &&
                  result.suggestedSearches.length > 0
                ) {
                  lines.push("\n## Suggested follow-up searches\n");
                  for (const q of result.suggestedSearches)
                    lines.push(`- ${q}`);
                }
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("Copied research notes as markdown");
                } catch {
                  toast.error("Couldn't copy");
                }
              }}
              className={buttonSecondary}
            >
              Copy notes as markdown
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}
