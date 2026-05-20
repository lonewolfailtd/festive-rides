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

  // Separate loading flag for the 'extract questions from brief' button.
  // Independent from the PDF extraction flag so they don't collide.
  const [extractingQuestions, setExtractingQuestions] = useState(false);

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
                  <button
                    type="button"
                    onClick={async () => {
                      if (extractingQuestions) return;
                      setExtractingQuestions(true);
                      try {
                        const r = (await extractQuestionsAction({
                          assignmentBrief: activeAssignment.brief!,
                        })) as { questions: string[] };
                        if (r.questions.length === 0) {
                          toast.info(
                            "No article-related questions found in the brief. Paste them manually.",
                          );
                          return;
                        }
                        setQuestions(r.questions.join("\n"));
                        toast.success(
                          `Extracted ${r.questions.length} question${r.questions.length === 1 ? "" : "s"} from the brief.`,
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
                    title="Auto-extract the article-related questions from your active assignment's brief"
                  >
                    {extractingQuestions ? "Extracting…" : "🪄 From brief"}
                  </button>
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
              {lastRunSeconds !== null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {lastRunSeconds < 60
                    ? `${lastRunSeconds.toFixed(1)}s`
                    : `${Math.floor(lastRunSeconds / 60)}m ${Math.floor(lastRunSeconds % 60)}s`}
                </span>
              )}
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
                        {a.supportingQuotes.map((q, j) => (
                          <li
                            key={j}
                            className="rounded-md border-l-2 border-amber-400 bg-amber-50/40 px-2 py-1 dark:border-amber-500 dark:bg-amber-950/20"
                          >
                            <p className="italic text-xs text-slate-800 dark:text-slate-200">
                              &ldquo;{q.quote}&rdquo;
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              — {q.section}
                            </p>
                          </li>
                        ))}
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
