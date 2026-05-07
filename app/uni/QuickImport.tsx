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
import { useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "uni-active-assignment-v1";
const ACTIVE_EVENT = "uni:active-assignment-changed";

const MAX_TEXT = 14000;

interface ImportSuccess {
  assignmentId: string;
  courseCode: string | null;
  assessmentNumber: string | null;
  taskCount: number;
  isNewCourse: boolean;
}

export default function QuickImport() {
  const importBrief = useAction(api.quickImport.importBrief);

  const [stage, setStage] = useState<"idle" | "extracting" | "analysing" | "done">("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStage("idle");
    setProgress(null);
    setError(null);
    setResult(null);
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
    try {
      const r = (await importBrief({
        text,
        fileName,
      })) as ImportSuccess & { courseId: string | null; analysisId: string };
      setResult({
        assignmentId: r.assignmentId,
        courseCode: r.courseCode,
        assessmentNumber: r.assessmentNumber,
        taskCount: r.taskCount,
        isNewCourse: r.isNewCourse,
      });
      // Set as active assignment so the rest of the dashboard updates
      try {
        window.localStorage.setItem(STORAGE_KEY, r.assignmentId);
        window.dispatchEvent(
          new CustomEvent(ACTIVE_EVENT, { detail: r.assignmentId }),
        );
      } catch {}
      setStage("done");
      toast.success(
        r.isNewCourse
          ? `Created course ${r.courseCode ?? "?"} and ${r.assessmentNumber ?? "an assignment"}.`
          : `Set up ${r.assessmentNumber ?? "the assignment"} under ${r.courseCode ?? "your existing course"}.`,
      );
    } catch (err) {
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
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[14rem]">
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
                  ? "Analysing brief…"
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
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <svg
            className="h-3.5 w-3.5 animate-spin text-sky-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
          <span>Reading the brief, finding tasks, looking up the course… this takes about 10–15 seconds.</span>
        </div>
      )}
    </section>
  );
}
