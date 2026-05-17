"use client";

// Source Reader — in-app paper reader with AI-highlighted passages.
//
// Two entry paths (both fetch the same shape):
//   1. ?refId=<Id<"references">> — reads sourceText + lensAnalysis from
//      Convex. Used when navigating from References or coming back to
//      a previously-read paper.
//   2. ?session=<sessionStorage key> — reads from sessionStorage. Used
//      when navigating from Source Finder right after Deep Read,
//      BEFORE the source has been saved as a reference. Survives until
//      the tab closes.
//
// UX goal: the student opens this and immediately sees which paragraphs
// matter (yellow highlights) plus context around them, so they can
// decide whether to read further. The Lens analysis lives in a sidebar
// with click-to-scroll quote links — pick a quote, jump to it in the
// paper.
//
// Implementation notes:
// - We render the extracted text (with [Page N] markers preserved) as
//   plain text — figures and tables are lost (Tier 2 extractor doesn't
//   capture them). We don't claim "this is the PDF"; we claim "this is
//   the readable content of the PDF with the relevant bits flagged."
// - Highlighting uses a substring-match + <mark> wrapping pass. Quote
//   text MUST appear in the extractedText (the prompt is constrained
//   to verbatim quotes). Fuzzy whitespace normalisation handles the
//   common cases where extractor whitespace differs slightly from the
//   AI's quote.

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LensDeepResult } from "../../SourceLensPanel";
import { toast } from "sonner";

// Shape of the data the reader needs, regardless of source.
type ReaderInput = {
  sourceTitle: string;
  sourceAuthors: string[];
  sourceYear?: number | null;
  sourceJournal?: string;
  sourceDoi?: string;
  sourcePdfUrl?: string;
  sourceText: string;
  analysis: LensDeepResult;
  assignmentName?: string;
};

// Session-storage payload shape (what SourcesClient writes before nav).
// Kept loose because the Source Finder can pass partial metadata.
type SessionPayload = {
  sourceTitle?: string;
  sourceAuthors?: string[];
  sourceYear?: number;
  sourceJournal?: string;
  sourceDoi?: string;
  sourcePdfUrl?: string;
  sourceText?: string;
  analysis?: LensDeepResult;
  assignmentName?: string;
};

// Convert a stored reference + saved fields into the same ReaderInput
// shape. The references table stores `fields: v.any()` so we widen.
function referenceToReaderInput(
  ref: {
    fields: unknown;
    sourceText?: string;
    lensAnalysis?: unknown;
    assignmentId?: Id<"assignments">;
  },
  assignmentName?: string,
): ReaderInput | null {
  const fields = ref.fields as
    | {
        title?: string;
        authors?: { given?: string; surname?: string }[];
        year?: string;
        journal?: string;
        doi?: string;
        url?: string;
        _abstract?: string;
      }
    | undefined;
  const sourceText = ref.sourceText;
  const analysis = ref.lensAnalysis as LensDeepResult | undefined;
  if (!sourceText || !analysis) return null;
  const authors = (fields?.authors ?? [])
    .map((a) => {
      const s = a.surname ?? "";
      const g = a.given ?? "";
      return `${s}${g ? ", " + g : ""}`.trim();
    })
    .filter((x) => x.length > 0);
  return {
    sourceTitle: fields?.title ?? "(untitled source)",
    sourceAuthors: authors,
    sourceYear: fields?.year ? Number(fields.year) : undefined,
    sourceJournal: fields?.journal,
    sourceDoi: fields?.doi,
    sourcePdfUrl: fields?.url,
    sourceText,
    analysis,
    assignmentName,
  };
}

// Normalise whitespace for fuzzy quote matching. AI-emitted quotes
// sometimes collapse double spaces or use slightly different em-dash /
// non-breaking-space handling than the pdfjs text extractor. This
// canonicalises both sides before matching.
function normaliseForMatch(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-") // em/en dash → hyphen
    .replace(/[‘’]/g, "'") // smart quotes → straight
    .replace(/[“”]/g, '"')
    .trim();
}

// Find every occurrence of `quote` in `text` using normalised matching.
// Returns positions in the ORIGINAL text, not the normalised one, so
// callers can splice into the original with correct offsets.
//
// Algorithm: walk through the original text in windows that match the
// normalised quote's length. For each candidate window, compute its
// normalised form and compare. This is O(N*M) but for our sizes
// (text ≤ 200k chars, quote ≤ 500 chars) is fine.
function findQuotePositions(
  text: string,
  quote: string,
): { start: number; end: number }[] {
  const positions: { start: number; end: number }[] = [];
  if (quote.length < 10) return positions; // too short to be a useful quote
  const normalisedText = normaliseForMatch(text);
  const normalisedQuote = normaliseForMatch(quote);
  if (normalisedQuote.length < 10) return positions;
  // Fast path: exact match in normalised text. We then map back to
  // original positions by walking. The mapping is approximate when
  // normalisation collapsed whitespace, but good enough for highlight
  // positioning (off-by-one whitespace doesn't matter visually).
  let searchFrom = 0;
  while (searchFrom < normalisedText.length) {
    const idx = normalisedText.indexOf(normalisedQuote, searchFrom);
    if (idx < 0) break;
    // Map normalised index back to original. Walk the original counting
    // non-collapsed positions until we hit `idx` in normalised space.
    const start = mapNormalisedIndexToOriginal(text, idx);
    const end = mapNormalisedIndexToOriginal(
      text,
      idx + normalisedQuote.length,
    );
    if (start >= 0 && end > start) {
      positions.push({ start, end });
    }
    searchFrom = idx + normalisedQuote.length;
  }
  return positions;
}

// Given an index in the normalised form of `original`, return the
// corresponding character index in `original`. Because normalisation
// collapses runs of whitespace to single spaces, the original index
// is usually slightly larger than the normalised one.
function mapNormalisedIndexToOriginal(
  original: string,
  normalisedIdx: number,
): number {
  let origIdx = 0;
  let normIdx = 0;
  while (origIdx < original.length && normIdx < normalisedIdx) {
    const ch = original[origIdx];
    if (/\s/.test(ch)) {
      // Skip any further whitespace in original; in normalised it
      // counted as one space.
      while (origIdx < original.length && /\s/.test(original[origIdx])) {
        origIdx++;
      }
      normIdx++; // the single space
    } else {
      origIdx++;
      normIdx++;
    }
  }
  return origIdx;
}

// Build the rendered HTML for the paper text with highlights baked in.
// Returns an array of segments — each either plain text or a highlight
// wrapper — so React can render them with stable keys.
type RenderedSegment =
  | { kind: "text"; text: string }
  | {
      kind: "highlight";
      text: string;
      quoteIndex: number;
      section: string;
      whyItMatters: string;
    };

function buildSegments(
  text: string,
  quotes: { section: string; quote: string; whyItMatters: string }[],
): RenderedSegment[] {
  // Collect all highlight ranges across all quotes, with the quote
  // index that produced them (so click-to-scroll knows which sidebar
  // item is active).
  const ranges: {
    start: number;
    end: number;
    quoteIndex: number;
    section: string;
    whyItMatters: string;
  }[] = [];
  quotes.forEach((q, i) => {
    const positions = findQuotePositions(text, q.quote);
    for (const p of positions) {
      ranges.push({
        start: p.start,
        end: p.end,
        quoteIndex: i,
        section: q.section,
        whyItMatters: q.whyItMatters,
      });
    }
  });
  // Sort + de-overlap. If two highlights overlap (e.g. the AI emitted
  // two quotes that share a sentence), keep the earlier one and skip
  // the overlapping latter.
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) continue;
    merged.push(r);
  }
  // Walk the text and emit segments between ranges.
  const segments: RenderedSegment[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, r.start) });
    }
    segments.push({
      kind: "highlight",
      text: text.slice(r.start, r.end),
      quoteIndex: r.quoteIndex,
      section: r.section,
      whyItMatters: r.whyItMatters,
    });
    cursor = r.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

export default function ReaderClient() {
  const searchParams = useSearchParams();
  const refIdParam = searchParams.get("refId");
  const sessionKey = searchParams.get("session");

  // Convex reference lookup (skipped if we're using session payload).
  // Convex queries accept "skip" to no-op when args aren't ready.
  const reference = useQuery(
    api.references.get,
    refIdParam ? { id: refIdParam as Id<"references"> } : "skip",
  );
  const assignments = useQuery(api.assignments.list);

  // Session payload (loaded once on mount).
  const [sessionPayload, setSessionPayload] = useState<SessionPayload | null>(
    null,
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);
  useEffect(() => {
    if (!sessionKey) {
      setSessionLoaded(true);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (raw) {
        setSessionPayload(JSON.parse(raw) as SessionPayload);
      }
    } catch {
      // ignore parse failures — we'll fall through to "no data" state
    }
    setSessionLoaded(true);
  }, [sessionKey]);

  // Resolve to a unified ReaderInput. Either path may legitimately not
  // be ready yet; the UI handles loading states.
  const input: ReaderInput | null = useMemo(() => {
    if (refIdParam && reference) {
      const assignmentName = reference.assignmentId
        ? assignments?.find((a) => a._id === reference.assignmentId)?.name
        : undefined;
      return referenceToReaderInput(reference, assignmentName);
    }
    if (sessionPayload?.sourceText && sessionPayload.analysis) {
      return {
        sourceTitle: sessionPayload.sourceTitle ?? "(untitled source)",
        sourceAuthors: sessionPayload.sourceAuthors ?? [],
        sourceYear: sessionPayload.sourceYear,
        sourceJournal: sessionPayload.sourceJournal,
        sourceDoi: sessionPayload.sourceDoi,
        sourcePdfUrl: sessionPayload.sourcePdfUrl,
        sourceText: sessionPayload.sourceText,
        analysis: sessionPayload.analysis,
        assignmentName: sessionPayload.assignmentName,
      };
    }
    return null;
  }, [refIdParam, reference, sessionPayload, assignments]);

  // Pre-compute the rendered segments. This is the heavy work but only
  // runs when the input changes (memoised).
  const segments = useMemo(() => {
    if (!input) return [] as RenderedSegment[];
    return buildSegments(input.sourceText, input.analysis.paragraphQuotes ?? []);
  }, [input]);

  // Refs to each highlight DOM node so click-to-scroll from the
  // sidebar can target a specific one. Keyed by quote index.
  const highlightRefs = useRef<Record<number, HTMLElement | null>>({});

  const scrollToQuote = (quoteIndex: number) => {
    const el = highlightRefs.current[quoteIndex];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash the highlight briefly to draw attention.
    el.classList.add("ring-2", "ring-amber-500");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-amber-500");
    }, 1500);
  };

  // ----- Render states -----
  if (refIdParam && reference === undefined) {
    // Convex query still loading
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-500">Loading saved source…</p>
      </main>
    );
  }
  if (sessionKey && !sessionLoaded) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-500">Loading source…</p>
      </main>
    );
  }
  if (!input) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-4">
        <h1 className="text-xl font-semibold">Source not available</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We couldn&apos;t find the source text for this reader. This can happen if:
        </p>
        <ul className="ml-5 list-disc text-sm text-slate-600 dark:text-slate-400">
          <li>The browser tab was reopened and the session data was lost (try running Deep Read again from Source Finder)</li>
          <li>The reference doesn&apos;t have a saved Deep Read analysis yet</li>
        </ul>
        <Link
          href="/uni/sources"
          className="inline-flex rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
        >
          ← Back to Source Finder
        </Link>
      </main>
    );
  }

  const r = input.analysis;
  const totalHighlights = segments.filter((s) => s.kind === "highlight").length;
  const expectedHighlights = (r.paragraphQuotes ?? []).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Source Reader · with AI highlights
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {input.sourceTitle}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {input.sourceAuthors.length > 0 ? input.sourceAuthors.join(", ") : "—"}
            {input.sourceYear ? ` · ${input.sourceYear}` : ""}
            {input.sourceJournal ? ` · ${input.sourceJournal}` : ""}
            {input.assignmentName ? ` · audited against ${input.assignmentName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {input.sourcePdfUrl && (
            <a
              href={input.sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              title="Open the original PDF on the publisher's site"
            >
              Open original PDF ↗
            </a>
          )}
          <Link
            href="/uni/sources"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            ← Source Finder
          </Link>
        </div>
      </header>

      {/* Highlight-coverage warning if some AI quotes couldn't be found
          in the extracted text (rare but possible — encoding mismatch,
          rendered text differs from extractor output). */}
      {expectedHighlights > 0 && totalHighlights < expectedHighlights && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ {expectedHighlights - totalHighlights} of {expectedHighlights} AI
          quotes couldn&apos;t be located in the extracted text and aren&apos;t
          highlighted inline. They&apos;re still listed in the sidebar.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main column — paper text with highlights */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Extracted from the PDF. Figures and tables aren&apos;t shown — for
            the full layout open the original PDF (top right).
          </p>
          <article
            className="prose prose-slate max-w-none whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-slate-900 dark:prose-invert dark:text-slate-100"
            style={{ wordBreak: "break-word" }}
          >
            {segments.map((seg, i) => {
              if (seg.kind === "text") {
                return <span key={i}>{seg.text}</span>;
              }
              return (
                <mark
                  key={i}
                  ref={(el) => {
                    // Each quote may have multiple occurrences; we only
                    // need the first as the scroll target.
                    if (highlightRefs.current[seg.quoteIndex] == null) {
                      highlightRefs.current[seg.quoteIndex] = el;
                    }
                  }}
                  className="rounded-sm bg-amber-200/80 px-0.5 transition-shadow dark:bg-amber-400/30 dark:text-amber-100"
                  title={`${seg.section} — ${seg.whyItMatters}`}
                >
                  {seg.text}
                </mark>
              );
            })}
          </article>
        </section>

        {/* Sidebar — Lens analysis + quote jump-links */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {/* Relevance summary */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
              Relevance
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {r.relevance.score}/10
            </p>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              {r.relevance.verdict}
            </p>
          </div>

          {/* Click-to-scroll quotes */}
          {r.paragraphQuotes && r.paragraphQuotes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                AI highlights ({r.paragraphQuotes.length})
              </p>
              <ol className="mt-2 space-y-2">
                {r.paragraphQuotes.map((q, i) => {
                  const canScroll = highlightRefs.current[i] != null;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => scrollToQuote(i)}
                        disabled={!canScroll}
                        className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${
                          canScroll
                            ? "border-amber-300 bg-amber-50 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/30 dark:hover:border-amber-500 dark:hover:bg-amber-900/40"
                            : "cursor-not-allowed border-slate-300 bg-slate-100 opacity-60 dark:border-slate-700 dark:bg-slate-900"
                        }`}
                        title={canScroll ? "Jump to this highlight" : "Not found in extracted text"}
                      >
                        <p className="font-medium text-amber-900 dark:text-amber-200">
                          {q.section}
                        </p>
                        <p className="mt-0.5 italic text-slate-700 dark:text-slate-300">
                          &ldquo;{q.quote.length > 100 ? q.quote.slice(0, 100) + "…" : q.quote}&rdquo;
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                          {q.whyItMatters}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Section-by-section breakdown */}
          {r.sectionRelevance && r.sectionRelevance.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Section relevance
              </p>
              <ul className="mt-2 space-y-1.5">
                {r.sectionRelevance.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-800"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {s.section}
                      </span>
                      <span
                        className={
                          s.relevance === "high"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : s.relevance === "medium"
                              ? "text-sky-700 dark:text-sky-300"
                              : s.relevance === "skip"
                                ? "text-rose-700 dark:text-rose-300"
                                : "text-slate-600 dark:text-slate-400"
                        }
                      >
                        {s.relevance}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                      {s.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested citation — easy to copy */}
          {r.suggestedCitation && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Suggested citation
              </p>
              <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {r.suggestedCitation}
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(r.suggestedCitation);
                    toast.success("Copied citation");
                  } catch {
                    toast.error("Couldn't copy");
                  }
                }}
                className="mt-1.5 text-[11px] text-sky-600 hover:text-sky-500 dark:text-sky-300"
              >
                Copy
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
