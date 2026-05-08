"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";
import EmptyState from "../EmptyState";

type AnalysisTask = {
  taskNumber: string;
  scenario: string;
  subQuestions: string[];
  conceptsRequired: string[];
  wordCountGuideline: number | null;
  marks: number | null;
  outline: string[];
  suggestedSources: string[];
};

type AnalysisResult = {
  summary: string;
  keyQuestion: string;
  // New optional context fields. Older saved analyses won't have these ” they
  // render only when populated.
  courseCode?: string | null;
  assessmentNumber?: string | null;
  weightingPercent?: number | null;
  totalMarks?: number | null;
  tasks?: AnalysisTask[];
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
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)]";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]";

const BRIEF_LIMIT = 12000;
const countWords = (s: string): number => {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
};

function buildMarkdown(r: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Assignment plan");
  lines.push("");
  const ctxBits: string[] = [];
  if (r.courseCode) ctxBits.push(`Course ${r.courseCode}`);
  if (r.assessmentNumber) ctxBits.push(r.assessmentNumber);
  if (r.weightingPercent != null) ctxBits.push(`${r.weightingPercent}% weighting`);
  if (r.totalMarks != null) ctxBits.push(`${r.totalMarks} marks`);
  if (ctxBits.length > 0) {
    lines.push(`_${ctxBits.join(" Â· ")}_`);
    lines.push("");
  }
  lines.push("## Summary");
  lines.push(r.summary);
  lines.push("");
  lines.push("## The actual question");
  lines.push(`> ${r.keyQuestion}`);
  lines.push("");
  if (r.tasks && r.tasks.length > 0) {
    lines.push("## Tasks");
    for (const t of r.tasks) {
      const meta: string[] = [];
      if (t.marks != null) meta.push(`${t.marks} marks`);
      if (t.wordCountGuideline != null) meta.push(`${t.wordCountGuideline} words`);
      lines.push(`### ${t.taskNumber}${meta.length ? ` ” ${meta.join(" Â· ")}` : ""}`);
      if (t.scenario) {
        lines.push("");
        lines.push(`_${t.scenario}_`);
      }
      if (t.subQuestions.length > 0) {
        lines.push("");
        lines.push("**Sub-questions**");
        for (const q of t.subQuestions) lines.push(`- ${q}`);
      }
      if (t.conceptsRequired.length > 0) {
        lines.push("");
        lines.push(`**Concepts you need:** ${t.conceptsRequired.join(", ")}`);
      }
      if (t.outline.length > 0) {
        lines.push("");
        lines.push("**Outline**");
        for (const b of t.outline) lines.push(`- ${b}`);
      }
      if (t.suggestedSources.length > 0) {
        lines.push("");
        lines.push("**Suggested sources**");
        for (const s of t.suggestedSources) lines.push(`- ${s}`);
      }
      lines.push("");
    }
  }
  if (r.warnings.length) {
    lines.push("## Warnings");
    for (const w of r.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Task verbs");
  for (const t of r.taskVerbs) lines.push(`- **${t.verb}** ” ${t.meaning}`);
  lines.push("");
  lines.push("## Marking criteria");
  const sortedRubric = [...r.rubricBreakdown].sort(
    (a, b) => b.weightPercent - a.weightPercent,
  );
  for (const c of sortedRubric)
    lines.push(`- **${c.criterion}** (${c.weightPercent}%) ” ${c.focus}`);
  lines.push("");
  lines.push("## Word-count split");
  for (const s of r.wordCountSplit)
    lines.push(`- **${s.section}** ” ${s.words} words. ${s.purpose}`);
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
  const mapRubric = useAction(api.analyser.mapRubric);
  const toggleBulletMutation = useMutation(api.analysisStore.toggleBullet);
  const removeAnalysis = useMutation(api.analysisStore.remove);

  const assignments = useQuery(api.assignments.list);
  const savedAnalyses = useQuery(api.analysisStore.list, {});
  const updateAnalysis = useMutation(api.analysisStore.update);

  // Refs count for the assignment of the currently loaded analysis (lets us
  // show "12 references already" badge linking back to /uni/references).
  // Pull ALL refs (cheap), filter client-side to the current assignment.
  const allRefs = useQuery(api.references.listForAssignment, { assignmentId: undefined });

  const [assignmentId, setAssignmentId] = useState<Id<"assignments"> | "">("");
  const [analysisId, setAnalysisId] = useState<Id<"analyses"> | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMarkerChecklist, setShowMarkerChecklist] = useState(false);
  const [checkedRubricCriteria, setCheckedRubricCriteria] = useState<Set<number>>(new Set());
  const [editingField, setEditingField] = useState<null | "summary" | "keyQuestion">(null);
  const [editDraft, setEditDraft] = useState("");
  const [sectionDrafts, setSectionDrafts] = useState<Record<number, string>>({});

  // Rubric-mapper state. Lazy-loaded ” only fetched when the student asks
  // for it because it's a second AI call. Maps each rubric criterion to the
  // outline sections that earn those marks.
  type RubricMapping = {
    mappings: {
      criterion: string;
      weightPercent: number;
      earnsMarksIn: string[];
      atRisk: boolean;
      advice: string;
    }[];
    sectionLoad: { section: string; criteriaCovered: string[]; marksAvailable: number }[];
    overallNotes: string;
  };
  const [rubricMapping, setRubricMapping] = useState<RubricMapping | null>(null);
  const [mappingRubric, setMappingRubric] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-analyser");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { window.localStorage.setItem("uni-tool-onboarded-analyser", "1"); } catch {}
  };
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
  const [openTasks, setOpenTasks] = useState<Record<number, boolean>>({});
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);

  // Compute current assignment id from active analysis, then reference count.
  const currentAssignment = useMemo(() => {
    if (!analysisId || !savedAnalyses) return null;
    const cur = savedAnalyses.find((a) => a._id === analysisId);
    return cur?.assignmentId ?? null;
  }, [analysisId, savedAnalyses]);

  const currentAssignmentRefCount = useMemo(() => {
    if (!allRefs || !currentAssignment) return null;
    return allRefs.filter((r) => r.assignmentId === currentAssignment).length;
  }, [allRefs, currentAssignment]);

  // Inline-edit any text field on the analysis result. Patches both local
  // result state AND the persisted analysis row.
  const saveFieldEdit = async (field: "summary" | "keyQuestion") => {
    if (!analysisId || !result) return;
    const value = editDraft.trim();
    if (!value) {
      toast.error("Field can't be empty.");
      return;
    }
    const next = { ...result, [field]: value };
    setResult(next);
    setEditingField(null);
    try {
      await updateAnalysis({ id: analysisId, result: next });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  };

  // Word-count helper for outline section text
  const wordCount = (s: string): number => {
    const t = s.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  };

  // .docx export (Word-compatible HTML doc with mso namespaces).
  const escapeForHtml = (s: string): string =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const downloadPlanDocx = () => {
    if (!result) return;
    const r = result;
    const sections: string[] = [];
    const h2 = (text: string) =>
      `<h2 style="font-family:'Times New Roman',serif;font-size:14pt;font-weight:bold;margin:18pt 0 6pt;">${escapeForHtml(text)}</h2>`;
    const p = (text: string) =>
      `<p style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;margin:0 0 6pt;">${escapeForHtml(text)}</p>`;

    sections.push(`<h1 style="font-family:'Times New Roman',serif;font-size:18pt;font-weight:bold;text-align:center;margin:0 0 18pt;">Assignment Plan</h1>`);

    sections.push(h2("Summary"));
    sections.push(p(r.summary));

    sections.push(h2("Key question"));
    sections.push(p(r.keyQuestion));

    if (r.warnings.length > 0) {
      sections.push(h2("Warnings"));
      sections.push("<ul>" + r.warnings.map((w) => `<li>${escapeForHtml(w)}</li>`).join("") + "</ul>");
    }

    sections.push(h2("Task verbs"));
    sections.push("<ul>" + r.taskVerbs.map((t) => `<li><strong>${escapeForHtml(t.verb)}</strong> ” ${escapeForHtml(t.meaning)}</li>`).join("") + "</ul>");

    sections.push(h2("Marking criteria"));
    sections.push("<ul>" + r.rubricBreakdown.map((c) => `<li><strong>${escapeForHtml(c.criterion)}</strong> (${c.weightPercent}%) ” ${escapeForHtml(c.focus)}</li>`).join("") + "</ul>");

    sections.push(h2("Word-count split"));
    sections.push("<ul>" + r.wordCountSplit.map((s) => `<li><strong>${escapeForHtml(s.section)}</strong> ” ${s.words} words. ${escapeForHtml(s.purpose)}</li>`).join("") + "</ul>");

    sections.push(h2("Outline"));
    for (const o of r.outline) {
      sections.push(`<h3 style="font-family:'Times New Roman',serif;font-size:13pt;font-weight:bold;margin:12pt 0 6pt;">${escapeForHtml(o.section)}</h3>`);
      sections.push("<ul>" + o.bullets.map((b) => `<li>${escapeForHtml(b)}</li>`).join("") + "</ul>");
    }

    sections.push(h2("Source types needed"));
    sections.push("<ul>" + r.sourceTypesNeeded.map((s) => `<li>${escapeForHtml(s)}</li>`).join("") + "</ul>");

    sections.push(h2("Research keywords"));
    sections.push(p(r.researchKeywords.join(", ")));

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Assignment plan</title></head>
<body>${sections.join("\n")}</body></html>`;
    const blob = new Blob(["ï»¿", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "assignment-plan.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success("Downloaded assignment-plan.doc");
  };

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
      toast.error("PDF is over 20MB ” please trim and try again.");
      return;
    }
    setExtractingPdf(target);
    setPdfProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await import("pdfjs-dist");
      // unpkg mirrors npm exactly so the worker version always matches the
      // installed pdfjs-dist. cdnjs lags behind for newer pdfjs releases.
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
          "Couldn't pull text from that PDF ” it might be scanned / image-based. Try OCR'ing it first."
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
          ? `Extracted ${total} pages ” trimmed to ${BRIEF_LIMIT} chars`
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

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Quick start</p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Pick which assignment you&apos;re planning (or leave unassigned).</li>
                <li>Either paste the brief into the box, or click ðŸ“„ Upload PDF to extract it from a file.</li>
                <li>Optionally paste/upload the marking rubric, and pick a word-count target.</li>
                <li>Click <em>Analyse</em> ” get the actual question, task verbs, an outline you can tick off, and research keywords.</li>
                <li>Click a keyword chip to jump to Source Finder pre-loaded with that term.</li>
                <li>Click <em>Send brief to Draft Coach</em> when you&apos;re ready to write.</li>
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
                  <span aria-hidden>ðŸ“„</span>
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
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-500"
                  }`}
                  title={`${brief.length} of ${BRIEF_LIMIT} characters`}
                >
                  ~{countWords(brief).toLocaleString("en-NZ")} words
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
                    {a.courseCode ? `${a.courseCode} ” ${a.name}` : a.name}
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
                <span aria-hidden>ðŸ“„</span>
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
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-200">
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

      {!running && !result && (
        <EmptyState
          icon="📝"
          title="Drop in your assignment brief"
          body="Paste your brief above (or upload a PDF) and the analyser will work out what's actually being asked, suggest an outline and tell you what kinds of sources to find."
          variant="soft"
        />
      )}

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
          {(result.courseCode || result.assessmentNumber || result.weightingPercent != null || result.totalMarks != null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {result.courseCode && (
                <span><span className="text-slate-500 dark:text-slate-400">Course</span> <strong className="text-slate-900 dark:text-slate-100">{result.courseCode}</strong></span>
              )}
              {result.assessmentNumber && (
                <span className="before:mx-2 before:text-slate-300 dark:before:text-slate-700 first:before:hidden before:content-['Â·']">
                  <strong className="text-slate-900 dark:text-slate-100">{result.assessmentNumber}</strong>
                </span>
              )}
              {result.weightingPercent != null && (
                <span className="before:mx-2 before:text-slate-300 dark:before:text-slate-700 first:before:hidden before:content-['Â·']">
                  <strong className="text-slate-900 dark:text-slate-100">{result.weightingPercent}%</strong> <span className="text-slate-500 dark:text-slate-400">weighting</span>
                </span>
              )}
              {result.totalMarks != null && (
                <span className="before:mx-2 before:text-slate-300 dark:before:text-slate-700 first:before:hidden before:content-['Â·']">
                  <strong className="text-slate-900 dark:text-slate-100">{result.totalMarks}</strong> <span className="text-slate-500 dark:text-slate-400">marks total</span>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Your plan
              {(iterating || mappingRubric) && (
                <span
                  role="status"
                  aria-live="polite"
                  className="ml-3 inline-flex items-center gap-1.5 align-middle text-xs font-normal text-sky-600 dark:text-sky-400"
                >
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {iterating ? "Refining…" : "Mapping rubric…"}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              {currentAssignmentRefCount !== null && (
                <Link
                  href={`/uni/references`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                  title="Open References list for this assignment"
                >
                  ðŸ“š {currentAssignmentRefCount} reference{currentAssignmentRefCount === 1 ? "" : "s"}
                </Link>
              )}
              <button
                type="button"
                onClick={() => downloadPlanDocx()}
                className={buttonSecondary}
              >
                Download .docx
              </button>
              <button onClick={copyPlan} className={buttonSecondary}>
                {copiedPlan ? "Copied" : "Copy as markdown"}
              </button>
            </div>
          </div>

          <section className={sectionCard}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Summary
              </h3>
              {analysisId && editingField !== "summary" && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDraft(result.summary);
                    setEditingField("summary");
                  }}
                  className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Edit
                </button>
              )}
            </div>
            {editingField === "summary" ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={4}
                  className={`${inputStyle} text-sm`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveFieldEdit("summary")}
                    className={buttonPrimary}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className={buttonSecondary}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                {result.summary}
              </p>
            )}
          </section>

          <section className={sectionCard}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                The actual question
              </h3>
              {analysisId && editingField !== "keyQuestion" && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDraft(result.keyQuestion);
                    setEditingField("keyQuestion");
                  }}
                  className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Edit
                </button>
              )}
            </div>
            {editingField === "keyQuestion" ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={3}
                  className={`${inputStyle} text-sm`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveFieldEdit("keyQuestion")}
                    className={buttonPrimary}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className={buttonSecondary}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <blockquote className="mt-3 border-l-4 border-sky-500 bg-white dark:bg-slate-950 px-4 py-3 text-sm italic text-slate-900 dark:text-slate-100">
                {result.keyQuestion}
              </blockquote>
            )}
          </section>

          {result.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700/60 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Warnings
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {result.tasks && result.tasks.length > 0 && (
            <section className={sectionCard}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Tasks
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {result.tasks.length} task{result.tasks.length === 1 ? "" : "s"} in this brief
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Each task is marked separately. Plan, draft and check them one by one.
              </p>
              <div className="mt-3 space-y-3">
                {result.tasks.map((t, i) => {
                  const open = openTasks[i] ?? true;
                  const meta: string[] = [];
                  if (t.marks != null) meta.push(`${t.marks} marks`);
                  if (t.wordCountGuideline != null) meta.push(`${t.wordCountGuideline} words`);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTasks((s) => ({ ...s, [i]: !open }))}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <strong className="text-sm text-slate-900 dark:text-slate-100">
                            {t.taskNumber}
                          </strong>
                          {meta.length > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Â· {meta.join(" Â· ")}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {open ? "Hide" : "Show"}
                        </span>
                      </button>
                      {open && (
                        <div className="space-y-3 px-4 pb-4 pt-0 text-sm">
                          {t.scenario && (
                            <p className="text-slate-700 dark:text-slate-300">
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Scenario Â· </span>
                              {t.scenario}
                            </p>
                          )}
                          {t.subQuestions && t.subQuestions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sub-questions</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-200">
                                {t.subQuestions.map((q, j) => (
                                  <li key={j}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {t.conceptsRequired && t.conceptsRequired.length > 0 && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Concepts you need</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {t.conceptsRequired.map((c, j) => (
                                  <span
                                    key={j}
                                    className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs text-sky-800 ring-1 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700/50"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {t.outline && t.outline.length > 0 && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Outline</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-200">
                                {t.outline.map((b, j) => (
                                  <li key={j}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {t.suggestedSources && t.suggestedSources.length > 0 && (
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Suggested sources</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                                {t.suggestedSources.map((s, j) => (
                                  <li key={j}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                    <dt className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                      {t.verb}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className={sectionCard}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Marking criteria
              </h3>
              {sortedRubric.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!analysisId) return;
                      setMappingRubric(true);
                      try {
                        const r = (await mapRubric({ id: analysisId })) as { mapping: RubricMapping };
                        setRubricMapping(r.mapping);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Mapping failed");
                      } finally {
                        setMappingRubric(false);
                      }
                    }}
                    disabled={mappingRubric || !analysisId}
                    className="text-xs text-sky-600 hover:text-sky-500 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    {mappingRubric ? "Mapping…" : rubricMapping ? "Re-map to outline" : "Map to outline â†’"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMarkerChecklist((s) => !s)}
                    className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    {showMarkerChecklist ? "Hide" : "Open"} marker checklist
                  </button>
                </div>
              )}
            </div>

            {rubricMapping && (
              <div className="mt-3 space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {rubricMapping.overallNotes}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rubricMapping.mappings.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-2.5 text-xs ${
                        m.atRisk
                          ? "border-rose-300 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30"
                          : "border-emerald-300 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30"
                      }`}
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.criterion} <span className="font-normal text-slate-500 dark:text-slate-400">({m.weightPercent}%)</span>
                        {m.atRisk && <span className="ml-1.5 rounded-full bg-rose-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-900 dark:bg-rose-900/60 dark:text-rose-200">at risk</span>}
                      </p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">
                        <span className="font-medium">Earns marks in:</span>{" "}
                        {m.earnsMarksIn.length > 0 ? m.earnsMarksIn.join("; ") : <em className="text-rose-600 dark:text-rose-400">no outline section maps to this</em>}
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">{m.advice}</p>
                    </div>
                  ))}
                </div>
                {rubricMapping.sectionLoad.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
                      Show marks-per-section load ({rubricMapping.sectionLoad.length} sections)
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {rubricMapping.sectionLoad.map((s, i) => (
                        <li key={i} className="text-slate-700 dark:text-slate-300">
                          <strong>{s.section}</strong> ” {s.marksAvailable}% available Â· covers: {s.criteriaCovered.join(", ") || "”"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {showMarkerChecklist && sortedRubric.length > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                  Tick each criterion before submitting ” { checkedRubricCriteria.size }/{ sortedRubric.length } done
                </p>
                <ul className="mt-2 space-y-1.5">
                  {sortedRubric.map((c, i) => {
                    const checked = checkedRubricCriteria.has(i);
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCheckedRubricCriteria((s) => {
                              const next = new Set(s);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                        />
                        <span className={checked ? "text-slate-500 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-200"}>
                          <strong>{c.criterion}</strong> ({c.weightPercent}%) ” {c.focus}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

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
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sortedRubric.map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 align-top font-medium text-slate-900 dark:text-slate-100">
                          {c.criterion}
                        </td>
                        <td className="py-2 pr-3 align-top text-sky-700 dark:text-sky-300">
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
              <ul className="mt-3 space-y-4">
                {result.wordCountSplit.map((s, i) => {
                  const pct =
                    totalSplitWords > 0
                      ? Math.round((s.words / totalSplitWords) * 100)
                      : 0;
                  const draft = sectionDrafts[i] ?? "";
                  const wc = wordCount(draft);
                  const tol = s.words * 0.1;
                  const status =
                    wc === 0
                      ? "none"
                      : wc < s.words - tol
                        ? "under"
                        : wc > s.words + tol
                          ? "over"
                          : "ok";
                  return (
                    <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {s.section}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          target {s.words} words ({pct}% of total)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-sky-600" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.purpose}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
                          Track your draft for this section
                        </summary>
                        <div className="mt-2 space-y-1">
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setSectionDrafts((sd) => ({ ...sd, [i]: e.target.value }))
                            }
                            rows={4}
                            placeholder={`Paste your "${s.section}" draft text here…`}
                            className={`${inputStyle} text-sm`}
                          />
                          <p
                            className={`text-xs ${
                              status === "ok"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : status === "under"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : status === "over"
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {wc.toLocaleString("en-NZ")} words
                            {status === "ok" && ` ✓ on target (within ±10%)`}
                            {status === "under" && ` ” need ~${Math.max(0, Math.round(s.words - tol) - wc)} more`}
                            {status === "over" && ` ” over by ~${wc - Math.round(s.words + tol)}`}
                            {status === "none" && " ” paste your draft above to track"}
                          </p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={sectionCard}>
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Outline
                </h3>
                {result.tasks && result.tasks.length > 0 && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Synthesised plan across all tasks
                  </p>
                )}
              </div>
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
                      Search on OpenAlex â†’
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
                Send brief to Draft Coach â†’
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
                    placeholder={`e.g. "Make the outline focus more on MÄtauranga MÄori frameworks" or "The word-count split feels off ” give the discussion more space"`}
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
