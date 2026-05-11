"use client";

// Submission Audit — pre-submit rubric coverage check.
//
// The student loads their finished draft + the rubric (auto-pulled from
// the active assignment if available, otherwise paste/upload). The AI
// audits coverage criterion-by-criterion and surfaces:
//   - what's covered (verbatim quote)
//   - what's partial (gap + DIRECTIONAL guidance — never the words)
//   - what's missing (direction only)
//   - predicted score range
//   - top quick wins ordered by mark impact
//
// Hard product principle: this tool NEVER writes the missing content.
// It highlights gaps and gives direction. The student does the writing.

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

const DRAFT_MIN = 500;
const DRAFT_MAX = 40000;
const RUBRIC_MIN = 100;
// 25,000 chars. A 5-band × 5-criterion repeated rubric (e.g. Para 1/2/3
// each with the same 3-criterion 5-band table = 15 band descriptors)
// hits ~18-22k. Was 15k which truncated full marking schedules.
const RUBRIC_MAX = 25000;

interface Criterion {
  name: string;
  bandEstimate: string;
  status: "covered" | "partial" | "missing";
  evidence: string | null;
  gap: string | null;
  direction: string | null;
  potentialMarkGain: string | null;
}

interface Section {
  sectionName: string;
  sectionScoreRange: { min: number; max: number; outOf: number } | null;
  criteria: Criterion[];
}

interface AuditResult {
  overall: {
    predictedScoreRange: { min: number; max: number; outOf: number };
    readinessLevel: "needs-work" | "almost-there" | "submission-ready";
    summary: string;
  };
  sections: Section[];
  quickWins: string[];
}

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]";

const STATUS_INFO: Record<
  Criterion["status"],
  { label: string; pillBg: string; pillText: string; icon: string }
> = {
  covered: {
    label: "Covered",
    pillBg: "bg-emerald-100 dark:bg-emerald-950/50",
    pillText: "text-emerald-800 dark:text-emerald-200",
    icon: "✓",
  },
  partial: {
    label: "Partial",
    pillBg: "bg-amber-100 dark:bg-amber-950/50",
    pillText: "text-amber-800 dark:text-amber-200",
    icon: "◐",
  },
  missing: {
    label: "Missing",
    pillBg: "bg-rose-100 dark:bg-rose-950/50",
    pillText: "text-rose-800 dark:text-rose-200",
    icon: "✗",
  },
};

const READINESS_INFO: Record<
  AuditResult["overall"]["readinessLevel"],
  { label: string; tone: string }
> = {
  "needs-work": {
    label: "Needs work",
    tone: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  },
  "almost-there": {
    label: "Almost there",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  "submission-ready": {
    label: "Submission ready",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
};

export default function SubmissionAuditClient() {
  const auditAction = useAction(api.submissionAudit.audit);
  const assignments = useQuery(api.assignments.list);

  const [activeId, setActiveId] = useState<Id<"assignments"> | "">("");
  const [draft, setDraft] = useState("");
  const [rubric, setRubric] = useState("");
  const [brief, setBrief] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hideCovered, setHideCovered] = useState(false);
  // Model picker: Flash (fast, ~80s) is default; Pro (thorough, ~3-4 min)
  // is an opt-in second opinion. Stored in localStorage so the choice
  // sticks per browser.
  const [model, setModel] = useState<"flash" | "pro">("flash");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("uni-submission-audit-model");
      if (stored === "flash" || stored === "pro") setModel(stored);
    } catch {}
  }, []);

  // File-upload state — separate target so the user can upload a draft
  // AND a rubric without clashing.
  const [extractingFor, setExtractingFor] = useState<null | "draft" | "rubric">(null);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  // Honest run-time tracking (mirrors NZ Editor).
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastRunSeconds, setLastRunSeconds] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopProgressTimer = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const startProgressTimer = () => {
    stopProgressTimer();
    setElapsedSeconds(0);
    const startedAt = performance.now();
    const tick = (now: number) => {
      setElapsedSeconds((now - startedAt) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopProgressTimer(), []);

  // Initial onboarding flag.
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-submission-audit");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-submission-audit", "1");
    } catch {}
  };

  // ----- Auto-pull active assignment + its rubric/brief on mount -----
  // The dashboard fires the ACTIVE_EVENT when the workspace bar changes.
  // We also seed from localStorage on first mount.
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

  // When the active assignment changes (or assignments list arrives),
  // pull its stored rubric + brief into the inputs. We do NOT overwrite
  // a rubric the user has already typed/pasted — only fill if empty.
  useEffect(() => {
    if (!activeId || !assignments) return;
    const a = assignments.find((x) => x._id === activeId);
    if (!a) return;
    if (!rubric.trim() && a.rubric) setRubric(a.rubric);
    if (!brief.trim() && a.brief) setBrief(a.brief);
    // Intentionally not listing rubric/brief in deps — we only seed
    // once per assignment-id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, assignments]);

  const activeAssignment = assignments?.find((x) => x._id === activeId);

  // ----- File upload handlers (same pattern as EditorClient) -----
  const extractPdf = async (
    file: File,
    target: "draft" | "rubric",
    maxChars: number,
  ): Promise<string | null> => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF over 20MB — please trim.");
      return null;
    }
    setExtractingFor(target);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await loadPdfjs();
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
        return null;
      }
      if (extracted.length > maxChars) extracted = extracted.slice(0, maxChars);
      toast.success(`Extracted ${total} page${total === 1 ? "" : "s"} from "${file.name}"`);
      return extracted;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF extraction failed");
      return null;
    } finally {
      setExtractingFor(null);
      setPdfProgress(null);
    }
  };

  const extractDocx = async (
    file: File,
    target: "draft" | "rubric",
    maxChars: number,
  ): Promise<string | null> => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Word doc over 20MB — please trim.");
      return null;
    }
    setExtractingFor(target);
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const buffer = await file.arrayBuffer();
      const out = await mammoth.extractRawText({ arrayBuffer: buffer });
      let extracted = (out.value ?? "").trim();
      if (extracted.length < 50) {
        toast.error("Could not pull text from this Word doc.");
        return null;
      }
      if (extracted.length > maxChars) extracted = extracted.slice(0, maxChars);
      toast.success(`Extracted text from "${file.name}"`);
      return extracted;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Word doc extraction failed");
      return null;
    } finally {
      setExtractingFor(null);
    }
  };

  const handleUpload = async (
    file: File,
    target: "draft" | "rubric",
    setter: (s: string) => void,
    maxChars: number,
  ) => {
    const name = file.name.toLowerCase();
    let extracted: string | null = null;
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      extracted = await extractPdf(file, target, maxChars);
    } else if (
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      extracted = await extractDocx(file, target, maxChars);
    } else {
      toast.error("Upload a PDF or .docx file.");
      return;
    }
    if (extracted) setter(extracted);
  };

  // ----- Submit -----
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (draft.trim().length < DRAFT_MIN) {
      setError(`Paste at least ${DRAFT_MIN} characters of your finished draft.`);
      return;
    }
    if (rubric.trim().length < RUBRIC_MIN) {
      setError(
        `Paste the rubric / marking schedule (at least ${RUBRIC_MIN} characters). Auto-load failed? Edit the assignment to add the rubric, or paste it manually below.`,
      );
      return;
    }
    setRunning(true);
    setResult(null);
    setLastRunSeconds(null);
    const startedAt = performance.now();
    startProgressTimer();
    try {
      const r = (await auditAction({
        draftText: draft,
        rubricText: rubric,
        briefText: brief.trim() ? brief : undefined,
        assignmentName: activeAssignment?.name,
        model:
          model === "pro"
            ? "deepseek/deepseek-v4-pro"
            : "deepseek/deepseek-v4-flash",
      })) as AuditResult;
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed.");
    } finally {
      stopProgressTimer();
      setLastRunSeconds((performance.now() - startedAt) / 1000);
      setRunning(false);
    }
  };

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).filter(Boolean).length : 0;

  // Build a single section's audit as markdown — shared by the per-
  // section copy buttons and the full-document copy below. Keeps the
  // output format consistent so a student can paste either a single
  // criterion's worth of feedback or the whole audit into their notes.
  const buildSectionMarkdown = (s: Section): string => {
    const lines: string[] = [];
    lines.push(`### ${s.sectionName}`);
    if (s.sectionScoreRange) {
      lines.push(
        `_Predicted: ${s.sectionScoreRange.min}–${s.sectionScoreRange.max} / ${s.sectionScoreRange.outOf}_\n`,
      );
    }
    for (const c of s.criteria) {
      lines.push(`**${c.name}** — ${c.status.toUpperCase()} (Band: ${c.bandEstimate})`);
      // Same rule as the UI: skip Evidence on COVERED — it's clutter.
      if (c.evidence && c.status !== "covered") {
        lines.push(`> Evidence: "${c.evidence}"`);
      }
      if (c.gap) lines.push(`- Gap: ${c.gap}`);
      if (c.direction) lines.push(`- Direction: ${c.direction}`);
      if (c.potentialMarkGain) lines.push(`- Potential: ${c.potentialMarkGain}`);
      lines.push("");
    }
    return lines.join("\n");
  };

  // Status filter — hide criteria already covered to focus on gaps.
  const filteredSections = result
    ? result.sections.map((s) => ({
        ...s,
        criteria: hideCovered
          ? s.criteria.filter((c) => c.status !== "covered")
          : s.criteria,
      }))
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="Submission Audit"
        title="Check your draft against the rubric before you submit"
        description="Pre-submit coverage check. Loads the rubric from your active assignment automatically (or paste it in). Highlights gaps and points to what's missing — but you do the writing."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                What this tool does (and doesn&apos;t)
              </p>
              <ul className="ml-4 list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Loads your active assignment&apos;s rubric automatically (set it via Quick Import or edit the assignment).</li>
                <li>Audits your finished draft against every rubric criterion.</li>
                <li>Shows: ✓ covered (with quote), ◐ partial (with gap), ✗ missing — plus a predicted score band.</li>
                <li><strong>Never writes the missing content for you</strong> — only points to what type of content to add and where. The writing stays yours.</li>
                <li>Ranked &quot;quick wins&quot; tell you which fixes earn the most marks.</li>
              </ul>
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
              Auditing against active assignment:{" "}
              <strong>{activeAssignment.name}</strong>
              {activeAssignment.rubric ? (
                <span className="ml-2 text-emerald-700 dark:text-emerald-300">
                  · rubric auto-loaded
                </span>
              ) : (
                <span className="ml-2 text-amber-700 dark:text-amber-300">
                  · no rubric stored — paste it below or re-import the brief
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No active assignment selected — set one from the dashboard, or just paste your rubric and draft below.
            </div>
          )}

          {/* Rubric input */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={labelStyle}>Rubric / marking schedule</span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${
                    extractingFor !== null ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, "rubric", setRubric, RUBRIC_MAX);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={extractingFor !== null}
                  />
                  <span aria-hidden>📄</span>
                  <span>
                    {extractingFor === "rubric"
                      ? pdfProgress
                        ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                        : "Reading…"
                      : "Upload rubric PDF / .docx"}
                  </span>
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {rubric.length.toLocaleString("en-NZ")} chars
                </span>
              </div>
            </div>
            <textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={6}
              maxLength={RUBRIC_MAX}
              placeholder="Paste the rubric / marking schedule here. Auto-loaded from the active assignment if available."
              className={`${inputStyle} max-h-[280px] resize-y overflow-y-auto font-mono`}
            />
          </div>

          {/* Optional brief — collapsed by default */}
          <div>
            <button
              type="button"
              onClick={() => setShowBrief((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 transition-colors hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300"
            >
              <span>{showBrief ? "▾" : "▸"}</span>
              <span>
                Brief / context (optional, helps the audit){brief.trim() ? " · loaded" : ""}
              </span>
            </button>
            {showBrief && (
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                placeholder="Paste the assignment brief / task instructions (optional — gives the audit more context)."
                className={`${inputStyle} mt-2 max-h-[200px] resize-y overflow-y-auto font-mono`}
              />
            )}
          </div>

          {/* Draft input */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={labelStyle}>Your finished draft</span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${
                    extractingFor !== null ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, "draft", setDraft, DRAFT_MAX);
                      e.target.value = "";
                    }}
                    className="hidden"
                    disabled={extractingFor !== null}
                  />
                  <span aria-hidden>📝</span>
                  <span>
                    {extractingFor === "draft"
                      ? pdfProgress
                        ? `Extracting ${pdfProgress.done}/${pdfProgress.total}…`
                        : "Reading…"
                      : "Upload draft PDF / .docx"}
                  </span>
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ~{wordCount.toLocaleString("en-NZ")} words
                </span>
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              maxLength={DRAFT_MAX}
              placeholder={`Paste your finished draft (minimum ${DRAFT_MIN} characters). Auto-loaded from your active assignment? No — drafts aren't saved on the assignment; paste or upload here.`}
              className={`${inputStyle} max-h-[480px] resize-y overflow-y-auto font-mono`}
            />
          </div>

          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={running || extractingFor !== null}
              className={buttonPrimary}
            >
              {running ? "Auditing…" : "Run Submission Audit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setResult(null);
                setError(null);
              }}
              className={buttonSecondary}
            >
              Clear draft
            </button>

            {/* Model picker. Flash is the sane default; Pro is the
                opt-in slower second opinion. */}
            <div className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setModel("flash");
                  try {
                    window.localStorage.setItem("uni-submission-audit-model", "flash");
                  } catch {}
                }}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  model === "flash"
                    ? "bg-sky-100 font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                    : "text-slate-600 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300"
                }`}
                title="DeepSeek V4 Flash — ~80–120s, recommended"
              >
                Flash · ~80s
              </button>
              <button
                type="button"
                onClick={() => {
                  setModel("pro");
                  try {
                    window.localStorage.setItem("uni-submission-audit-model", "pro");
                  } catch {}
                }}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  model === "pro"
                    ? "bg-sky-100 font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                    : "text-slate-600 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300"
                }`}
                title="DeepSeek V4 Pro — slower (3–4 min) second opinion"
              >
                Pro · ~3m
              </button>
            </div>
          </div>

          {/* Indeterminate slider — Pro can take 30-60s, no chunked progress here */}
          {running && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium">
                  Reading rubric, reading draft, judging coverage…
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {Math.floor(elapsedSeconds)}s elapsed
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                <div
                  className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                  style={{ animation: "audit-slide 1.4s ease-in-out infinite" }}
                />
              </div>
              <style>{`
                @keyframes audit-slide {
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
          {/* Overall card */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Submission readiness
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${READINESS_INFO[result.overall.readinessLevel].tone}`}
                >
                  {READINESS_INFO[result.overall.readinessLevel].label}
                </span>
                {lastRunSeconds !== null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {lastRunSeconds < 60
                      ? `${lastRunSeconds.toFixed(1)}s`
                      : `${Math.floor(lastRunSeconds / 60)}m ${Math.floor(lastRunSeconds % 60)}s`}
                  </span>
                )}
              </div>
              <span className="text-right">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {result.overall.predictedScoreRange.min}&ndash;{result.overall.predictedScoreRange.max}
                </span>
                <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                  / {result.overall.predictedScoreRange.outOf} predicted
                </span>
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {result.overall.summary}
            </p>
            {/* Calibration footer — the predicted score is a rubric-
                compliance FLOOR, not a guaranteed mark. Real markers
                round up on coherent work; they reward intent and
                writing quality the audit can't see. Adding ~5-10 to
                this floor lands you in the typical actual-mark range. */}
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50/60 p-3 text-[12px] leading-relaxed text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
              <p>
                <strong>How to read this number:</strong> the predicted range is a <em>rubric-compliance floor</em> — what the draft would score if a marker checked off rubric boxes literally. Real markers typically add <strong>~5–10 marks</strong> on top for coherent writing and clear intent. So <strong>{result.overall.predictedScoreRange.min}&ndash;{result.overall.predictedScoreRange.max}</strong> usually lands around{" "}
                <strong>
                  {result.overall.predictedScoreRange.min + 5}&ndash;{result.overall.predictedScoreRange.max + 10}
                </strong>{" "}
                in practice. Treat gaps below as a guide for revision, not a verdict.
              </p>
            </div>
          </section>

          {/* Quick wins */}
          {result.quickWins && result.quickWins.length > 0 && (
            <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                Top quick wins
              </h2>
              <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-200/80">
                Ranked by mark impact. Address these first.
              </p>
              <ol className="mt-3 space-y-2">
                {result.quickWins.map((w, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-md border border-sky-200/60 bg-white p-3 text-sm text-slate-800 dark:border-sky-900/40 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Coverage by section */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Coverage by section
              </h2>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={hideCovered}
                  onChange={(e) => setHideCovered(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                />
                Hide covered criteria
              </label>
            </div>
            <div className="mt-4 space-y-5">
              {filteredSections.map((s, si) => (
                <div
                  key={si}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {s.sectionName}
                    </h3>
                    <div className="flex items-center gap-2">
                      {s.sectionScoreRange && (
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Predicted: {s.sectionScoreRange.min}&ndash;{s.sectionScoreRange.max} / {s.sectionScoreRange.outOf}
                        </span>
                      )}
                      {/* Per-section copy: paste just this paragraph's
                          feedback next to your draft as you revise it.
                          We copy the ORIGINAL (unfiltered) section, not
                          the filtered one, so "Hide covered criteria"
                          doesn't strip data from the clipboard. */}
                      <button
                        type="button"
                        onClick={async () => {
                          const original = result.sections[si];
                          if (!original) return;
                          try {
                            await navigator.clipboard.writeText(buildSectionMarkdown(original));
                            toast.success(`Copied "${s.sectionName}" feedback`);
                          } catch {
                            toast.error("Couldn't copy");
                          }
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300"
                        title="Copy this section's feedback as markdown"
                      >
                        Copy section
                      </button>
                    </div>
                  </div>
                  {s.criteria.length === 0 ? (
                    <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                      All criteria covered. Nothing to flag here.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {s.criteria.map((c, ci) => {
                        const info = STATUS_INFO[c.status];
                        return (
                          <li
                            key={ci}
                            className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 dark:border-slate-800/80 dark:bg-slate-950/40"
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${info.pillBg} ${info.pillText}`}
                              >
                                <span aria-hidden>{info.icon}</span>
                                {info.label}
                              </span>
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {c.name}
                              </span>
                              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                                Band: {c.bandEstimate}
                              </span>
                            </div>
                            {/* Evidence quote hidden on COVERED items —
                                for fully-covered criteria the verbatim
                                quote is just noise; the ✓ tag already
                                tells you it's fine. Partial/missing
                                still show it so you know where the
                                gap is in the draft. */}
                            {c.evidence && c.status !== "covered" && (
                              <p className="mt-2 text-xs italic text-emerald-800 dark:text-emerald-300">
                                Evidence: &ldquo;{c.evidence}&rdquo;
                              </p>
                            )}
                            {c.gap && (
                              <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
                                <span className="font-semibold text-rose-700 dark:text-rose-300">
                                  Gap:
                                </span>{" "}
                                {c.gap}
                              </p>
                            )}
                            {c.direction && (
                              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                                <span className="font-semibold text-sky-700 dark:text-sky-300">
                                  Direction:
                                </span>{" "}
                                {c.direction}
                              </p>
                            )}
                            {c.potentialMarkGain && (
                              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                Potential mark gain: {c.potentialMarkGain}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Copy full audit as markdown — reuses buildSectionMarkdown
              so the same Evidence-on-non-covered rule applies. */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const lines: string[] = [];
                lines.push("# Submission Audit\n");
                lines.push(
                  `**Predicted: ${result.overall.predictedScoreRange.min}–${result.overall.predictedScoreRange.max} / ${result.overall.predictedScoreRange.outOf}** · ${READINESS_INFO[result.overall.readinessLevel].label}`,
                );
                lines.push("");
                lines.push(result.overall.summary);
                lines.push(
                  `\n_Note: this is a rubric-compliance floor. Real markers typically add ~5–10 on top, so the realistic range is around ${result.overall.predictedScoreRange.min + 5}–${result.overall.predictedScoreRange.max + 10} / ${result.overall.predictedScoreRange.outOf}._`,
                );
                lines.push("\n## Quick wins\n");
                result.quickWins.forEach((w, i) => lines.push(`${i + 1}. ${w}`));
                lines.push("\n## Coverage\n");
                for (const s of result.sections) {
                  lines.push(buildSectionMarkdown(s));
                }
                try {
                  await navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("Copied audit as markdown");
                } catch {
                  toast.error("Couldn't copy");
                }
              }}
              className={buttonSecondary}
            >
              Copy as markdown
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}
