"use client";

// Question Unpacker — paste a question (or upload an assignment PDF
// and pick a task), and get a structured "how to think about this"
// scaffold. Sits between Assignment Analyser (whole-brief planner)
// and Article Q&A / Coach (later-stage tools).
//
// Hard product principle: this NEVER drafts the student's answer.
// It produces command-word decode, scope, hidden assumptions,
// approach options, evidence-to-find, Socratic prompts. The student
// owns the writing.

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import Link from "next/link";
import { extractPdfText } from "@/lib/extractPdfText";
import { getErrorMessage } from "@/lib/getErrorMessage";

type UnpackResult = {
  // Plain-English comprehension layer — optional so a model response that
  // predates this field (or omits it) still renders the rest.
  plainEnglish?: {
    inPlainWords: string;
    jargonTerms: Array<{ term: string; meaning: string }>;
    steps: string[];
  };
  commandWord: {
    verb: string;
    meaning: string;
    markerImplication: string;
  };
  scopeAndTopic: {
    topic: string;
    inScope: string[];
    outOfScope: string[];
  };
  hiddenAssumptions: Array<{
    assumption: string;
    whyItMatters: string;
  }>;
  approachOptions: Array<{
    name: string;
    howItWorks: string;
    strengths: string[];
    tradeOffs: string[];
  }>;
  evidenceNeeded: {
    sourceTypes: string[];
    specificEvidence: string[];
    searchQueries: string[];
  };
  socraticPrompts: string[];
  warningFlags: string[];
};

type ExtractedTask = { label: string; fullText: string };

const PDF_MAX_MB = 30;
const PDF_MAX_PAGES = 60;
const BRIEF_TEXT_MAX = 30000;

const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-950 dark:to-slate-950";
const chip =
  "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

export default function UnpackClient() {
  const extractTasks = useAction(api.questionUnpacker.extractTasks);
  const unpack = useAction(api.questionUnpacker.unpack);

  // Inputs
  const [question, setQuestion] = useState("");
  const [briefContext, setBriefContext] = useState("");
  const [courseContext, setCourseContext] = useState("");

  // Brief / task picker state
  const [briefText, setBriefText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [findingTasks, setFindingTasks] = useState(false);

  // Output
  const [unpacking, setUnpacking] = useState(false);
  const [result, setResult] = useState<UnpackResult | null>(null);
  const [resultQuestion, setResultQuestion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // ============= PDF upload → text =============
  const handlePdfUpload = async (file: File) => {
    setExtracting(true);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const { text: extracted, pages: maxPages } = await extractPdfText(file, {
        maxBytes: PDF_MAX_MB * 1024 * 1024,
        tooLargeMessage: `PDF over ${PDF_MAX_MB} MB — please trim.`,
        maxPages: PDF_MAX_PAGES,
        pageMarkers: true,
        minChars: 100,
        minCharsMessage: "Couldn't extract enough text — may be a scanned image.",
        maxChars: BRIEF_TEXT_MAX,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      setBriefText(extracted);
      setBriefContext(extracted);
      toast.success(`Extracted ${maxPages} page${maxPages === 1 ? "" : "s"} from "${file.name}"`);
    } catch (err) {
      toast.error(getErrorMessage(err, "PDF extraction failed"));
    } finally {
      setExtracting(false);
      setPdfProgress(null);
    }
  };

  // ============= Extract tasks =============
  const handleFindTasks = async () => {
    if (briefText.trim().length < 100) {
      toast.error("Paste or upload an assignment brief first (at least 100 chars).");
      return;
    }
    setFindingTasks(true);
    try {
      const r = await extractTasks({ briefText: briefText.trim() });
      if (r.tasks.length === 0) {
        toast.warning("No tasks detected. Try pasting one question manually below.");
      } else {
        toast.success(`Found ${r.tasks.length} task${r.tasks.length === 1 ? "" : "s"}`);
      }
      setTasks(r.tasks);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't extract tasks"));
    } finally {
      setFindingTasks(false);
    }
  };

  // ============= Unpack the chosen question =============
  const handleUnpack = async () => {
    setError(null);
    const q = question.trim();
    if (q.length < 15) {
      setError("Paste the full question (including any scenario/context). At least 15 characters.");
      return;
    }
    setUnpacking(true);
    setResult(null);
    try {
      const r = await unpack({
        question: q,
        briefContext: briefContext.trim() || undefined,
        courseContext: courseContext.trim() || undefined,
      });
      setResult(r.result as UnpackResult);
      setResultQuestion(q);
      // Smooth scroll to result.
      requestAnimationFrame(() => {
        document.getElementById("unpack-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unpack failed"));
    } finally {
      setUnpacking(false);
    }
  };

  // ============= Handoffs =============
  const handoffToSources = (query: string) => {
    const url = `/uni/sources?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener");
  };
  const handoffToArticleQA = async () => {
    // Article Q&A doesn't yet read prefill via URL, so we copy the
    // question to clipboard and open the tool. The student pastes
    // into the questions textarea.
    try {
      await navigator.clipboard.writeText(resultQuestion);
      toast.success("Question copied — paste it into Article Q&A's question field");
    } catch {
      toast.info("Open Article Q&A and paste your question in.");
    }
    window.open("/uni/article-qa", "_blank", "noopener");
  };
  const handoffToCoach = async () => {
    // Coach takes a draft. We stash the question + brief in
    // clipboard so the student can keep it visible.
    const stash = `=== Question I'm answering ===\n${resultQuestion}\n\n=== Paste your draft below ===\n`;
    try {
      await navigator.clipboard.writeText(stash);
      toast.success("Question copied — paste it at the top of your Coach draft");
    } catch {
      toast.info("Open Draft Coach and paste your draft.");
    }
    window.open("/uni/coach", "_blank", "noopener");
  };

  const briefWordCount = briefText.trim() ? briefText.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/uni" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Question Unpacker
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Stuck on a question? Paste it (or pick one from your assignment brief) and we break it
            down — command word, scope, hidden assumptions, approach options, evidence to find, and
            questions to ask yourself. <strong>We won&apos;t write the answer.</strong>
          </p>
        </div>
      </div>

      {/* Step 1: Brief upload (optional) + task picker */}
      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          1. (Optional) Load your assignment brief
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Skip this if you just want to paste one question. Loading the brief lets us pick the right
          task and gives context for unpacking.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
          <label className={`${buttonSecondary} cursor-pointer`}>
            <span aria-hidden>📤</span> Upload PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfUpload(f);
                e.target.value = "";
              }}
              disabled={extracting}
            />
          </label>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {extracting && pdfProgress
              ? `Extracting page ${pdfProgress.done} of ${pdfProgress.total}…`
              : briefWordCount > 0
                ? `Brief loaded — ${briefWordCount} words`
                : "Or paste the brief into the box below."}
          </div>
        </div>

        <textarea
          className={`${inputStyle} mt-3 min-h-[120px] font-mono text-xs`}
          placeholder="Paste your assignment brief here (optional)…"
          value={briefText}
          onChange={(e) => {
            setBriefText(e.target.value);
            setBriefContext(e.target.value);
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFindTasks}
            disabled={findingTasks || briefText.trim().length < 100}
            className={buttonSecondary}
          >
            {findingTasks ? (
              "Finding tasks…"
            ) : (
              <>
                <span aria-hidden>🔍</span> Find tasks in this brief
              </>
            )}
          </button>
          {tasks.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} — click one to load it below
            </span>
          )}
        </div>

        {tasks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {tasks.map((t, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(t.fullText);
                    toast.success(`Loaded: ${t.label}`);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition-all hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                    {t.fullText}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Step 2: Question + course context */}
      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          2. The question to unpack
        </h2>
        <div className="mt-3">
          <label className={labelStyle} htmlFor="unpack-question">
            Question (paste verbatim, include scenario if any)
          </label>
          <textarea
            id="unpack-question"
            className={`${inputStyle} min-h-[140px]`}
            placeholder='e.g. "Critically analyse two contemporary approaches to managing workplace stress in Aotearoa New Zealand, drawing on empirical evidence to evaluate their effectiveness."'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <label className={labelStyle} htmlFor="unpack-course">
            Course context (optional — e.g. &quot;71203 Health Psychology, Year 2&quot;)
          </label>
          <input
            id="unpack-course"
            type="text"
            className={inputStyle}
            placeholder="Course code / paper name / year level"
            value={courseContext}
            onChange={(e) => setCourseContext(e.target.value)}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUnpack}
            disabled={unpacking || question.trim().length < 15}
            className={buttonPrimary}
          >
            {unpacking ? (
              "Unpacking…"
            ) : (
              <>
                <span aria-hidden>🧠</span> Unpack this question
              </>
            )}
          </button>
          {unpacking && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ~10-30 seconds. Uses Gemini 2.5 Pro for the thinking work.
            </span>
          )}
        </div>
      </section>

      {/* Step 3: Result */}
      {result && (
        <div id="unpack-result" className="space-y-4">
          {/* Plain English — comprehension layer. Pinned first: for a
              student who doesn't yet understand what the question asks,
              this is the "oh, THAT'S all it wants" moment. */}
          {result.plainEnglish && (
            <section className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-6 dark:border-sky-800 dark:bg-sky-950/40">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                In plain English
              </h2>
              {result.plainEnglish.inPlainWords && (
                <p className="mt-2 text-base leading-relaxed text-slate-900 dark:text-slate-100">
                  {result.plainEnglish.inPlainWords}
                </p>
              )}

              {result.plainEnglish.steps?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Broken into steps — what you actually need to produce
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {result.plainEnglish.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {result.plainEnglish.jargonTerms?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tricky words explained
                  </div>
                  <dl className="mt-2 space-y-2">
                    {result.plainEnglish.jargonTerms.map((j, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-sky-200/70 bg-white px-3 py-2 dark:border-sky-900/50 dark:bg-slate-900"
                      >
                        <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {j.term}
                        </dt>
                        <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                          {j.meaning}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>
          )}

          {/* Command word */}
          <section className={sectionCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Command word
            </h2>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {result.commandWord.verb}
            </div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {result.commandWord.meaning}
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>What the marker wants:</strong> {result.commandWord.markerImplication}
            </div>
          </section>

          {/* Scope */}
          <section className={sectionCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Scope &amp; topic
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {result.scopeAndTopic.topic}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span aria-hidden>✅</span> In scope
                </div>
                <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {result.scopeAndTopic.inScope.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-medium text-rose-700 dark:text-rose-400">
                  <span aria-hidden>❌</span> Out of scope (don&apos;t drift here)
                </div>
                <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {result.scopeAndTopic.outOfScope.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Hidden assumptions */}
          {result.hiddenAssumptions.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                Hidden assumptions to unpack
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Define these BEFORE you write — vague answers come from leaving them implicit.
              </p>
              <ul className="mt-3 space-y-3">
                {result.hiddenAssumptions.map((h, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {h.assumption}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      <strong>Why it matters:</strong> {h.whyItMatters}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Approach options */}
          <section className={sectionCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              How you could approach it
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pick ONE. These are different shapes for the answer — not pre-written content.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {result.approachOptions.map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {a.name}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{a.howItWorks}</p>
                  {a.strengths.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Strengths
                      </div>
                      <ul className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                        {a.strengths.map((s, j) => (
                          <li key={j}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {a.tradeOffs.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Trade-offs
                      </div>
                      <ul className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                        {a.tradeOffs.map((s, j) => (
                          <li key={j}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Evidence needed + search handoffs */}
          <section className={sectionCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              What evidence you&apos;ll need
            </h2>

            {result.evidenceNeeded.sourceTypes.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Source types
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {result.evidenceNeeded.sourceTypes.map((s, i) => (
                    <span key={i} className={chip}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.evidenceNeeded.specificEvidence.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Specific evidence to look for
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
                  {result.evidenceNeeded.specificEvidence.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.evidenceNeeded.searchQueries.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Run these on Source Finder (click to search)
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.evidenceNeeded.searchQueries.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handoffToSources(q)}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs text-sky-800 transition-colors hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/40"
                      title="Open Source Finder with this query"
                    >
                      <span aria-hidden>🔎</span> {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Socratic prompts */}
          {result.socraticPrompts.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                Ask yourself before writing
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sit with these. The answers come from YOU, not the literature.
              </p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {result.socraticPrompts.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-sky-600 dark:text-sky-400">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Warnings */}
          {result.warningFlags.length > 0 && (
            <section className={sectionCard}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                <span aria-hidden>⚠️</span> Common ways to lose marks on this
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {result.warningFlags.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Handoffs */}
          <section className={sectionCard}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Next steps
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pick a tool to continue with.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={handoffToArticleQA} className={buttonSecondary}>
                <span aria-hidden>💬</span> Ask an article (Article Q&A)
              </button>
              <button type="button" onClick={handoffToCoach} className={buttonSecondary}>
                <span aria-hidden>📝</span> Send to Coach when you have a draft
              </button>
              <Link href="/uni/analyser" className={buttonSecondary}>
                <span aria-hidden>🗺️</span> Plan the whole assignment (Analyser)
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
