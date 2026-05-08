"use client";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import { useStoredState } from "@/lib/useStoredState";

type ParagraphScore = {
  preview: string;
  score: number;
  reason: string;
};

type CheckResult = {
  overallScore: number;
  verdict: "Mostly human" | "Mixed" | "Likely AI" | "Heavily AI";
  summary: string;
  paragraphs: ParagraphScore[];
  tells: string[];
  humanTells: string[];
  naturalisationTips: string[];
  calibration: string;
};

type HumaniseResult = {
  rewrite: string;
  changes: string[];
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

function scoreColour(score: number): { text: string; bar: string; bg: string; border: string } {
  if (score < 30) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
    };
  }
  if (score < 50) {
    return {
      text: "text-sky-600 dark:text-sky-400",
      bar: "bg-sky-500",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
    };
  }
  if (score < 70) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    };
  }
  return {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  };
}

export default function CheckerClient() {
  const check = useAction(api.aiChecker.check);
  const humanise = useAction(api.aiChecker.humanise);

  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractingFile, setExtractingFile] = useState<null | "pdf" | "docx">(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Model picker — V4 Flash is the default for speed (~6-10s vs Pro's
  // 12-18s). Pro is selectable for high-stakes checks where the extra
  // precision is worth the wait. Claude Sonnet 4.6 is the premium pick
  // if the result still feels off after trying both.
  const [model, setModel] = useStoredState<string>("uni-checker-model", "deepseek/deepseek-v4-flash");

  // Calibration sub-tool — runs three known samples through the checker
  // back-to-back so the student can sanity-check the model's calibration.
  const [calibrating, setCalibrating] = useState<null | "human" | "ai" | "mixed">(null);
  const [calibrationResults, setCalibrationResults] = useState<{
    human?: CheckResult;
    ai?: CheckResult;
    mixed?: CheckResult;
  }>({});

  // Humanise sub-feature state
  const [humanisePassage, setHumanisePassage] = useState("");
  const [humanising, setHumanising] = useState(false);
  const [humaniseResult, setHumaniseResult] = useState<HumaniseResult | null>(null);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-checker");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-checker", "1");
    } catch {}
  };

  const handlePdf = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF over 20MB — please trim.");
      return;
    }
    setExtractingFile("pdf");
    setPdfProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const total = doc.numPages;
      setPdfProgress({ done: 0, total });
      const parts: string[] = [];
      for (let i = 1; i <= total; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const t = content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ");
        parts.push(t);
        setPdfProgress({ done: i, total });
      }
      let extracted = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
      if (extracted.length < 50) {
        toast.error("Could not pull text from this PDF — it might be image-based.");
        return;
      }
      if (extracted.length > TEXT_MAX) extracted = extracted.slice(0, TEXT_MAX);
      setText(extracted);
      toast.success(`Extracted ${total} pages from "${file.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF extraction failed");
    } finally {
      setExtractingFile(null);
      setPdfProgress(null);
    }
  };

  const handleDocx = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Word doc over 20MB — please trim.");
      return;
    }
    setExtractingFile("docx");
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const buffer = await file.arrayBuffer();
      const out = await mammoth.extractRawText({ arrayBuffer: buffer });
      let extracted = (out.value ?? "").trim();
      if (extracted.length < 50) {
        toast.error("Could not pull text from this Word doc.");
        return;
      }
      if (extracted.length > TEXT_MAX) extracted = extracted.slice(0, TEXT_MAX);
      setText(extracted);
      toast.success(`Extracted text from "${file.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Word doc extraction failed");
    } finally {
      setExtractingFile(null);
    }
  };

  const onUpload = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      void handlePdf(file);
    } else if (
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      void handleDocx(file);
    } else {
      toast.error("Upload a PDF or .docx file. Word .doc (legacy) isn't supported.");
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setHumaniseResult(null);
    if (text.trim().length < TEXT_MIN) {
      setError(`Paste at least ${TEXT_MIN} characters of draft.`);
      return;
    }
    setRunning(true);
    try {
      const res = (await check({ text, model })) as CheckResult;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed.");
    } finally {
      setRunning(false);
    }
  };

  // Three calibration samples. Human one is messy / personal-voice; AI one is
  // raw ChatGPT-style filler; mixed is a sandwich. Lets the student see at a
  // glance whether the current model is calibrated correctly.
  const SAMPLES = {
    human: `okay so I've been thinking about this for a while and I'm not really sure if Bowlby's attachment thing actually fits what I've seen with my own kids. like, my eldest was the textbook secure-attached baby — clung to me for about six months, then started doing his own thing. but my second? totally different. she barely cared if I left the room from about four months on, which Ainsworth's framework would call avoidant or whatever. Bowlby would probably say I screwed something up but honestly I think she just has a different temperament. the strange situation test always rubbed me the wrong way too — twenty minutes in a weird room with a stranger isn't exactly representative of a kid's actual home life. I get why it became the gold standard, it's reproducible, but reproducible isn't the same as valid. anyway that's my two cents.`,
    ai: `Attachment theory, originally proposed by John Bowlby and further developed through the seminal work of Mary Ainsworth, represents a multifaceted framework for understanding the nuanced dynamics of early caregiver-infant relationships. It is important to note that this theory underscores the comprehensive nature of attachment as a foundational element of human development. Furthermore, the strange situation paradigm has been instrumental in delineating distinct attachment styles. Moreover, contemporary research continues to navigate the complexities of these multifaceted developmental trajectories. Additionally, the implications of attachment theory extend across diverse cultural contexts, illuminating the tapestry of human bonding. In conclusion, Bowlby's foundational contributions, alongside Ainsworth's empirical extensions, have profoundly shaped our holistic understanding of socio-emotional development in today's rapidly evolving psychological landscape.`,
    mixed: `Bowlby's attachment theory has been hugely influential — there's no real argument about that. The Strange Situation gave the field a way to actually measure something that had been fuzzy. But it's important to note that the theory operates within a multifaceted framework, and contemporary research continues to navigate the complexities of cross-cultural application. Honestly though, when I read Rothbaum's 2000 critique of how poorly attachment categories transfer to Japanese samples, it knocked some of the wind out of the universalist claims for me. Furthermore, the strange situation paradigm presents methodological limitations that warrant comprehensive examination. I think the framework still has legs, just narrower legs than the textbooks make out.`,
  } as const;

  const runCalibration = async (which: "human" | "ai" | "mixed") => {
    setCalibrating(which);
    setError(null);
    try {
      const res = (await check({ text: SAMPLES[which], model })) as CheckResult;
      setCalibrationResults((prev) => ({ ...prev, [which]: res }));
      toast.success(`${which === "ai" ? "AI" : which === "human" ? "Human" : "Mixed"} sample scored ${Math.round(res.overallScore)}/100`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Calibration run failed.");
    } finally {
      setCalibrating(null);
    }
  };

  const runAllCalibrations = async () => {
    await runCalibration("human");
    await runCalibration("ai");
    await runCalibration("mixed");
  };

  const onHumanise = async () => {
    if (humanisePassage.trim().length < 50) {
      toast.error("Paste at least 50 characters to rewrite.");
      return;
    }
    setHumanising(true);
    setHumaniseResult(null);
    try {
      const res = (await humanise({ text: humanisePassage, model })) as HumaniseResult;
      setHumaniseResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setHumanising(false);
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const overall = result ? scoreColour(result.overallScore) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="AI Checker"
        title="Check your draft for AI-style writing"
        description="Paste your draft, or upload a PDF or Word doc. Get a per-paragraph AI-likelihood score plus suggestions to rewrite passages that read as AI-generated."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Quick start</p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Paste your draft, or click 📄 Upload PDF / 📝 Upload Word doc to extract from a file.</li>
                <li>Click <em>Check for AI</em> — get an overall score and per-paragraph breakdown.</li>
                <li>Read the &quot;tells&quot; section to see what patterns flagged as AI-like.</li>
                <li>Use the <em>Humanise a passage</em> tool below to rewrite specific bits.</li>
              </ol>
              <p className="mt-2 text-xs text-sky-900/80 dark:text-sky-300/80">
                ⚠  AI detectors are imperfect. Real tools (Turnitin, GPTZero) have 5“15% false-positive rates. Use this as a guide, not a verdict — and write in your own voice from the start when you can.
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
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300 ${
                    extractingFile !== null ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={extractingFile !== null}
                  />
                  <span aria-hidden>📄</span>
                  <span>
                    {extractingFile === "pdf"
                      ? pdfProgress
                        ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                        : "Reading PDF…"
                      : "Upload PDF"}
                  </span>
                </label>
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300 ${
                    extractingFile !== null ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={extractingFile !== null}
                  />
                  <span aria-hidden>📝</span>
                  <span>
                    {extractingFile === "docx" ? "Reading Word doc…" : "Upload Word doc (.docx)"}
                  </span>
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ~{wordCount.toLocaleString("en-NZ")} words
                </span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="Paste at least 200 characters of your draft. The more text, the more reliable the detection."
              className={`${inputStyle} resize-y font-mono`}
            />
          </div>

          {error ? <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || extractingFile !== null}
              className={buttonPrimary}
            >
              {running ? "Checking…" : "Check for AI"}
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
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="model-picker">
                Model:
              </label>
              <select
                id="model-picker"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={running || calibrating !== null}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash (default — fastest)</option>
                <option value="deepseek/deepseek-v4-pro">DeepSeek V4 Pro (more thorough, slower)</option>
                <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6 (premium)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your text is sent to OpenRouter and discarded after the response. Different models score the same text slightly differently — flip between them if a verdict feels off.
          </p>
        </form>
      </section>

      {/* Calibration sub-tool */}
      <section className={`${sectionCard} mb-6`}>
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">▸</span>
            Sanity-check the model
          </summary>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Three known samples — a human-written, an obviously-AI, and a mixed paragraph. Run them to see if the model is calibrated correctly today before you trust its verdict on your own draft.
            </p>
          </div>
          <button
            type="button"
            onClick={runAllCalibrations}
            disabled={running || calibrating !== null}
            className={buttonSecondary}
          >
            {calibrating ? `Running ${calibrating}…` : "Run all three"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["human", "ai", "mixed"] as const).map((which) => {
            const r = calibrationResults[which];
            const c = r ? scoreColour(r.overallScore) : null;
            const expected = which === "human" ? "low" : which === "ai" ? "high" : "mid";
            return (
              <div
                key={which}
                className={`rounded-lg border p-3 ${
                  r && c ? `${c.border} ${c.bg}` : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    {which === "human" ? "Human" : which === "ai" ? "AI" : "Mixed"} sample
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    expected: {expected}
                  </span>
                </div>
                {r && c ? (
                  <>
                    <p className={`mt-1 text-2xl font-bold ${c.text}`}>
                      {Math.round(r.overallScore)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{r.verdict}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Not run yet
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => runCalibration(which)}
                  disabled={running || calibrating !== null}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                >
                  {calibrating === which ? "Running…" : r ? "Re-run" : "Run"}
                </button>
              </div>
            );
          })}
        </div>
        {(calibrationResults.human || calibrationResults.ai || calibrationResults.mixed) && (
          <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-400">
            Healthy calibration: human under 30, AI over 70, mixed somewhere between 40“60. If the human sample scores high or the AI sample scores low, switch models.
          </p>
        )}
        </details>
      </section>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          {/* Overall score card */}
          <section className={`rounded-2xl border ${overall!.border} ${overall!.bg} p-5 shadow-sm`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Overall AI-likelihood
              </h2>
              <span className={`text-3xl font-bold ${overall!.text}`}>
                {Math.round(result.overallScore)}
                <span className="text-sm text-slate-500 dark:text-slate-400">/100</span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className={`h-full ${overall!.bar}`} style={{ width: `${result.overallScore}%` }} />
            </div>
            <p className={`mt-3 text-sm font-medium ${overall!.text}`}>
              {result.verdict}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.summary}
            </p>
            <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-400">
              {result.calibration}
            </p>
          </section>

          {/* Paragraph breakdown */}
          {result.paragraphs.length > 0 && (
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Paragraph breakdown
              </h3>
              <ul className="mt-3 space-y-2">
                {result.paragraphs.map((p, i) => {
                  const c = scoreColour(p.score);
                  return (
                    <li
                      key={i}
                      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          ¶ {i + 1}
                        </span>
                        <span className={`text-sm font-medium ${c.text}`}>
                          {Math.round(p.score)}/100
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={`h-full ${c.bar}`} style={{ width: `${p.score}%` }} />
                      </div>
                      <p className="mt-2 text-sm italic text-slate-700 dark:text-slate-300">
                        &ldquo;{p.preview}…&rdquo;
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {p.reason}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Tells side-by-side */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                AI tells found
              </h3>
              {result.tells.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  None flagged.
                </p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700 dark:text-slate-300">
                  {result.tells.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Human tells found
              </h3>
              {result.humanTells.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  None spotted.
                </p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700 dark:text-slate-300">
                  {result.humanTells.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Suggestions */}
          {result.naturalisationTips.length > 0 && (
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Make it sound more human
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700 dark:text-slate-300">
                {result.naturalisationTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
      )}

      {/* Humanise sub-tool */}
      <section className={`${sectionCard} mt-8`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Humanise a passage
          </h2>
          {/* Quick-fill button: copy the main draft into the humanise box.
              Disabled if there's no draft pasted yet. Saves the student
              from manually copy-pasting between the two textareas. */}
          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                // The humanise endpoint caps at 8000 chars; trim to fit.
                const slice = text.slice(0, 8000);
                setHumanisePassage(slice);
                if (text.length > 8000) {
                  toast.success(
                    "Loaded the first 8000 characters of your draft.",
                  );
                } else {
                  toast.success("Draft loaded into humanise box.");
                }
              }}
              className="rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-500 dark:hover:bg-sky-900/40"
            >
              Use my draft →
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Paste a flagged passage (or click <strong>Use my draft</strong> to copy the one above). We&apos;ll rewrite it to sound more human while preserving every fact and citation.
        </p>
        <div className="mt-3 space-y-3">
          <textarea
            value={humanisePassage}
            onChange={(e) => setHumanisePassage(e.target.value)}
            rows={6}
            placeholder="Paste the AI-sounding passage here (50–8000 characters)."
            className={`${inputStyle} font-mono text-sm`}
          />
          <button
            type="button"
            onClick={onHumanise}
            disabled={humanising || humanisePassage.trim().length < 50}
            className={buttonPrimary}
          >
            {humanising ? "Rewriting…" : "Rewrite to sound human"}
          </button>
          {humaniseResult && (
            <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700/50 dark:bg-emerald-900/20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Rewritten passage
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                  {humaniseResult.rewrite}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(humaniseResult.rewrite);
                      toast.success("Copied to clipboard");
                    } catch {
                      toast.error("Couldn't copy");
                    }
                  }}
                  className={`${buttonSecondary} mt-2`}
                >
                  Copy rewrite
                </button>
              </div>
              {humaniseResult.changes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    What changed
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-slate-700 dark:text-slate-300">
                    {humaniseResult.changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
