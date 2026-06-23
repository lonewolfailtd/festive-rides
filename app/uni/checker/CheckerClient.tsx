"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import ToolChat from "../ToolChat";
import { useStoredState } from "@/lib/useStoredState";
import { extractPdfText } from "@/lib/extractPdfText";
import { extractDocxText } from "@/lib/extractDocxText";
import { getErrorMessage } from "@/lib/getErrorMessage";

type ParagraphScore = {
  preview: string;
  score: number;
  reason: string;
};

type Stylometrics = {
  words: number;
  rawWords?: number;
  sentences: number;
  paragraphs: number;
  meanSentenceLen: number;
  sentenceLenStdev: number;
  sentenceLenCV: number;
  transitionsPer1000: number;
  aiVocabPer1000: number;
  typeTokenRatio: number;
  compressionRatio?: number;
  bigramRepeatRate?: number;
  removedSections?: string[];
};

type FlaggedSentence = {
  text: string;
  score: number;
  why: string;
};

type ConsensusInfo = {
  median: number;
  spread: number;
  runs: Array<{ model: string; overallScore: number; verdict: string }>;
  detailModel: string;
};

type TurnitinProjection = {
  projectedScore: number;
  display: string;
  falsePositiveRisk: "low" | "elevated" | "high";
  note: string;
};

type CheckResult = {
  overallScore: number;
  verdict: "Mostly human" | "Mixed" | "Likely AI" | "Heavily AI";
  summary: string;
  paragraphs: ParagraphScore[];
  flaggedSentences?: FlaggedSentence[];
  tells: string[];
  humanTells: string[];
  naturalisationTips: string[];
  calibration: string;
  stats?: Stylometrics;
  consensus?: ConsensusInfo;
  turnitin?: TurnitinProjection;
  // Set when consensus mode degraded to a single model (provider outage).
  warning?: string;
};

type HumaniseResult = {
  rewrite: string;
  changes: string[];
};

const TEXT_MIN = 200;
const TEXT_MAX = 50000;
const HUMANISE_MAX = 15000;

// Calibration samples. The casual-human and raw-AI ones are the easy
// cases; the two that actually test calibration are polished human
// writing (where false positives happen) and lightly edited AI (where
// false negatives happen). A model that only passes the easy three
// hasn't earned trust.
type SampleKey = "human" | "humanPolished" | "ai" | "aiEdited" | "mixed";

const SAMPLE_KEYS: readonly SampleKey[] = [
  "human",
  "humanPolished",
  "ai",
  "aiEdited",
  "mixed",
];

const SAMPLES: Record<
  SampleKey,
  { label: string; expected: string; range: [number, number]; text: string }
> = {
  human: {
    label: "Human (casual)",
    expected: "under 30",
    range: [0, 30],
    text: `okay so I've been thinking about this for a while and I'm not really sure if Bowlby's attachment thing actually fits what I've seen with my own kids. like, my eldest was the textbook secure-attached baby — clung to me for about six months, then started doing his own thing. but my second? totally different. she barely cared if I left the room from about four months on, which Ainsworth's framework would call avoidant or whatever. Bowlby would probably say I screwed something up but honestly I think she just has a different temperament. the strange situation test always rubbed me the wrong way too — twenty minutes in a weird room with a stranger isn't exactly representative of a kid's actual home life. I get why it became the gold standard, it's reproducible, but reproducible isn't the same as valid. anyway that's my two cents.`,
  },
  humanPolished: {
    label: "Human (polished)",
    expected: "under 50",
    range: [0, 50],
    text: `Bowlby's central claim — that the infant-caregiver bond is an evolved behavioural system rather than a by-product of feeding — was genuinely radical in 1958, and the field has never fully digested it. Ainsworth's Strange Situation made the claim testable, which is both its triumph and its trap. Once attachment had a twenty-minute laboratory measure, the measure started standing in for the construct. Van IJzendoorn's meta-analyses show respectable stability of classifications across Western samples, yet the Sapporo studies found nearly half of Japanese infants classified as ambivalent, a rate that says more about the procedure's assumptions than about Japanese mothers. My view, after sitting with this literature for a semester, is that the theory survives the cross-cultural critique but the categories do not. Security is probably real; the ABC taxonomy is an artefact of one clever experiment that we have asked to carry far more weight than it can bear.`,
  },
  ai: {
    label: "AI (raw)",
    expected: "over 70",
    range: [70, 100],
    text: `Attachment theory, originally proposed by John Bowlby and further developed through the seminal work of Mary Ainsworth, represents a multifaceted framework for understanding the nuanced dynamics of early caregiver-infant relationships. It is important to note that this theory underscores the comprehensive nature of attachment as a foundational element of human development. Furthermore, the strange situation paradigm has been instrumental in delineating distinct attachment styles. Moreover, contemporary research continues to navigate the complexities of these multifaceted developmental trajectories. Additionally, the implications of attachment theory extend across diverse cultural contexts, illuminating the tapestry of human bonding. In conclusion, Bowlby's foundational contributions, alongside Ainsworth's empirical extensions, have profoundly shaped our holistic understanding of socio-emotional development in today's rapidly evolving psychological landscape.`,
  },
  aiEdited: {
    label: "AI (lightly edited)",
    expected: "over 50",
    range: [50, 100],
    text: `Attachment theory, first proposed by John Bowlby and developed through the work of Mary Ainsworth, offers a framework for understanding the dynamics of early caregiver-infant relationships. The theory positions attachment as a foundational element of human development, shaping emotional regulation and later relational patterns. The Strange Situation procedure has been instrumental in identifying distinct attachment styles, providing researchers with a standardised method of assessment. I found this part of the reading quite interesting. Research also continues to examine how these developmental trajectories operate across diverse cultural contexts, raising questions about the universality of attachment classifications. The implications of attachment theory extend into clinical practice, educational settings and parenting interventions. Bowlby's contributions, alongside Ainsworth's empirical extensions, have shaped our understanding of socio-emotional development and continue to inform contemporary research directions.`,
  },
  mixed: {
    label: "Mixed",
    expected: "40–60",
    range: [40, 60],
    text: `Bowlby's attachment theory has been hugely influential — there's no real argument about that. The Strange Situation gave the field a way to actually measure something that had been fuzzy. But it's important to note that the theory operates within a multifaceted framework, and contemporary research continues to navigate the complexities of cross-cultural application. Honestly though, when I read Rothbaum's 2000 critique of how poorly attachment categories transfer to Japanese samples, it knocked some of the wind out of the universalist claims for me. Furthermore, the strange situation paradigm presents methodological limitations that warrant comprehensive examination. I think the framework still has legs, just narrower legs than the textbooks make out.`,
  },
};

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
  const checkConsensus = useAction(api.aiChecker.checkConsensus);
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

  // Result history — scores only, synced across devices via Convex.
  const history = useQuery(api.checkerHistory.list);
  const calibration = useQuery(api.checkerHistory.calibrationStats);
  const setActualScore = useMutation(api.checkerHistory.setActualScore);
  const removeRun = useMutation(api.checkerHistory.remove);
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});

  // Consensus mode — runs the check across three different model families
  // in parallel and reports the median score plus the spread between them.
  // Slower and three times the cost, but a single model's bad day can't
  // pass itself off as a verdict. Off by default.
  const [consensusMode, setConsensusMode] = useStoredState<boolean>("uni-checker-consensus", false);

  // Calibration sub-tool — runs known samples through the checker
  // back-to-back so the student can sanity-check the model's calibration.
  // The two hard cases are the ones that matter: polished human writing
  // (false-positive risk) and lightly edited AI (false-negative risk).
  const [calibrating, setCalibrating] = useState<null | SampleKey>(null);
  const [calibrationResults, setCalibrationResults] = useState<
    Partial<Record<SampleKey, CheckResult>>
  >({});

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
    setExtractingFile("pdf");
    setPdfProgress({ done: 0, total: 0 });
    try {
      const { text: extracted, pages: total } = await extractPdfText(file, {
        maxBytes: 20 * 1024 * 1024,
        minChars: 50,
        maxChars: TEXT_MAX,
        onProgress: (done, totalPages) => setPdfProgress({ done, total: totalPages }),
      });
      setText(extracted);
      toast.success(`Extracted ${total} pages from "${file.name}"`);
    } catch (err) {
      toast.error(getErrorMessage(err, "PDF extraction failed"));
    } finally {
      setExtractingFile(null);
      setPdfProgress(null);
    }
  };

  const handleDocx = async (file: File) => {
    setExtractingFile("docx");
    try {
      const extracted = await extractDocxText(file, {
        maxBytes: 20 * 1024 * 1024,
        minChars: 50,
        maxChars: TEXT_MAX,
      });
      setText(extracted);
      toast.success(`Extracted text from "${file.name}"`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Word doc extraction failed"));
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
      const res = (consensusMode
        ? await checkConsensus({ text })
        : await check({ text, model })) as CheckResult;
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err, "Check failed."));
    } finally {
      setRunning(false);
    }
  };

  const runCalibration = async (which: SampleKey) => {
    setCalibrating(which);
    setError(null);
    try {
      const res = (await check({ text: SAMPLES[which].text, model })) as CheckResult;
      setCalibrationResults((prev) => ({ ...prev, [which]: res }));
      toast.success(`${SAMPLES[which].label} sample scored ${Math.round(res.overallScore)}/100`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Calibration run failed."));
    } finally {
      setCalibrating(null);
    }
  };

  const runAllCalibrations = async () => {
    for (const key of SAMPLE_KEYS) {
      await runCalibration(key);
    }
  };

  const onHumanise = async () => {
    if (humanisePassage.trim().length < 50) {
      toast.error("Paste at least 50 characters to rewrite.");
      return;
    }
    if (humanisePassage.trim().length > HUMANISE_MAX) {
      toast.error(
        `Passage is too long — trim to ${HUMANISE_MAX.toLocaleString("en-NZ")} characters or fewer (currently ${humanisePassage.trim().length.toLocaleString("en-NZ")}).`,
      );
      return;
    }
    setHumanising(true);
    setHumaniseResult(null);
    try {
      const res = (await humanise({ text: humanisePassage, model })) as HumaniseResult;
      setHumaniseResult(res);
    } catch (err) {
      toast.error(getErrorMessage(err, "Rewrite failed."));
    } finally {
      setHumanising(false);
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const overall = result ? scoreColour(result.overallScore) : null;
  // Ground-truth bias from logged Turnitin reports, narrowed to a clean shape.
  const cal =
    calibration && "bias" in calibration && typeof calibration.bias === "number"
      ? { count: calibration.count, bias: calibration.bias, mae: calibration.meanAbsoluteError ?? 0 }
      : null;

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
                ⚠  AI detectors are imperfect. Real tools (Turnitin, GPTZero) have 5–15% false-positive rates. Use this as a guide, not a verdict — and write in your own voice from the start when you can.
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
              {running
                ? consensusMode
                  ? "Checking with 3 models…"
                  : "Checking…"
                : "Check for AI"}
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
            <div className="basis-full sm:basis-auto sm:ml-auto flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0" htmlFor="model-picker">
                Model:
              </label>
              {consensusMode ? (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  All 3 models (incl. Claude Sonnet 4.6) — untick Consensus to pick one
                </span>
              ) : (
                <select
                  id="model-picker"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={running || calibrating !== null}
                  className="flex-1 sm:flex-initial min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash (default — fastest)</option>
                  <option value="deepseek/deepseek-v4-pro">DeepSeek V4 Pro (more thorough, slower)</option>
                  <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6 (premium)</option>
                </select>
              )}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={consensusMode}
              onChange={(e) => setConsensusMode(e.target.checked)}
              disabled={running}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
            />
            <span>
              <strong className="font-medium text-slate-700 dark:text-slate-300">Consensus mode</strong> — run all three models in parallel and report the median score plus how far apart they landed. Slower and uses three checks of quota, but one model&apos;s bad day can&apos;t pose as a verdict. Use this for anything high-stakes.
            </span>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Each check is saved to your private Recent checks history below — draft and scores — so you can revisit and compare runs from any device. Different models score the same text slightly differently — flip between them if a verdict feels off.
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
              Five known samples, from casual human writing through to raw AI output. The two that matter most are <strong>Human (polished)</strong> — formal academic writing that detectors wrongly flag — and <strong>AI (lightly edited)</strong> — AI text someone tidied up. Run them to see how the current model handles the hard cases before you trust its verdict on your own draft.
            </p>
          </div>
          <button
            type="button"
            onClick={runAllCalibrations}
            disabled={running || calibrating !== null}
            className={buttonSecondary}
          >
            {calibrating ? `Running ${SAMPLES[calibrating].label}…` : "Run all five"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_KEYS.map((which) => {
            const sample = SAMPLES[which];
            const r = calibrationResults[which];
            const c = r ? scoreColour(r.overallScore) : null;
            const inRange =
              r !== undefined &&
              r.overallScore >= sample.range[0] &&
              r.overallScore <= sample.range[1];
            return (
              <div
                key={which}
                className={`rounded-lg border p-3 ${
                  r && c ? `${c.border} ${c.bg}` : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    {sample.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    expected: {sample.expected}
                  </span>
                </div>
                {r && c ? (
                  <>
                    <p className={`mt-1 text-2xl font-bold ${c.text}`}>
                      {Math.round(r.overallScore)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {r.verdict}
                      <span
                        className={`ml-2 font-medium ${
                          inRange
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {inRange ? "✓ in range" : "✗ off"}
                      </span>
                    </p>
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
        {SAMPLE_KEYS.some((k) => calibrationResults[k]) && (
          <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-400">
            Healthy calibration: casual human under 30, polished human under 50, raw AI over 70, edited AI over 50, mixed 40–60. If polished human scores high the model over-flags formal writing — treat its verdicts on your own work with suspicion. If edited AI scores low, light editing fools it. Either way, try a different model or consensus mode.
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
          {result.warning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span aria-hidden>⚠</span> {result.warning}
            </div>
          )}

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

          {/* Turnitin projection — what the report at uni would actually show */}
          {result.turnitin && (
            <section className={sectionCard}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  What Turnitin would likely show
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    result.turnitin.falsePositiveRisk === "low"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : result.turnitin.falsePositiveRisk === "elevated"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  false-positive risk: {result.turnitin.falsePositiveRisk}
                </span>
              </div>
              {result.stats && result.stats.words < 300 ? (
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  <strong>No AI score at all</strong> — Turnitin needs at least 300 words of normal prose before it will run its AI detector, and this draft has about {result.stats.words.toLocaleString("en-NZ")}.
                </p>
              ) : (
                <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {result.turnitin.display}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {result.turnitin.note}
              </p>
              {cal && cal.count >= 2 && Math.abs(cal.bias) >= 2 && (
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
                  <p className="text-slate-700 dark:text-slate-200">
                    <strong>Adjusted for your history:</strong> across {cal.count} reports you&apos;ve logged, real Turnitin came in {Math.abs(cal.bias)} points {cal.bias > 0 ? "higher" : "lower"} than projected on average. So your likely real score is closer to{" "}
                    <strong>
                      {Math.max(0, Math.min(100, Math.round(result.turnitin.projectedScore + cal.bias)))}%
                    </strong>
                    .
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Typical miss so far: ±{cal.mae} points. The more reports you log, the better this gets.
                  </p>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                How this projection works: Turnitin scores each prose sentence and reports the percentage of the document it thinks is AI-written — reference lists, bullet points and quotes don&apos;t count. Scores from 1–19% display only as an asterisk because Turnitin itself treats that range as too unreliable to report. Markers are told the score is an indicator, not proof.
              </p>
            </section>
          )}

          {/* Consensus agreement (consensus mode only) */}
          {result.consensus && (
            <section className={sectionCard}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Model agreement
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    result.consensus.spread <= 12
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : result.consensus.spread <= 25
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {result.consensus.spread <= 12
                    ? "Strong agreement"
                    : result.consensus.spread <= 25
                      ? "Moderate agreement"
                      : "Models disagree — treat with caution"}
                  {" · "}spread {Math.round(result.consensus.spread)}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {result.consensus.runs.map((run) => {
                  const c = scoreColour(run.overallScore);
                  return (
                    <li key={run.model} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {run.model.split("/")[1] ?? run.model}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={`h-full ${c.bar}`} style={{ width: `${run.overallScore}%` }} />
                      </div>
                      <span className={`w-14 shrink-0 text-right text-sm font-medium ${c.text}`}>
                        {Math.round(run.overallScore)}/100
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                The headline score is the median of the three. The detailed breakdown below comes from {result.consensus.detailModel.split("/")[1] ?? result.consensus.detailModel} (closest to the median). A wide spread means the models can&apos;t agree — which is itself useful information: the text sits in the grey zone where no detector verdict is reliable.
              </p>
            </section>
          )}

          {/* Deterministic stylometrics — measured in code, not model opinion */}
          {result.stats && (
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Measured signals
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Computed directly from your text — these numbers are exact and repeatable, unlike the model&apos;s judgement. The first two are the strongest signals.
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Sentence-length variation</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {result.stats.sentenceLenCV}
                  </dd>
                  <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                    {result.stats.sentenceLenCV >= 0.45
                      ? "Varied — leans human"
                      : result.stats.sentenceLenCV >= 0.35
                        ? "Middling"
                        : "Uniform — leans AI"}
                  </dd>
                </div>
                {typeof result.stats.compressionRatio === "number" && result.stats.compressionRatio > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Predictability (compression)</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {result.stats.compressionRatio}
                    </dd>
                    <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                      {result.stats.compressionRatio >= 0.4
                        ? "High-entropy — leans human"
                        : result.stats.compressionRatio >= 0.34
                          ? "Middling"
                          : "Templated — leans AI"}
                    </dd>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">AI-filler transitions /1000 words</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {result.stats.transitionsPer1000}
                  </dd>
                  <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                    {result.stats.transitionsPer1000 <= 2
                      ? "Low — leans human"
                      : result.stats.transitionsPer1000 <= 6
                        ? "Noticeable"
                        : "Heavy — leans AI"}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">AI-vocabulary hits /1000 words</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {result.stats.aiVocabPer1000}
                  </dd>
                  <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                    {result.stats.aiVocabPer1000 <= 1
                      ? "Low — leans human"
                      : result.stats.aiVocabPer1000 <= 4
                        ? "Noticeable"
                        : "Heavy — leans AI"}
                  </dd>
                </div>
                {typeof result.stats.bigramRepeatRate === "number" && result.stats.bigramRepeatRate > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">Phrase repetition</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {result.stats.bigramRepeatRate}%
                    </dd>
                    <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                      {result.stats.bigramRepeatRate <= 6
                        ? "Low — leans human"
                        : result.stats.bigramRepeatRate <= 12
                          ? "Noticeable"
                          : "Formulaic — leans AI"}
                    </dd>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Qualifying prose</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {result.stats.words.toLocaleString("en-NZ")} words
                  </dd>
                  <dd className="text-[11px] text-slate-500 dark:text-slate-400">
                    {result.stats.sentences} sentences · {result.stats.paragraphs} paragraphs
                    {result.stats.removedSections && result.stats.removedSections.length > 0
                      ? ` · stripped ${result.stats.removedSections.join(", ")}`
                      : ""}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {/* Most AI-like sentences — what Turnitin would highlight, with
              one-click humanise. The model returns these verbatim so they
              can be matched in the draft. */}
          {result.flaggedSentences && result.flaggedSentences.length > 0 && (
            <section className={sectionCard}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Most AI-like sentences
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The specific sentences most likely to be flagged — these are the ones worth rewriting in your own voice first.
              </p>
              <ul className="mt-3 space-y-2">
                {result.flaggedSentences
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((fs, i) => {
                    const c = scoreColour(fs.score);
                    return (
                      <li
                        key={i}
                        className={`rounded-lg border p-3 ${c.border} ${c.bg}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-slate-800 dark:text-slate-100">
                            &ldquo;{fs.text}&rdquo;
                          </p>
                          <span className={`shrink-0 text-sm font-semibold ${c.text}`}>
                            {Math.round(fs.score)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">{fs.why}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setHumanisePassage(fs.text);
                              toast.success("Loaded into the humanise box below.");
                            }}
                            className="shrink-0 rounded-md border border-sky-300 bg-white px-2 py-0.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300"
                          >
                            Humanise this
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

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

          <div className="mt-8">
            <ToolChat
              tool="checker"
              title="Ask about this result"
              context={JSON.stringify(result, null, 2)}
              suggestions={[
                "Why was this flagged as AI?",
                "How do I make a flagged bit sound human?",
                "What does the Turnitin projection mean?",
              ]}
            />
          </div>
        </motion.div>
      )}

      {/* Recent checks — score history synced across devices. Never
          stores draft text, only the numbers. Includes a field to log
          what Turnitin actually reported once the marked work comes
          back, so the projection can be tuned against ground truth. */}
      {history !== undefined && history.length > 0 && (
        <section className={`${sectionCard} mt-8`}>
          <details className="group">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Recent checks
                <span className="ml-2 font-normal text-slate-500 dark:text-slate-400 normal-case tracking-normal">
                  · {history.length} saved
                </span>
              </h2>
              <span className="text-xs text-sky-600 group-open:hidden dark:text-sky-400">Show</span>
              <span className="hidden text-xs text-slate-500 group-open:inline dark:text-slate-400">Hide</span>
            </summary>
            <ul className="mt-3 space-y-2">
              {history.map((run) => {
                const c = scoreColour(run.overallScore);
                const when = new Date(run._creationTime).toLocaleString("en-NZ", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li
                    key={run._id}
                    className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`text-lg font-bold ${c.text}`}>
                        {Math.round(run.overallScore)}
                        <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{run.verdict}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {run.mode === "consensus"
                          ? `consensus${run.spread !== undefined ? ` · spread ${Math.round(run.spread)}` : ""}`
                          : (run.model.split("/")[1] ?? run.model)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {when}
                        {run.words ? ` · ${run.words.toLocaleString("en-NZ")} words` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await removeRun({ runId: run._id as Id<"checkerRuns"> });
                          } catch (err) {
                            toast.error(getErrorMessage(err, "Couldn't delete"));
                          }
                        }}
                        aria-label="Delete this saved check"
                        className="ml-auto rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                      >
                        <span aria-hidden>✕</span>
                      </button>
                    </div>
                    {run.draftText && (
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs italic text-slate-500 dark:text-slate-400">
                          &ldquo;{run.draftText.slice(0, 140)}…&rdquo;
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setText(run.draftText ?? "");
                            setResult(null);
                            setError(null);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                            toast.success("Draft loaded — run it again or edit first.");
                          }}
                          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                        >
                          Load draft
                        </button>
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {run.turnitinDisplay && (
                        <span>
                          Turnitin projection: <strong>{run.turnitinDisplay}</strong>
                          {run.falsePositiveRisk ? ` (FP risk: ${run.falsePositiveRisk})` : ""}
                        </span>
                      )}
                      {run.actualTurnitinScore !== undefined ? (
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Actual Turnitin: {run.actualTurnitinScore}%
                          {run.turnitinProjected !== undefined && (
                            <span className="ml-1 text-slate-500 dark:text-slate-400">
                              ({run.actualTurnitinScore - run.turnitinProjected >= 0 ? "+" : ""}
                              {Math.round(run.actualTurnitinScore - run.turnitinProjected)} vs projection)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <label htmlFor={`actual-${run._id}`}>Got the real report?</label>
                          <input
                            id={`actual-${run._id}`}
                            type="number"
                            min={0}
                            max={100}
                            placeholder="%"
                            value={actualInputs[run._id] ?? ""}
                            onChange={(e) =>
                              setActualInputs((prev) => ({ ...prev, [run._id]: e.target.value }))
                            }
                            className="w-16 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const n = Number(actualInputs[run._id]);
                              if (!Number.isFinite(n) || n < 0 || n > 100) {
                                toast.error("Enter the Turnitin percentage (0–100).");
                                return;
                              }
                              try {
                                await setActualScore({
                                  runId: run._id as Id<"checkerRuns">,
                                  actualTurnitinScore: n,
                                });
                                toast.success("Logged — this tunes future projections.");
                              } catch (err) {
                                toast.error(getErrorMessage(err, "Couldn't save"));
                              }
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                          >
                            Log it
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      )}

      {/* Humanise sub-tool — collapsed by default. It's a useful
          deep-dive feature for rewriting flagged passages, but having
          it permanently expanded at the bottom of the page made the
          Checker result feel longer than it really was. */}
      <section className={`${sectionCard} mt-8`}>
        <details className="group">
          <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Humanise a passage
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400 normal-case tracking-normal">
                · rewrite flagged text to sound less AI
              </span>
            </h2>
            <span className="text-xs text-sky-600 group-open:hidden dark:text-sky-400">Open tool</span>
            <span className="hidden text-xs text-slate-500 group-open:inline dark:text-slate-400">Hide</span>
          </summary>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <span></span>
          {/* Quick-fill button: copy the main draft into the humanise box.
              Disabled if there's no draft pasted yet. Saves the student
              from manually copy-pasting between the two textareas. */}
          {text.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                // The humanise endpoint caps at HUMANISE_MAX chars; trim to fit.
                const slice = text.slice(0, HUMANISE_MAX);
                setHumanisePassage(slice);
                if (text.length > HUMANISE_MAX) {
                  toast.success(
                    `Loaded the first ${HUMANISE_MAX.toLocaleString("en-NZ")} characters of your draft.`,
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
            placeholder="Paste the AI-sounding passage here (50–15,000 characters)."
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
        </details>
      </section>
    </main>
  );
}
