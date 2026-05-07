"use client";

import { api } from "@/convex/_generated/api";
import PageHeader from "../PageHeader";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatReference } from "@/lib/apa7/format";
import type { Author, SourceFields, SourceType } from "@/lib/apa7/types";

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
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";

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

export default function SourcesClient() {
  const assignments = useQuery(api.assignments.list);
  const search = useAction(api.sources.search);
  const createRef = useMutation(api.references.create);

  const [selectedAssignment, setSelectedAssignment] = useState<
    Id<"assignments"> | "all"
  >("all");
  const [query, setQuery] = useState("");
  const [onlyPeerReviewed, setOnlyPeerReviewed] = useState(false);
  const [yearFrom, setYearFrom] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});

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
        onlyPeerReviewed: onlyPeerReviewed || undefined,
        yearFrom: yf && !Number.isNaN(yf) ? yf : undefined,
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
                {a.courseCode ? `${a.courseCode} — ${a.name}` : a.name}
              </option>
            ))}
          </select>
        </div>
      </section>

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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={onlyPeerReviewed}
                onChange={(e) => setOnlyPeerReviewed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 focus:ring-sky-500"
              />
              Peer-reviewed only
            </label>
            <div>
              <span className={labelStyle}>Published since (year)</span>
              <input
                type="number"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="2020"
                className={inputStyle}
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No results. Try broader keywords or remove filters.
            </p>
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
                      {r.journal ? ` · ${r.journal}` : ""}
                      {!r.journal && r.publisher ? ` · ${r.publisher}` : ""}
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
                            className="mt-1 text-xs text-sky-400 hover:text-sky-300"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {r.doi && (
                        <a
                          href={`https://doi.org/${r.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-400 hover:text-sky-300"
                        >
                          DOI: {r.doi}
                        </a>
                      )}
                      {r.openAccessUrl && (
                        <a
                          href={r.openAccessUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-emerald-700 bg-emerald-900/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-900/60"
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
