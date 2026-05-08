"use client";

import { api } from "@/convex/_generated/api";
import PageHeader from "../PageHeader";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { formatReference } from "@/lib/apa7/format";
import type { Author, SourceFields, SourceType } from "@/lib/apa7/types";
import { useStoredState } from "@/lib/useStoredState";

type SearchResult = {
  id?: string;
  title: string;
  year: number | null;
  authors: Author[];
  journal?: string;
  publisher?: string;
  type?: string;
  doi?: string;
  url?: string;
  openAccessUrl?: string;
  citedByCount: number;
  abstract?: string;
};

type SearchResponse = {
  total: number;
  results: SearchResult[];
};

const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)]";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";

function authorLabel(a: Author): string {
  if (a.kind === "group") return a.name;
  const initials = a.given
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
  return initials ? `${a.surname}, ${initials}` : a.surname;
}

function displayAuthors(authors: Author[]): string {
  if (authors.length === 0) return "Unknown author";
  if (authors.length <= 3) return authors.map(authorLabel).join(", ");
  return `${authorLabel(authors[0])} et al.`;
}

function deriveSourceType(result: SearchResult): SourceType {
  const t = (result.type ?? "").toLowerCase();
  if (t === "book") return "book";
  if (t === "book-chapter" || t === "book-part") return "bookChapter";
  if (t === "report" || t === "monograph") return "report";
  if (result.journal) return "journalArticle";
  if (t === "journal-article") return "journalArticle";
  return "journalArticle";
}

function buildSourceFields(
  result: SearchResult,
  sourceType: SourceType
): SourceFields {
  const yearStr = result.year != null ? String(result.year) : "";
  switch (sourceType) {
    case "book":
      return {
        sourceType: "book",
        fields: {
          authors: result.authors,
          year: yearStr,
          title: result.title,
          publisher: result.publisher ?? "",
          doi: result.doi || undefined,
        },
      };
    case "bookChapter":
      return {
        sourceType: "bookChapter",
        fields: {
          authors: result.authors,
          year: yearStr,
          chapterTitle: result.title,
          editors: [],
          bookTitle: result.journal ?? result.title,
          publisher: result.publisher ?? "",
          doi: result.doi || undefined,
        },
      };
    case "report":
      return {
        sourceType: "report",
        fields: {
          authors: result.authors,
          year: yearStr,
          title: result.title,
          publisher: result.publisher || undefined,
          url: result.url || result.openAccessUrl || undefined,
        },
      };
    case "journalArticle":
    default:
      return {
        sourceType: "journalArticle",
        fields: {
          authors: result.authors,
          year: yearStr,
          title: result.title,
          journal: result.journal ?? "",
          doi: result.doi || undefined,
          url: result.url || undefined,
        },
      };
  }
}

function resultKey(r: SearchResult, idx: number): string {
  return r.id ?? r.doi ?? r.url ?? `${idx}-${r.title}`;
}

// Shape of fields we read off a saved analysis row. The result blob is
// stored as `v.any()` so we narrow it client-side. The new
// `searchableQueries` field holds research-query-shaped strings for each
// task; older analyses don't have it and we fall back to a heuristic
// filter on the subQuestions field.
interface AnalysisShape {
  keyQuestion?: string;
  researchKeywords?: string[];
  sourceTypesNeeded?: string[];
  tasks?: {
    taskNumber: string;
    subQuestions?: string[];
    searchableQueries?: string[];
    conceptsRequired?: string[];
  }[];
}

// Filter subQuestions to drop entries that are clearly task instructions
// or formatting rules rather than research queries. Used as a fallback
// for older analyses that don't have searchableQueries populated.
function filterSearchable(items: string[]): string[] {
  const SKIP = [
    /^select\b/i,
    /^choose\b/i,
    /^pick\b/i,
    /^begin\b/i,
    /^include\b/i,
    /paragraph/i,
    /heading/i,
    /reference list/i,
    /APA/i,
    /citation/i,
    /word count/i,
    /^write a\b/i,
    /title page/i,
  ];
  return items.filter((s) => {
    const len = s.trim().split(/\s+/).length;
    if (len < 4 || len > 25) return false;
    return !SKIP.some((re) => re.test(s));
  });
}

export default function SourcesClient() {
  const assignments = useQuery(api.assignments.list);
  const search = useAction(api.sources.search);
  const createRef = useMutation(api.references.create);

  const [selectedAssignment, setSelectedAssignment] = useState<
    Id<"assignments"> | "all"
  >("all");
  const [query, setQuery] = useState("");
  const [onlyPeerReviewed, setOnlyPeerReviewed] = useStoredState<boolean>("uni-sources-peer-reviewed", false);
  const [yearFrom, setYearFrom] = useStoredState<string>("uni-sources-from-year", "");
  const [sourceType, setSourceType] = useStoredState<string>("uni-sources-source-type", "all");
  const [openAccessOnly, setOpenAccessOnly] = useStoredState<boolean>("uni-sources-open-access", false);
  const [nzAuthoredOnly, setNzAuthoredOnly] = useStoredState<boolean>("uni-sources-nz-authored", false);
  const [sortBy, setSortBy] = useStoredState<string>("uni-sources-sort-by", "relevance");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Pull the most recent analysis for the active assignment so we can
  // suggest research keywords / sub-questions one click away. "skip" when
  // no assignment is active — Convex hooks accept that to no-op.
  const analyses = useQuery(
    api.analysisStore.list,
    selectedAssignment !== "all"
      ? { assignmentId: selectedAssignment }
      : "skip",
  );
  const latestAnalysis: AnalysisShape | null =
    analyses && analyses.length > 0
      ? (analyses[0].result as AnalysisShape)
      : null;

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-sources");
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { window.localStorage.setItem("uni-tool-onboarded-sources", "1"); } catch {}
  };

  // Prefill from ?q=... URL param so the Analyser can hand off keywords.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.trim()) {
      setQuery(q.trim());
      // Clean the URL so the prefill doesn't re-fire on back/forward.
      const cleaned = window.location.pathname;
      window.history.replaceState({}, "", cleaned);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const q = query.trim();
    if (q.length < 3) {
      setError("Please enter at least 3 characters.");
      return;
    }
    setSearching(true);
    try {
      const yf = yearFrom.trim() ? Number(yearFrom.trim()) : undefined;
      const result = (await search({
        query: q,
        // Source type takes precedence over the legacy peer-reviewed checkbox
        // when both are set. Pass undefined for "all" so the action skips
        // any type filter at all.
        sourceType: sourceType !== "all" ? sourceType : undefined,
        onlyPeerReviewed:
          sourceType === "all" && onlyPeerReviewed ? true : undefined,
        yearFrom: yf && !Number.isNaN(yf) ? yf : undefined,
        openAccessOnly: openAccessOnly || undefined,
        nzAuthoredOnly: nzAuthoredOnly || undefined,
        sortBy: sortBy !== "relevance" ? sortBy : undefined,
      })) as SearchResponse;
      setResponse(result);
      setLastQuery(q);
      setExpanded({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResponse(null);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (result: SearchResult, idx: number) => {
    const key = resultKey(result, idx);
    if (added[key] || adding[key]) return;
    setAdding((s) => ({ ...s, [key]: true }));
    try {
      const sourceType = deriveSourceType(result);
      const built = buildSourceFields(result, sourceType);
      const formatted = formatReference(built);
      await createRef({
        assignmentId:
          selectedAssignment === "all" ? undefined : selectedAssignment,
        sourceType,
        fields: built.fields,
        formatted: formatted.formattedHtml,
        inTextShort: formatted.inTextShort,
        inTextNarrative: formatted.inTextNarrative,
        sortKey: formatted.sortKey,
      });
      setAdded((s) => ({ ...s, [key]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add reference.");
    } finally {
      setAdding((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="Source Finder"
        title="Search 250M+ scholarly works"
        description="Powered by OpenAlex (free, no key). Filter by peer-reviewed and year. One-click import as a properly formatted APA 7 reference."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">Quick start</p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Type a topic, author, or set of keywords into the search box.</li>
                <li>Optionally tick &ldquo;peer-reviewed only&rdquo; or set a &ldquo;from year&rdquo; filter.</li>
                <li>Click Search ” you&rsquo;ll get up to 25 results from OpenAlex (250M+ scholarly works).</li>
                <li>Click &ldquo;View&rdquo; on any result to see it on the publisher&rsquo;s page.</li>
                <li>Click &ldquo;Add as reference&rdquo; to import it as a properly formatted APA 7 reference.</li>
              </ol>
            </div>
            <button type="button" onClick={dismissOnboarding} aria-label="Dismiss" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Assignment
        </h2>
        <div className="mt-3">
          <select
            value={selectedAssignment}
            onChange={(e) =>
              setSelectedAssignment(
                e.target.value === "all"
                  ? "all"
                  : (e.target.value as Id<"assignments">)
              )
            }
            className={`${inputStyle} max-w-md`}
          >
            <option value="all">All references (no assignment filter)</option>
            {assignments?.map((a) => (
              <option key={a._id} value={a._id}>
                {a.courseCode ? `${a.courseCode} ” ${a.name}` : a.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Analysis-aware suggestions: only renders when the user has
          chosen an assignment AND that assignment has at least one
          saved analysis. Pulled from the analyser's researchKeywords,
          per-task sub-questions, and the overall keyQuestion — each
          one click pre-fills the search and submits. */}
      {selectedAssignment !== "all" && latestAnalysis && (
        <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
              Suggested by your analysis
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click any chip to search it
            </p>
          </div>

          {/* Research keywords — broad search terms */}
          {latestAnalysis.researchKeywords && latestAnalysis.researchKeywords.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Keywords</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {latestAnalysis.researchKeywords.map((kw, i) => (
                  <button
                    key={`kw-${i}`}
                    type="button"
                    onClick={() => {
                      setQuery(kw);
                      setLastQuery("");
                      // Trigger a search immediately. handleSearch reads from `query`
                      // state so we use a microtask delay to let the state apply.
                      setTimeout(() => {
                        const form = document.querySelector("form");
                        if (form) form.requestSubmit();
                      }, 0);
                    }}
                    className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-xs text-sky-800 transition-colors hover:border-sky-500 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-slate-900 dark:text-sky-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/60"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Per-task searchable queries — actual scholarly-search phrases.
              Prefer the analyser's searchableQueries field; for older
              analyses that don't have it, fall back to a filtered view of
              subQuestions that strips task instructions / formatting. */}
          {latestAnalysis.tasks && latestAnalysis.tasks.length > 0 && (() => {
            const tasksWithQueries = latestAnalysis.tasks.map((task) => {
              const queries =
                task.searchableQueries && task.searchableQueries.length > 0
                  ? task.searchableQueries
                  : filterSearchable(task.subQuestions ?? []);
              return { task, queries };
            }).filter((x) => x.queries.length > 0);

            if (tasksWithQueries.length === 0) return null;

            return (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Search queries for each task
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {tasksWithQueries.map(({ task, queries }, ti) => (
                    <li key={`task-${ti}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {task.taskNumber}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {queries.map((sq, si) => (
                          <button
                            key={`sq-${ti}-${si}`}
                            type="button"
                            onClick={() => {
                              setQuery(sq);
                              setLastQuery("");
                              setTimeout(() => {
                                const form = document.querySelector("form");
                                if (form) form.requestSubmit();
                              }, 0);
                            }}
                            title={sq}
                            className="max-w-full truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-xs text-slate-800 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                          >
                            {sq.length > 80 ? `${sq.slice(0, 80)}…` : sq}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* The overall key question is shown for context only — it's
              too long/broad to use as a keyword search and OpenAlex
              returns 0 results for natural-language sentences with this
              many concepts. Use the keyword chips and per-task queries
              above instead. */}
          {latestAnalysis.keyQuestion && (
            <div className="mt-4 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                The big question:{" "}
              </span>
              <span>{latestAnalysis.keyQuestion}</span>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Use the shorter keyword chips above for actual searches — long sentences usually return zero results on a keyword database.
              </p>
            </div>
          )}
        </section>
      )}

      {/* When an assignment is active but has NO analysis yet, prompt them
          to run it — analysis is what unlocks the suggestions above. */}
      {selectedAssignment !== "all" && analyses !== undefined && analyses.length === 0 && (
        <section className="mb-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-sm dark:border-amber-700/60 dark:bg-amber-950/30">
          <p className="text-amber-900 dark:text-amber-200">
            <span className="font-medium">Tip:</span> run the Analyser on this assignment first
            and we&apos;ll suggest research questions and keywords here based on the brief.
          </p>
          <a
            href={`/uni/analyser?assignmentId=${selectedAssignment}`}
            className="mt-2 inline-block text-xs font-medium text-amber-800 underline hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
          >
            Open Analyser →
          </a>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Search
        </h2>
        <form onSubmit={handleSearch} className="mt-3 space-y-4">
          <div>
            <span className={labelStyle}>Research question or keywords</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. effects of social media on adolescent wellbeing"
              className={`${inputStyle} text-base`}
            />
          </div>
          {/* Top row: source type + sort by — these change the SHAPE of
              results most dramatically so they sit visually first. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelStyle}>Source type</span>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className={inputStyle}
              >
                <option value="all">All types</option>
                <option value="journalArticle">Journal article</option>
                <option value="book">Book</option>
                <option value="bookChapter">Book chapter</option>
                <option value="thesis">Thesis / dissertation</option>
              </select>
            </div>
            <div>
              <span className={labelStyle}>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={inputStyle}
              >
                <option value="relevance">Relevance</option>
                <option value="cited">Most cited</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          {/* Year-from + checkboxes row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelStyle}>Published since (year)</span>
              <input
                type="number"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="2020"
                className={inputStyle}
                min={1900}
                max={2100}
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              {/* Peer-reviewed is hidden when source type is set to a
                  specific type — it'd be redundant. Only meaningful for
                  the "All types" case. */}
              {sourceType === "all" && (
                <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyPeerReviewed}
                    onChange={(e) => setOnlyPeerReviewed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 focus:ring-sky-500"
                  />
                  Peer-reviewed only
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={openAccessOnly}
                  onChange={(e) => setOpenAccessOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 focus:ring-sky-500"
                />
                Open access only{" "}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  (free to read)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={nzAuthoredOnly}
                  onChange={(e) => setNzAuthoredOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 focus:ring-sky-500"
                />
                NZ-authored only{" "}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  (at least one NZ-affiliated author)
                </span>
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div>
            <button type="submit" disabled={searching} className={buttonPrimary}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </section>

      {searching && !response && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-11/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-9/12 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-10/12 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {response && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            {response.results.length} of {response.total.toLocaleString()} results
            for &ldquo;{lastQuery}&rdquo;
          </h2>
          {response.results.length === 0 ? (
            <ZeroResultsHelp
              lastQuery={lastQuery}
              onlyPeerReviewed={onlyPeerReviewed}
              openAccessOnly={openAccessOnly}
              nzAuthoredOnly={nzAuthoredOnly}
              yearFrom={yearFrom}
              sourceType={sourceType}
              onShorten={(short) => {
                setQuery(short);
                setLastQuery("");
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
              onTogglePeerReviewed={() => {
                setOnlyPeerReviewed(false);
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
              onClearYear={() => {
                setYearFrom("");
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
              onToggleOpenAccess={() => {
                setOpenAccessOnly(false);
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
              onToggleNzAuthored={() => {
                setNzAuthoredOnly(false);
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
              onClearFilters={() => {
                setOnlyPeerReviewed(false);
                setOpenAccessOnly(false);
                setNzAuthoredOnly(false);
                setYearFrom("");
                setSourceType("all");
                setTimeout(() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }, 0);
              }}
            />
          ) : (
            <ul className="space-y-4">
              {response.results.map((r, idx) => {
                const key = resultKey(r, idx);
                const isExpanded = expanded[key] ?? false;
                const isAdded = added[key] ?? false;
                const isAdding = adding[key] ?? false;
                const abstract = r.abstract ?? "";
                const truncatedAbstract =
                  abstract.length > 280
                    ? `${abstract.slice(0, 280)}…`
                    : abstract;
                return (
                  <li
                    key={key}
                    className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-sm transition-all hover:-translate-y-px hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none dark:hover:border-sky-700"
                  >
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {r.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {displayAuthors(r.authors)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {r.year ?? "n.d."}
                      {r.journal ? ` Â· ${r.journal}` : ""}
                      {!r.journal && r.publisher ? ` Â· ${r.publisher}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
                        Cited {r.citedByCount.toLocaleString()} times
                      </span>
                      {r.type && (
                        <span className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {r.type}
                        </span>
                      )}
                    </div>
                    {abstract && (
                      <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                        <p className="leading-relaxed">
                          {isExpanded ? abstract : truncatedAbstract}
                        </p>
                        {abstract.length > 280 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((s) => ({ ...s, [key]: !isExpanded }))
                            }
                            className="mt-1 text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {/* Primary "View" link. Prefers DOI (resolves to
                          publisher's landing page), then the OpenAlex
                          landing-page URL, then the open-access PDF.
                          One of these is virtually always present. */}
                      {(r.doi || r.url || r.openAccessUrl) && (
                        <a
                          href={
                            r.doi
                              ? `https://doi.org/${r.doi}`
                              : (r.url ?? r.openAccessUrl)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-500 dark:hover:bg-sky-900/40"
                        >
                          View
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M7 17l10-10M9 7h8v8" />
                          </svg>
                        </a>
                      )}
                      {r.doi && (
                        <a
                          href={`https://doi.org/${r.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                        >
                          DOI: {r.doi}
                        </a>
                      )}
                      {r.openAccessUrl && (
                        <a
                          href={r.openAccessUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                        >
                          Open-access PDF
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAdd(r, idx)}
                        disabled={isAdded || isAdding}
                        className={`${buttonPrimary} ml-auto`}
                      >
                        {isAdded
                          ? "Added ✓"
                          : isAdding
                            ? "Adding…"
                            : "Add to references"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>
      )}
    </main>
  );
}

// Zero-results helper. Diagnoses why a search returned nothing and
// offers concrete fixes:
//  - If the query is long (>10 words), offers a shortened version
//    (stopwords + filler stripped, top distinctive nouns kept).
//  - If filters are tight, offers a "clear filters and retry" button.
//  - Otherwise just tells the student to broaden the keywords.

const STOPWORDS = new Set([
  "how",
  "can",
  "be",
  "is",
  "are",
  "was",
  "were",
  "the",
  "a",
  "an",
  "of",
  "in",
  "and",
  "or",
  "to",
  "for",
  "on",
  "at",
  "by",
  "with",
  "from",
  "as",
  "that",
  "this",
  "these",
  "those",
  "what",
  "why",
  "when",
  "where",
  "which",
  "do",
  "does",
  "did",
  "applied",
  "real",
  "world",
  "scenarios",
  "explain",
  "their",
  "between",
  "have",
  "has",
  "had",
]);

function shortenQuery(q: string): string {
  // Drop punctuation, lower, split, drop stopwords + duplicates, keep
  // the first 5-6 distinctive terms.
  const words = q
    .toLowerCase()
    .replace(/[?!.,;:()"'`]/g, "")
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !STOPWORDS.has(w));
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    distinct.push(w);
    if (distinct.length >= 6) break;
  }
  return distinct.join(" ");
}

function ZeroResultsHelp(props: {
  lastQuery: string;
  onlyPeerReviewed: boolean;
  openAccessOnly: boolean;
  nzAuthoredOnly: boolean;
  yearFrom: string;
  sourceType: string;
  onShorten: (q: string) => void;
  onClearFilters: () => void;
  onTogglePeerReviewed: () => void;
  onClearYear: () => void;
  onToggleOpenAccess: () => void;
  onToggleNzAuthored: () => void;
}) {
  const queryWordCount = props.lastQuery.trim().split(/\s+/).length;
  const isLong = queryWordCount > 10;
  const shortened = isLong ? shortenQuery(props.lastQuery) : "";
  const activeFilters: string[] = [];
  if (props.onlyPeerReviewed) activeFilters.push("Peer-reviewed only");
  if (props.openAccessOnly) activeFilters.push("Open access only");
  if (props.nzAuthoredOnly) activeFilters.push("NZ-authored only");
  if (props.yearFrom.trim()) activeFilters.push(`From ${props.yearFrom}`);
  if (props.sourceType !== "all") activeFilters.push(`Type: ${props.sourceType}`);
  const anyFilterOn = activeFilters.length > 0;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600 dark:text-slate-400">
        No results. Here&apos;s why and what to try:
      </p>
      <ul className="ml-4 list-disc space-y-2 text-slate-700 dark:text-slate-300">
        {isLong && (
          <li>
            Your query is <strong>{queryWordCount} words</strong>. Keyword
            databases work best with 3–6 distinctive terms. Try:{" "}
            <button
              type="button"
              onClick={() => props.onShorten(shortened)}
              className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-800 hover:border-sky-500 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
            >
              {shortened}
            </button>{" "}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              (click to search)
            </span>
          </li>
        )}
        {/* Per-filter toggles when each is the likely culprit. The
            peer-reviewed toggle is the most common cause of zero
            results because foundational psych papers are pre-2020 AND
            are journal articles — combined with strict type filtering,
            edge-case queries vanish. */}
        {props.onlyPeerReviewed && (
          <li>
            <strong>Peer-reviewed only</strong> is on. This narrows results to
            journal articles, reviews, book chapters and conference papers.
            Foundational papers (Skinner 1953, Bandura 1977, etc) might still
            be missed if combined with a recent year filter.{" "}
            <button
              type="button"
              onClick={props.onTogglePeerReviewed}
              className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Turn off peer-reviewed
            </button>
          </li>
        )}
        {props.yearFrom.trim() && (
          <li>
            Year filter: <strong>From {props.yearFrom}</strong>. If you need
            foundational/older papers, drop this.{" "}
            <button
              type="button"
              onClick={props.onClearYear}
              className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Clear year filter
            </button>
          </li>
        )}
        {props.openAccessOnly && (
          <li>
            <strong>Open access only</strong> is on. About 30% of papers are
            open access — turning this off triples the result pool.{" "}
            <button
              type="button"
              onClick={props.onToggleOpenAccess}
              className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Turn off open access
            </button>
          </li>
        )}
        {props.nzAuthoredOnly && (
          <li>
            <strong>NZ-authored only</strong> is on. Foundational psychology
            isn&apos;t mostly NZ work; this filter is for NZ-context
            assignments.{" "}
            <button
              type="button"
              onClick={props.onToggleNzAuthored}
              className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Turn off NZ-authored
            </button>
          </li>
        )}
        {anyFilterOn && (
          <li className="text-xs text-slate-500 dark:text-slate-400">
            Or just{" "}
            <button
              type="button"
              onClick={props.onClearFilters}
              className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300"
            >
              clear ALL filters
            </button>{" "}
            and retry.
          </li>
        )}
        {!isLong && !anyFilterOn && (
          <li>Try broader or more common keywords.</li>
        )}
        <li className="text-xs text-slate-500 dark:text-slate-400">
          Or pick one of the keyword chips at the top of the page — those are
          tuned to the assignment.
        </li>
      </ul>
    </div>
  );
}
