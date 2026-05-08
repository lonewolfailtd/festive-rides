"use client";

// Quick Import: dashboard drop-zone that turns "I have a brief PDF and
// don't know where to start" into "course + assignment + analysis ready
// in 30 seconds". Drop or upload a PDF/DOCX, we extract text client-side,
// hand it to the quickImport.importBrief action, and the action handles
// finding-or-creating the course, creating the assignment, and saving
// the analysis row attached to it.
//
// On success we set the new assignment as active so the dashboard updates
// in place. The student can click straight through to the Analyser page.

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPdfjs } from "@/lib/pdfjs";

const STORAGE_KEY = "uni-active-assignment-v1";
const ACTIVE_EVENT = "uni:active-assignment-changed";

const MAX_TEXT = 14000;

interface ImportSuccess {
  assignmentId: string;
  courseCode: string | null;
  assessmentNumber: string | null;
  taskCount: number;
  isNewCourse: boolean;
  dueDateDetected: boolean;
}

export default function QuickImport() {
  const importBrief = useAction(api.quickImport.importBrief);

  const [stage, setStage] = useState<"idle" | "extracting" | "analysing" | "done">("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Simulated analysis progress, **linear** to a realistic time estimate
  // based on brief length. The Convex action is one round-trip (no real
  // progress events) but we know roughly how long it takes:
  //   - Short brief (<3000 chars): ~10s
  //   - Medium (3000-7000): ~13s
  //   - Long (7000-14000): ~16s
  // We ramp 0 → 99% linearly over that estimate, hold at 99% if we
  // overshot, and snap to 100% the instant the response lands. No
  // ease-out, no 95% wall — what you see is what's happening.
  const [analysingPct, setAnalysingPct] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(12);
  const rafRef = useRef<number | null>(null);

  const stopProgressTimer = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const estimateSecondsFor = (textLength: number): number => {
    if (textLength < 3000) return 10;
    if (textLength < 7000) return 13;
    return 16;
  };

  const startProgressTimer = (textLength: number) => {
    stopProgressTimer();
    const seconds = estimateSecondsFor(textLength);
    setEstimatedSeconds(seconds);
    setAnalysingPct(0);
    const startedAt = performance.now();
    const totalMs = seconds * 1000;
    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      // Linear ramp 0 → 99 over the estimated duration. Hold at 99 if
      // we're past the estimate but the response hasn't arrived yet.
      const linear = (elapsedMs / totalMs) * 99;
      const pct = Math.min(99, linear);
      setAnalysingPct(pct);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopProgressTimer();
  }, []);

  // Stage-aware label, linearly tied to percent.
  const analysingLabel =
    analysingPct < 25
      ? "Reading the brief"
      : analysingPct < 55
        ? "Finding tasks and concepts"
        : analysingPct < 85
          ? "Setting up your workspace"
          : "Finalising";

  // Seconds remaining = estimated duration × (1 - pct/100). Lets the
  // user see "8s left" rather than guessing.
  const secondsLeft = Math.max(
    0,
    Math.ceil((estimatedSeconds * (100 - analysingPct)) / 100),
  );

  const reset = () => {
    stopProgressTimer();
    setStage("idle");
    setProgress(null);
    setError(null);
    setResult(null);
    setAnalysingPct(0);
  };

  const handleText = async (text: string, fileName?: string) => {
    setError(null);
    if (text.trim().length < 100) {
      setError(
        "That doesn't look like a full assignment brief. Try a different file or paste the text manually.",
      );
      setStage("idle");
      return;
    }
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
    setStage("analysing");
    startProgressTimer(text.length);
    try {
      const r = (await importBrief({
        text,
        fileName,
      })) as ImportSuccess & { courseId: string | null; analysisId: string };
      // Stop the simulated ramp and snap to 100. The CSS transition on
      // the bar's width gives a satisfying final glide.
      stopProgressTimer();
      setAnalysingPct(100);
      setResult({
        assignmentId: r.assignmentId,
        courseCode: r.courseCode,
        assessmentNumber: r.assessmentNumber,
        taskCount: r.taskCount,
        isNewCourse: r.isNewCourse,
        dueDateDetected: r.dueDateDetected,
      });
      // Set as active assignment so the rest of the dashboard updates
      try {
        window.localStorage.setItem(STORAGE_KEY, r.assignmentId);
        window.dispatchEvent(
          new CustomEvent(ACTIVE_EVENT, { detail: r.assignmentId }),
        );
      } catch {}
      // Brief delay so the bar visibly fills to 100% before the success
      // card replaces it. 200ms = bar's CSS transition (100ms) + a beat.
      setTimeout(() => {
        setStage("done");
        toast.success(
          r.isNewCourse
            ? `Created course ${r.courseCode ?? "?"} and ${r.assessmentNumber ?? "an assignment"}.`
            : `Set up ${r.assessmentNumber ?? "the assignment"} under ${r.courseCode ?? "your existing course"}.`,
        );
      }, 200);
    } catch (err) {
      stopProgressTimer();
      setError(err instanceof Error ? err.message : "Import failed.");
      setStage("idle");
    }
  };

  const handlePdf = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF over 20MB — please trim.");
      return;
    }
    setStage("extracting");
    setProgress({ done: 0, total: 0 });
    try {
      const pdfjs = await loadPdfjs();
      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const total = doc.numPages;
      setProgress({ done: 0, total });
      const parts: string[] = [];
      for (let i = 1; i <= total; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const t = content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ");
        parts.push(t);
        setProgress({ done: i, total });
      }
      const extracted = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
      if (extracted.length < 50) {
        setError("Could not pull text from this PDF — it might be image-based.");
        setStage("idle");
        return;
      }
      await handleText(extracted, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF extraction failed.");
      setStage("idle");
    } finally {
      setProgress(null);
    }
  };

  const handleDocx = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("Word doc over 20MB — please trim.");
      return;
    }
    setStage("extracting");
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const buffer = await file.arrayBuffer();
      const out = await mammoth.extractRawText({ arrayBuffer: buffer });
      const extracted = (out.value ?? "").trim();
      if (extracted.length < 50) {
        setError("Could not pull text from this Word doc.");
        setStage("idle");
        return;
      }
      await handleText(extracted, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Word doc extraction failed.");
      setStage("idle");
    }
  };

  const onUpload = (file: File) => {
    setError(null);
    setResult(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      void handlePdf(file);
    } else if (
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      void handleDocx(file);
    } else if (name.endsWith(".txt") || file.type === "text/plain") {
      void file.text().then((t) => handleText(t, file.name));
    } else {
      setError(
        "Upload a PDF, Word doc (.docx) or plain text. Word .doc (legacy) isn't supported.",
      );
    }
  };

  // Success state — collapsed summary card
  if (stage === "done" && result) {
    return (
      <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800/60 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[12rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              ✓ Set up automatically
            </p>
            <p className="mt-1 text-slate-800 dark:text-slate-200">
              {result.isNewCourse && result.courseCode
                ? `Created course ${result.courseCode}, then `
                : ""}
              {`${result.assessmentNumber ?? "Assignment"} is now your active assignment`}
              {result.taskCount > 0 ? ` with ${result.taskCount} task${result.taskCount === 1 ? "" : "s"}` : ""}
              {result.dueDateDetected ? " · due date pulled from the brief" : ""}
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/uni/analyser?assignmentId=${result.assignmentId}`}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Open Analyser →
            </Link>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-emerald-400 bg-white px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
            >
              Import another
            </button>
          </div>
        </div>
      </section>
    );
  }

  const busy = stage === "extracting" || stage === "analysing";

  return (
    <section
      className={`relative rounded-2xl border-2 border-dashed p-5 transition-colors ${
        dragOver
          ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
          : "border-slate-300 bg-gradient-to-br from-white to-slate-50/50 dark:border-slate-700 dark:from-slate-950 dark:to-slate-950"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (busy) return;
        const file = e.dataTransfer.files?.[0];
        if (file) onUpload(file);
      }}
    >
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0 sm:min-w-[14rem]">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            🚀 Quick start: drop your assignment brief
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            We&apos;ll detect the course code, create a new assignment, run the analyser and set it as your active assignment — all in one go.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition-colors hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-500 dark:hover:bg-sky-900/40 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
              className="hidden"
              disabled={busy}
            />
            <span aria-hidden>📄</span>
            <span>
              {stage === "extracting"
                ? progress
                  ? `Reading PDF ${progress.done}/${progress.total}…`
                  : "Reading file…"
                : stage === "analysing"
                  ? `Analysing… ${Math.floor(analysingPct)}%`
                  : "Choose a file"}
            </span>
          </label>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            or drag &amp; drop
          </span>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>
      )}

      {stage === "analysing" && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
            <span className="font-medium">{analysingLabel}…</span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {Math.floor(analysingPct)}%
              {analysingPct < 99 && secondsLeft > 0 && (
                <span className="ml-2 text-slate-500 dark:text-slate-400">
                  · ~{secondsLeft}s left
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
              style={{
                width: `${analysingPct}%`,
                // Short transition smooths the bar between rAF updates
                // without lagging behind the linear ramp. The final
                // 99→100 jump uses the same transition for a clean snap.
                transition: "width 100ms linear",
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
