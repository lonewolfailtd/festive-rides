"use client";

import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import PageHeader from "../PageHeader";
import EmptyState from "../EmptyState";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatReference } from "@/lib/apa7/format";
import { sanitizeFormatted } from "@/lib/sanitizeFormatted";
import {
  SOURCE_LABELS,
  type Author,
  type SourceFields,
  type SourceType,
} from "@/lib/apa7/types";
import {
  LensPanel,
  lensResultToMarkdown,
  type LensDeepResult,
} from "../SourceLensPanel";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { extractPdfText } from "@/lib/extractPdfText";

const SOURCE_TYPES: SourceType[] = [
  "book",
  "bookChapter",
  "editedBook",
  "journalArticle",
  "website",
  "newsArticle",
  "report",
  "onlineVideo",
  "aiTool",
];

const newAuthor = (): Author => ({ kind: "person", surname: "", given: "" });

type FormState = {
  authors: Author[];
  year: string;
  monthDay: string;
  title: string;
  edition: string;
  publisher: string;
  doi: string;
  url: string;
  // Chapter
  chapterTitle: string;
  editors: Author[];
  bookTitle: string;
  pageStart: string;
  pageEnd: string;
  // Journal
  journal: string;
  volume: string;
  issue: string;
  // Website / news
  siteName: string;
  retrievedDate: string;
  source: string;
  // Report
  reportNumber: string;
  // Online video
  platform: string;
  // AI tool
  maker: string;
  toolName: string;
  version: string;
  description: string;
};

const emptyForm = (): FormState => ({
  authors: [newAuthor()],
  year: "",
  monthDay: "",
  title: "",
  edition: "",
  publisher: "",
  doi: "",
  url: "",
  chapterTitle: "",
  editors: [newAuthor()],
  bookTitle: "",
  pageStart: "",
  pageEnd: "",
  journal: "",
  volume: "",
  issue: "",
  siteName: "",
  retrievedDate: "",
  source: "",
  reportNumber: "",
  platform: "",
  maker: "",
  toolName: "",
  version: "",
  description: "",
});

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_4px_8px_rgba(2,132,199,0.22),0_12px_24px_-6px_rgba(2,132,199,0.32)] active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_4px_rgba(2,132,199,0.18),0_8px_16px_-4px_rgba(2,132,199,0.25)]";
const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-950/30 dark:hover:text-sky-300";
const buttonGhost =
  "text-xs text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

function buildSourceFields(type: SourceType, f: FormState): SourceFields | null {
  const cleanAuthors = f.authors.filter((a) =>
    a.kind === "person" ? a.surname.trim() : a.name.trim()
  );
  const cleanEditors = f.editors.filter((a) =>
    a.kind === "person" ? a.surname.trim() : a.name.trim()
  );
  switch (type) {
    case "book":
      if (!f.title.trim()) return null;
      return {
        sourceType: "book",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          title: f.title,
          edition: f.edition || undefined,
          publisher: f.publisher,
          doi: f.doi || undefined,
        },
      };
    case "bookChapter":
      if (!f.chapterTitle.trim() || !f.bookTitle.trim()) return null;
      return {
        sourceType: "bookChapter",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          chapterTitle: f.chapterTitle,
          editors: cleanEditors,
          bookTitle: f.bookTitle,
          pageStart: f.pageStart || undefined,
          pageEnd: f.pageEnd || undefined,
          edition: f.edition || undefined,
          publisher: f.publisher,
          doi: f.doi || undefined,
        },
      };
    case "journalArticle":
      if (!f.title.trim() || !f.journal.trim()) return null;
      return {
        sourceType: "journalArticle",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          title: f.title,
          journal: f.journal,
          volume: f.volume || undefined,
          issue: f.issue || undefined,
          pageStart: f.pageStart || undefined,
          pageEnd: f.pageEnd || undefined,
          doi: f.doi || undefined,
          url: f.url || undefined,
        },
      };
    case "website":
      if (!f.title.trim() || !f.url.trim()) return null;
      return {
        sourceType: "website",
        fields: {
          authors: cleanAuthors,
          year: f.year || undefined,
          monthDay: f.monthDay || undefined,
          title: f.title,
          siteName: f.siteName || undefined,
          url: f.url,
          retrievedDate: f.retrievedDate || undefined,
        },
      };
    case "newsArticle":
      if (!f.title.trim() || !f.source.trim()) return null;
      return {
        sourceType: "newsArticle",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          monthDay: f.monthDay || undefined,
          title: f.title,
          source: f.source,
          url: f.url || undefined,
        },
      };
    case "report":
      if (!f.title.trim()) return null;
      return {
        sourceType: "report",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          title: f.title,
          reportNumber: f.reportNumber || undefined,
          publisher: f.publisher || undefined,
          url: f.url || undefined,
        },
      };
    case "editedBook":
      if (!f.title.trim()) return null;
      return {
        sourceType: "editedBook",
        fields: {
          editors: cleanEditors,
          year: f.year,
          title: f.title,
          edition: f.edition || undefined,
          publisher: f.publisher,
          doi: f.doi || undefined,
        },
      };
    case "onlineVideo":
      if (!f.title.trim() || !f.url.trim()) return null;
      return {
        sourceType: "onlineVideo",
        fields: {
          authors: cleanAuthors,
          year: f.year,
          monthDay: f.monthDay || undefined,
          title: f.title,
          platform: f.platform,
          url: f.url,
        },
      };
    case "aiTool":
      if (!f.toolName.trim() || !f.maker.trim()) return null;
      return {
        sourceType: "aiTool",
        fields: {
          maker: f.maker,
          year: f.year,
          toolName: f.toolName,
          version: f.version || undefined,
          description: f.description?.trim() || "Large language model",
          url: f.url,
        },
      };
  }
}

function AuthorsEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Author[];
  onChange: (next: Author[]) => void;
}) {
  const subLabel =
    "block text-[10px] font-medium uppercase tracking-wide text-slate-500";
  return (
    <div>
      <span className={labelStyle}>{label}</span>
      <div className="mt-1 space-y-3">
        {value.map((a, idx) => (
          <div key={idx} className="flex items-end gap-2">
            <div>
              <span className={subLabel}>Type</span>
              <select
                value={a.kind}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] =
                    e.target.value === "person"
                      ? { kind: "person", surname: "", given: "" }
                      : { kind: "group", name: "" };
                  onChange(next);
                }}
                className={`${inputStyle} max-w-[7rem]`}
              >
                <option value="person">Person</option>
                <option value="group">Group</option>
              </select>
            </div>
            {a.kind === "person" ? (
              <>
                <div className="flex-1">
                  <span className={subLabel}>Last name (surname)</span>
                  <input
                    type="text"
                    placeholder="e.g. Grigoryevich"
                    value={a.surname}
                    onChange={(e) => {
                      const next = [...value];
                      next[idx] = { ...a, surname: e.target.value };
                      onChange(next);
                    }}
                    className={inputStyle}
                  />
                </div>
                <div className="flex-1">
                  <span className={subLabel}>First name (given names)</span>
                  <input
                    type="text"
                    placeholder="e.g. Yevgeniy F."
                    value={a.given}
                    onChange={(e) => {
                      const next = [...value];
                      next[idx] = { ...a, given: e.target.value };
                      onChange(next);
                    }}
                    className={inputStyle}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1">
                <span className={subLabel}>Organisation name</span>
                <input
                  type="text"
                  placeholder="e.g. Ministry of Health"
                  value={a.name}
                  onChange={(e) => {
                    const next = [...value];
                    next[idx] = { ...a, name: e.target.value };
                    onChange(next);
                  }}
                  className={inputStyle}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (value.length === 1) onChange([newAuthor()]);
                else onChange(value.filter((_, i) => i !== idx));
              }}
              className={`${buttonGhost} mb-2`}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, newAuthor()])}
          className={buttonGhost}
        >
          + Add another
        </button>
      </div>
    </div>
  );
}

// Small chip-style copy button used for in-text citations.
function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors silently
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied to clipboard" : `Copy ${label}`}
      className={`rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-700 ${
        copied ? "ring-1 ring-emerald-500/60 text-emerald-700 dark:text-emerald-200" : ""
      }`}
    >
      {copied ? "✓ Copied" : text}
    </button>
  );
}

// Map a partial fields object (from lookup actions or stored references) onto
// the flat FormState shape. Only keys that are present in `fields` are mapped,
// so unrelated fields are not clobbered.
function applyFieldsToForm(
  base: FormState,
  fields: Record<string, unknown>
): FormState {
  const next: FormState = { ...base };
  const stringKeys: (keyof FormState)[] = [
    "year",
    "monthDay",
    "title",
    "edition",
    "publisher",
    "doi",
    "url",
    "chapterTitle",
    "bookTitle",
    "pageStart",
    "pageEnd",
    "journal",
    "volume",
    "issue",
    "siteName",
    "retrievedDate",
    "source",
    "reportNumber",
    "platform",
    "maker",
    "toolName",
    "version",
    "description",
  ];
  for (const k of stringKeys) {
    const v = fields[k as string];
    if (typeof v === "string") {
      (next[k] as unknown as string) = v;
    } else if (typeof v === "number") {
      (next[k] as unknown as string) = String(v);
    }
  }
  if (Array.isArray(fields.authors) && fields.authors.length > 0) {
    next.authors = fields.authors as Author[];
  }
  if (Array.isArray(fields.editors) && fields.editors.length > 0) {
    next.editors = fields.editors as Author[];
  }
  return next;
}

// NZ English / Oxford comma checker. Pure function so it can be unit-tested
// later. Returns one flag per problem found in the supplied plain text.
type StyleFlag = {
  kind: "us-spelling" | "oxford-comma";
  match: string;
  suggestion: string;
  snippet: string;
};

const US_TO_NZ: Array<[RegExp, string]> = [
  [/\bcolor(s|ed|ing|ful)?\b/gi, "colour"],
  [/\bbehavior(s|al|ally)?\b/gi, "behaviour"],
  [/\borganiz(e|es|ed|ing|ation|ational)\b/gi, "organis-"],
  [/\banalyz(e|es|ed|ing)\b/gi, "analys-"],
  [/\bcenter(s|ed|ing)?\b/gi, "centre"],
  [/\brecogniz(e|es|ed|ing)\b/gi, "recognis-"],
  [/\blicense\b/gi, "licence (noun) / license (verb)"],
  [/\bdefense\b/gi, "defence"],
  [/\bmodeling\b/gi, "modelling"],
  [/\btraveling\b/gi, "travelling"],
  [/\bjudgment\b/gi, "judgement"],
  [/\bfavor(s|ed|ing|ite|able)?\b/gi, "favour"],
  [/\blabor(s|ed|ing)?\b/gi, "labour"],
];

const stripHtmlTags = (s: string): string =>
  s
    .replace(/<\/?i>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function checkNzStyle(text: string): StyleFlag[] {
  const flags: StyleFlag[] = [];
  for (const [re, suggestion] of US_TO_NZ) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 30);
      const end = Math.min(text.length, m.index + m[0].length + 30);
      flags.push({
        kind: "us-spelling",
        match: m[0],
        suggestion,
        snippet: `…${text.slice(start, end)}…`,
      });
    }
  }
  // Oxford comma: ", word(s), and " — comma immediately before "and" in a
  // prose list. We deliberately do NOT match "&" (APA author lists use
  // "Surname, A., & Surname, B." which is APA style, not an Oxford comma).
  const oxford = /,\s+[^,]+?,\s+and\s+/g;
  let m: RegExpExecArray | null;
  while ((m = oxford.exec(text)) !== null) {
    const start = Math.max(0, m.index - 20);
    const end = Math.min(text.length, m.index + m[0].length + 20);
    flags.push({
      kind: "oxford-comma",
      match: m[0].trim(),
      suggestion: "remove the comma before 'and'",
      snippet: `…${text.slice(start, end)}…`,
    });
  }
  return flags;
}

export default function ReferencesManager() {
  const assignments = useQuery(api.assignments.list);
  const createAssignment = useMutation(api.assignments.create);
  const updateAssignment = useMutation(api.assignments.update);
  const removeAssignment = useMutation(api.assignments.remove);
  const deleteRef = useMutation(api.references.remove);
  const createRef = useMutation(api.references.create);
  const updateRef = useMutation(api.references.update);
  const lookupDoi = useAction(api.lookup.doi);
  const lookupIsbn = useAction(api.lookup.isbn);
  const lookupIssn = useAction(api.lookup.issn);
  const lookupUrl = useAction(api.lookup.url);
  const lookupPdf = useAction(api.lookup.fromPdf);
  // Source Lens action — used to re-run Lens analysis for refs that
  // didn't already have one when they were added.
  const sourceLens = useAction(api.sourceLens.analyse);

  // Per-reference Lens UI state. `lensOpen` toggles the panel; if the
  // reference already has a saved `lensAnalysis`, opening just shows
  // it. If not, opening triggers a Run if abstract is available.
  // `lensRunning` shows a per-card loading state; `lensErrors` shows
  // per-card failure messages.
  const [lensOpen, setLensOpen] = useState<Record<string, boolean>>({});
  const [lensRunning, setLensRunning] = useState<Record<string, boolean>>({});
  const [lensErrors, setLensErrors] = useState<Record<string, string>>({});

  const [selectedAssignment, setSelectedAssignment] = useState<
    Id<"assignments"> | "all"
  >("all");
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("book");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<Id<"references"> | null>(null);

  // Lookup state
  const [doiInput, setDoiInput] = useState("");
  const [isbnInput, setIsbnInput] = useState("");
  const [issnInput, setIssnInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState<null | "doi" | "isbn" | "issn" | "url">(
    null
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfFileRef = useRef<HTMLInputElement | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupInfo, setLookupInfo] = useState<{
    warnings: string[];
    fieldSources: Record<string, string>;
    sourcesQueried: string[];
    aiReasoning?: string;
  } | null>(null);

  // Style checker state
  const [styleFlags, setStyleFlags] = useState<StyleFlag[] | null>(null);

  // Always fetch all user references in one query — we filter client-side
  // by selected assignment so per-list counts come for free in the sidebar.
  const allRefs = useQuery(api.references.listForAssignment, {
    assignmentId: undefined,
  });
  const refs = useMemo(() => {
    if (!allRefs) return undefined;
    if (selectedAssignment === "all") return allRefs;
    return allRefs.filter((r) => r.assignmentId === selectedAssignment);
  }, [allRefs, selectedAssignment]);

  // Counts for the sidebar — { "all": N, [assignmentId]: N }
  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    if (!allRefs) return counts;
    counts.all = allRefs.length;
    for (const r of allRefs) {
      if (r.assignmentId) {
        counts[r.assignmentId] = (counts[r.assignmentId] ?? 0) + 1;
      }
    }
    return counts;
  }, [allRefs]);

  const [filterText, setFilterText] = useState("");
  const [annotatedMode, setAnnotatedMode] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; failed: number }>({
    done: 0,
    total: 0,
    failed: 0,
  });

  // Reverse lookup (paste a draft, find citations, pick candidates)
  const reverseLookupAction = useAction(api.reverseLookup.findInText);
  const [draftText, setDraftText] = useState("");
  const [reverseLookupRunning, setReverseLookupRunning] = useState(false);
  type RevRow = {
    citation: { raw: string; surname: string; year: string; isNarrative: boolean; position: number };
    candidates: {
      id?: string;
      title: string;
      authorsRaw: { kind: "person"; surname: string; given: string }[];
      year: string;
      journal?: string;
      publisher?: string;
      type?: string;
      doi?: string;
      url?: string;
      abstract?: string;
      citedByCount?: number;
    }[];
  };
  const [reverseRows, setReverseRows] = useState<RevRow[] | null>(null);
  const [revSelections, setRevSelections] = useState<Record<number, number>>({});
  const [revImporting, setRevImporting] = useState(false);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [annotationDraft, setAnnotationDraft] = useState<Record<string, string>>({});

  const sortedRefs = useMemo(() => {
    if (!refs) return [];
    const base = [...refs].sort((a, b) => {
      const ka = (a.sortKey ?? "").toLowerCase();
      const kb = (b.sortKey ?? "").toLowerCase();
      return ka.localeCompare(kb);
    });
    const q = filterText.trim().toLowerCase();
    let filtered = base;
    if (q) {
      filtered = filtered.filter((r) => {
        const haystack = [
          r.formatted ?? "",
          r.inTextShort ?? "",
          r.inTextNarrative ?? "",
          r.sortKey ?? "",
          r.notes ?? "",
          r.annotation ?? "",
          (r.tags ?? []).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .replace(/<\/?[a-z]+>/g, "");
        return haystack.includes(q);
      });
    }
    if (activeTagFilters.size > 0) {
      filtered = filtered.filter((r) => {
        const tags = r.tags ?? [];
        for (const t of activeTagFilters) if (!tags.includes(t)) return false;
        return true;
      });
    }
    return filtered;
  }, [refs, filterText, activeTagFilters]);

  const allTags = useMemo(() => {
    if (!refs) return [];
    const set = new Set<string>();
    for (const r of refs) for (const t of r.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [refs]);

  const toggleTagFilter = (tag: string) =>
    setActiveTagFilters((s) => {
      const next = new Set(s);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const addTagToReference = async (
    id: Id<"references">,
    currentTags: string[] | undefined,
    newTag: string
  ) => {
    const cleaned = newTag.trim().toLowerCase();
    if (!cleaned) return;
    const existing = currentTags ?? [];
    if (existing.includes(cleaned)) return;
    try {
      await updateRef({ id, tags: [...existing, cleaned] });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not add tag"));
    }
  };

  const removeTagFromReference = async (
    id: Id<"references">,
    currentTags: string[] | undefined,
    tag: string
  ) => {
    const next = (currentTags ?? []).filter((t) => t !== tag);
    try {
      await updateRef({ id, tags: next });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove tag"));
    }
  };

  // Quick-cite: build "(Smith, 2020; Jones, 2022)" from selected references.
  const buildMultiCite = (selected: typeof sortedRefs): string => {
    const groups = selected
      .map((r) => r.inTextShort ?? "")
      .map((s) => s.replace(/^\(|\)$/g, "").trim())
      .filter((s) => s.length > 0)
      .sort((a, b) => a.localeCompare(b));
    if (groups.length === 0) return "";
    return `(${groups.join("; ")})`;
  };

  const copyMultiCite = async () => {
    const selected = sortedRefs.filter((r) => selectedRefIds.has(r._id));
    const text = buildMultiCite(selected);
    if (!text) {
      toast.error("Select at least one reference first");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${selected.length}-reference citation`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const toggleSelectRef = (id: Id<"references">) =>
    setSelectedRefIds((s) => {
      const next = new Set(s);
      const key = id as unknown as string;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleRenameAssignment = async () => {
    if (selectedAssignment === "all") return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("Please enter a name");
      return;
    }
    try {
      await updateAssignment({ id: selectedAssignment, name: trimmed });
      toast.success("List renamed");
      setEditingAssignment(false);
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Could not rename list")
      );
    }
  };

  const handleDeleteAssignment = () => {
    if (selectedAssignment === "all") return;
    const current = assignments?.find((a) => a._id === selectedAssignment);
    if (!current) return;
    const idToDelete = selectedAssignment;
    const nameToDelete = current.name;
    toast(`Delete list "${nameToDelete}"?`, {
      description:
        "References attached to this list will become unassigned (they're not deleted).",
      duration: 8000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await removeAssignment({ id: idToDelete });
            toast.success(`Deleted list "${nameToDelete}"`);
            setEditingAssignment(false);
            setSelectedAssignment("all");
          } catch (err) {
            toast.error(
              getErrorMessage(err, "Could not delete list")
            );
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const handleNewAssignment = async () => {
    const name = newAssignmentName.trim();
    if (!name) return;
    const id = await createAssignment({ name });
    setNewAssignmentName("");
    setSelectedAssignment(id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSourceType("book");
    setFormError(null);
  };

  const startEdit = (r: {
    _id: Id<"references">;
    sourceType: string;
    fields: unknown;
    assignmentId?: Id<"assignments">;
  }) => {
    setEditingId(r._id);
    setSourceType(r.sourceType as SourceType);
    setForm(applyFieldsToForm(emptyForm(), (r.fields ?? {}) as Record<string, unknown>));
    setFormError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const built = buildSourceFields(sourceType, form);
    if (!built) {
      setFormError("Please fill in the required fields for this source type.");
      return;
    }
    const formatted = formatReference(built);
    setSubmitting(true);
    try {
      if (editingId) {
        await updateRef({
          id: editingId,
          assignmentId:
            selectedAssignment === "all" ? undefined : selectedAssignment,
          sourceType,
          fields: built.fields,
          formatted: formatted.formattedHtml,
          inTextShort: formatted.inTextShort,
          inTextNarrative: formatted.inTextNarrative,
          sortKey: formatted.sortKey,
        });
        cancelEdit();
      } else {
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
        setForm(emptyForm());
      }
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not save."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFindCitations = async () => {
    if (draftText.trim().length < 10) {
      toast.error("Paste a sentence or paragraph that contains citations.");
      return;
    }
    setReverseLookupRunning(true);
    setReverseRows(null);
    setRevSelections({});
    try {
      const res = (await reverseLookupAction({ text: draftText })) as {
        rows: RevRow[];
        totalCitations: number;
      };
      if (!res.rows || res.rows.length === 0) {
        toast("No citations detected", {
          description:
            "We look for patterns like (Smith, 2020), Smith et al. (2022) or (Smith & Jones, 2024).",
        });
      } else {
        toast.success(
          `Found ${res.rows.length} unique citation${res.rows.length === 1 ? "" : "s"}`
        );
      }
      setReverseRows(res.rows);
    } catch (err) {
      toast.error(getErrorMessage(err, "Lookup failed."));
    } finally {
      setReverseLookupRunning(false);
    }
  };

  // Add a single candidate immediately (used by the "Add now" button on
  // each candidate card — bypasses the batch select-and-import flow).
  const handleAddSingleCandidate = async (
    cand: RevRow["candidates"][number]
  ) => {
    try {
      const isJournal =
        cand.type === "journal-article" || cand.type === "article" || !!cand.journal;
      const sourceType: SourceType = isJournal ? "journalArticle" : "website";
      const fields: Record<string, unknown> = {
        authors: cand.authorsRaw,
        year: cand.year,
        title: cand.title,
        journal: cand.journal ?? "",
        doi: cand.doi ?? "",
        url: cand.url ?? "",
        siteName: cand.publisher,
      };
      const built = buildSourceFields(
        sourceType,
        applyFieldsToForm(emptyForm(), fields)
      );
      if (!built) {
        toast.error("Couldn't build that reference");
        return;
      }
      const formatted = formatReference(built);
      await createRef({
        assignmentId:
          selectedAssignment === "all" ? undefined : selectedAssignment,
        sourceType: built.sourceType,
        fields: built.fields,
        formatted: formatted.formattedHtml,
        inTextShort: formatted.inTextShort,
        inTextNarrative: formatted.inTextNarrative,
        sortKey: formatted.sortKey,
      });
      toast.success(`Added "${cand.title.slice(0, 50)}${cand.title.length > 50 ? "…" : ""}"`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add reference"));
    }
  };

  const handleImportReverseSelections = async () => {
    if (!reverseRows) return;
    const picks = Object.entries(revSelections);
    if (picks.length === 0) {
      toast.error("Pick at least one candidate first.");
      return;
    }
    setRevImporting(true);
    let added = 0;
    let failed = 0;
    for (const [rowIdxStr, candIdx] of picks) {
      const row = reverseRows[Number(rowIdxStr)];
      if (!row) continue;
      const cand = row.candidates[candIdx];
      if (!cand) continue;
      try {
        // Build a journal article reference from the candidate (most are
        // journal articles; fall back to website if type doesn't match).
        const isJournal =
          cand.type === "journal-article" || cand.type === "article" || !!cand.journal;
        const sourceType: SourceType = isJournal ? "journalArticle" : "website";
        const fields: Record<string, unknown> = {
          authors: cand.authorsRaw,
          year: cand.year,
          title: cand.title,
          journal: cand.journal ?? "",
          doi: cand.doi ?? "",
          url: cand.url ?? "",
          siteName: cand.publisher,
        };
        const built = buildSourceFields(
          sourceType,
          applyFieldsToForm(emptyForm(), fields)
        );
        if (!built) {
          failed++;
          continue;
        }
        const formatted = formatReference(built);
        await createRef({
          assignmentId:
            selectedAssignment === "all" ? undefined : selectedAssignment,
          sourceType: built.sourceType,
          fields: built.fields,
          formatted: formatted.formattedHtml,
          inTextShort: formatted.inTextShort,
          inTextNarrative: formatted.inTextNarrative,
          sortKey: formatted.sortKey,
        });
        added++;
      } catch {
        failed++;
      }
    }
    setRevImporting(false);
    if (failed === 0) {
      toast.success(`Imported ${added} reference${added === 1 ? "" : "s"}`);
    } else {
      toast.success(
        `Imported ${added}; ${failed} failed (open them manually if needed)`
      );
    }
    setReverseRows(null);
    setRevSelections({});
    setDraftText("");
  };

  const handleBulkImport = async () => {
    const lines = bulkImportText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) {
      toast.error("Paste at least one DOI or URL");
      return;
    }
    setBulkImportRunning(true);
    setBulkProgress({ done: 0, total: lines.length, failed: 0 });
    let done = 0;
    let failed = 0;
    for (const line of lines) {
      try {
        const isDoi = /^10\.\d{4,9}\//.test(line);
        const result = isDoi
          ? await lookupDoi({ doi: line })
          : await lookupUrl({ url: line });
        if (!result || !result.fields) {
          failed++;
          continue;
        }
        const built = buildSourceFields(
          result.sourceType as SourceType,
          applyFieldsToForm(emptyForm(), result.fields as Record<string, unknown>)
        );
        if (!built) {
          failed++;
          continue;
        }
        const formatted = formatReference(built);
        await createRef({
          assignmentId:
            selectedAssignment === "all" ? undefined : selectedAssignment,
          sourceType: built.sourceType,
          fields: built.fields,
          formatted: formatted.formattedHtml,
          inTextShort: formatted.inTextShort,
          inTextNarrative: formatted.inTextNarrative,
          sortKey: formatted.sortKey,
        });
        done++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: done + failed, total: lines.length, failed });
    }
    setBulkImportRunning(false);
    if (failed === 0) {
      toast.success(`Imported ${done} reference${done === 1 ? "" : "s"}`);
    } else {
      toast.success(
        `Imported ${done}, ${failed} failed (probably bad DOI/URL or paywalled site)`
      );
    }
    setBulkImportText("");
  };

  const toggleNotes = (id: string, currentNotes?: string) => {
    setOpenNotes((s) => ({ ...s, [id]: !s[id] }));
    if (!(id in notesDraft)) {
      setNotesDraft((s) => ({ ...s, [id]: currentNotes ?? "" }));
    }
  };

  // Auto-save state per reference (small green indicator after blur).
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});

  // Keyboard shortcuts:
  // "/" focuses search, "n" focuses URL lookup, "Esc" exits select mode + closes notes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "Escape") {
        if (selectMode) {
          setSelectMode(false);
          setSelectedRefIds(new Set());
          e.preventDefault();
        }
        return;
      }
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        urlInputRef.current?.focus();
      } else if (e.key === "s") {
        e.preventDefault();
        setSelectMode((m) => !m);
        if (selectMode) setSelectedRefIds(new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectMode]);

  // Onboarding banner — shown once on first visit, dismissed via localStorage.
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem("uni-tool-onboarded-references");
      if (!seen) setShowOnboarding(true);
    } catch {
      // ignore localStorage errors (private mode etc.)
    }
  }, []);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem("uni-tool-onboarded-references", "1");
    } catch {
      // ignore
    }
  };

  const autoSaveNotes = async (
    id: Id<"references">,
    currentNotes?: string,
    currentAnnotation?: string
  ) => {
    const nextNotes = notesDraft[id] ?? currentNotes ?? "";
    const nextAnnotation =
      annotationDraft[id] !== undefined
        ? annotationDraft[id]
        : currentAnnotation ?? "";
    // Skip the call if nothing changed.
    if (nextNotes === (currentNotes ?? "") && nextAnnotation === (currentAnnotation ?? "")) {
      return;
    }
    try {
      await updateRef({ id, notes: nextNotes, annotation: nextAnnotation });
      setSavedFlash((s) => ({ ...s, [id]: true }));
      setTimeout(
        () => setSavedFlash((s) => ({ ...s, [id]: false })),
        1500
      );
    } catch (err) {
      // Clear any lingering "saved" flash so the UI doesn't claim the
      // notes were saved when the mutation failed.
      setSavedFlash((s) => ({ ...s, [id]: false }));
      toast.error(getErrorMessage(err, "Could not save notes"));
    }
  };

  const handleLookup = async (kind: "doi" | "isbn" | "issn" | "url") => {
    setLookupError(null);
    setLookupInfo(null);
    const value = (
      kind === "doi"
        ? doiInput
        : kind === "isbn"
          ? isbnInput
          : kind === "issn"
            ? issnInput
            : urlInput
    ).trim();
    if (!value) {
      setLookupError(`Please enter a ${kind.toUpperCase()}.`);
      return;
    }
    setLookupBusy(kind);
    try {
      const result =
        kind === "doi"
          ? await lookupDoi({ doi: value })
          : kind === "isbn"
            ? await lookupIsbn({ isbn: value })
            : kind === "issn"
              ? await lookupIssn({ issn: value })
              : await lookupUrl({ url: value });
      if (!result || !result.fields) {
        setLookupError(
          kind === "doi"
            ? "Could not find that DOI."
            : kind === "isbn"
              ? "Could not find that ISBN."
              : kind === "issn"
                ? "Could not find that ISSN."
                : "Could not parse metadata from that URL.",
        );
        return;
      }
      setSourceType(result.sourceType as SourceType);
      setForm((prev) =>
        applyFieldsToForm(prev, result.fields as Record<string, unknown>),
      );
      const info = result as {
        warnings?: string[];
        fieldSources?: Record<string, string>;
        sourcesQueried?: string[];
        aiReasoning?: string;
      };
      setLookupInfo({
        warnings: info.warnings ?? [],
        fieldSources: info.fieldSources ?? {},
        sourcesQueried: info.sourcesQueried ?? [],
        aiReasoning: info.aiReasoning,
      });
    } catch (err) {
      setLookupError(
        getErrorMessage(err, "Lookup failed. Please try again."),
      );
    } finally {
      setLookupBusy(null);
    }
  };

  // Upload a PDF that has no DOI or URL (e.g. a paper a tutor handed out),
  // pull its text out in the browser, and have the AI read the citation
  // details into the same review form the other lookups fill.
  const handlePdfLookup = async (file: File) => {
    setLookupError(null);
    setLookupInfo(null);
    setPdfBusy(true);
    try {
      const { text } = await extractPdfText(file, {
        maxBytes: 25 * 1024 * 1024,
        maxChars: 12000,
        minChars: 80,
        minCharsMessage:
          "That PDF didn't have selectable text — it may be a scan. Enter the details by hand below.",
      });
      const result = await lookupPdf({ text });
      if (!result || !result.fields) {
        setLookupError("Couldn't read citation details from that PDF.");
        return;
      }
      setSourceType(result.sourceType as SourceType);
      setForm((prev) =>
        applyFieldsToForm(prev, result.fields as Record<string, unknown>),
      );
      const info = result as {
        warnings?: string[];
        fieldSources?: Record<string, string>;
        sourcesQueried?: string[];
        aiReasoning?: string;
      };
      setLookupInfo({
        warnings: info.warnings ?? [],
        fieldSources: info.fieldSources ?? {},
        sourcesQueried: info.sourcesQueried ?? [],
        aiReasoning: info.aiReasoning,
      });
      toast.success("Pulled the details from your PDF — check them below, then Save.");
    } catch (err) {
      setLookupError(getErrorMessage(err, "Couldn't read that PDF."));
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadDocx = () => {
    if (sortedRefs.length === 0) return;
    // APA 7 (Open Polytech 2024): double line spacing within AND between
    // entries; 0.5 inch (36pt / 1.27 cm) hanging indent on second+ lines;
    // 12pt Times New Roman.
    const paragraphStyle =
      "margin:0;mso-line-spacing:'Multiple 2';line-height:200%;mso-line-height-rule:exactly;mso-pagination:widow-orphan;text-indent:-36.0pt;margin-left:36.0pt;font-family:\"Times New Roman\",serif;font-size:12.0pt;font-weight:normal;font-style:normal;";
    const annotationStyle =
      "margin:0 0 12.0pt 0;text-indent:0;margin-left:36.0pt;line-height:200%;mso-line-height-rule:exactly;font-family:\"Times New Roman\",serif;font-size:12.0pt;font-weight:normal;font-style:normal;";
    const items = sortedRefs
      .map((r) => {
        const ref = `<p class=MsoNormal style='${paragraphStyle}'>${sanitizeFormatted(r.formatted ?? "")}</p>`;
        if (annotatedMode && r.annotation && r.annotation.trim()) {
          const ann = `<p class=MsoNormal style='${annotationStyle}'>${escapeHtml(r.annotation.trim())}</p>`;
          return ref + ann;
        }
        return ref;
      })
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>References</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotPromoteQF/></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1 { size:21.0cm 29.7cm; margin:2.54cm 2.54cm 2.54cm 2.54cm; mso-paper-source:0; }
div.WordSection1 { page:WordSection1; }
body { font-family: "Times New Roman", serif; font-size: 12pt; }
h1 { font-family: "Times New Roman", serif; font-size: 12pt; font-weight: bold; text-align: center; line-height: 200%; margin: 0 0 12pt 0; }
p.MsoNormal {
  mso-style-name:"Normal";
  margin: 0;
  margin-left: 36.0pt;
  text-indent: -36.0pt;
  line-height: 200%;
  mso-line-height-rule: exactly;
  font-family: "Times New Roman", serif;
  font-size: 12.0pt;
  font-weight: normal;
  font-style: normal;
}
i { font-style: italic; font-weight: normal; }
</style>
</head>
<body><div class=WordSection1>
<h1>References</h1>
${items}
</div></body>
</html>`;
    const blob = new Blob(["ï»¿", html], {
      type: "application/msword",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "references.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const count = sortedRefs.length;
    toast.success(
      `Downloaded references.doc with ${count} reference${count === 1 ? "" : "s"}`
    );
  };

  const [refreshingFormatting, setRefreshingFormatting] = useState(false);
  // Cancellation flag for the refresh loop below — set on unmount so the
  // loop stops issuing mutations and state updates after navigation.
  const refreshCancelledRef = useRef(false);
  useEffect(() => {
    refreshCancelledRef.current = false;
    return () => {
      refreshCancelledRef.current = true;
    };
  }, []);
  const refreshAllFormatting = async () => {
    if (sortedRefs.length === 0) return;
    setRefreshingFormatting(true);
    let updated = 0;
    let failed = 0;
    for (const r of sortedRefs) {
      if (refreshCancelledRef.current) return;
      try {
        const built = buildSourceFields(
          r.sourceType as SourceType,
          applyFieldsToForm(emptyForm(), (r.fields ?? {}) as Record<string, unknown>)
        );
        if (!built) {
          failed++;
          continue;
        }
        const formatted = formatReference(built);
        await updateRef({
          id: r._id,
          formatted: formatted.formattedHtml,
          inTextShort: formatted.inTextShort,
          inTextNarrative: formatted.inTextNarrative,
          sortKey: formatted.sortKey,
        });
        updated++;
      } catch {
        failed++;
      }
    }
    if (refreshCancelledRef.current) return;
    setRefreshingFormatting(false);
    if (failed === 0) {
      toast.success(`Refreshed formatting on ${updated} reference${updated === 1 ? "" : "s"}`);
    } else {
      toast.success(
        `Refreshed ${updated} reference${updated === 1 ? "" : "s"}; ${failed} could not be re-formatted (probably missing required fields — Edit them manually).`
      );
    }
  };

  const runStyleCheck = () => {
    const all: StyleFlag[] = [];
    for (const r of sortedRefs) {
      const text = stripHtmlTags(r.formatted ?? "");
      const flags = checkNzStyle(text);
      all.push(...flags);
    }
    setStyleFlags(all);
  };

  const buildBulkHtml = (): string => {
    // APA 7: double line spacing within AND between entries; 0.5 inch
    // (36pt / 1.27 cm) hanging indent on second+ lines; 12pt Times New Roman.
    const paragraphStyle =
      "mso-style-name:\"Normal\";margin:0;margin-left:36.0pt;text-indent:-36.0pt;line-height:200%;mso-line-height-rule:exactly;mso-pagination:widow-orphan;font-family:\"Times New Roman\",serif;font-size:12.0pt;font-weight:normal;font-style:normal;color:black;";
    const annotationStyle =
      "mso-style-name:\"Normal\";margin:0 0 12.0pt 0;margin-left:36.0pt;text-indent:0;line-height:200%;mso-line-height-rule:exactly;font-family:\"Times New Roman\",serif;font-size:12.0pt;font-weight:normal;font-style:normal;color:black;";
    const items = sortedRefs
      .map((r) => {
        const ref = `<p class=MsoNormal style='${paragraphStyle}'><span style='font-weight:normal;font-style:normal;'>${sanitizeFormatted(r.formatted ?? "")}</span></p>`;
        if (annotatedMode && r.annotation && r.annotation.trim()) {
          const ann = `<p class=MsoNormal style='${annotationStyle}'>${escapeHtml(r.annotation.trim())}</p>`;
          return ref + ann;
        }
        return ref;
      })
      .join("");
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<style>
p.MsoNormal {
  mso-style-name:"Normal";
  margin:0;
  margin-left:36.0pt;
  text-indent:-36.0pt;
  line-height:200%;
  mso-line-height-rule:exactly;
  font-family:"Times New Roman", serif;
  font-size:12.0pt;
  font-weight:normal;
  font-style:normal;
}
i { font-style:italic; font-weight:normal; }
</style>
</head>
<body>${items}</body>
</html>`;
  };

  const buildBulkPlain = (): string => {
    return sortedRefs
      .map((r) => {
        const ref = stripHtmlTags(r.formatted ?? "");
        if (annotatedMode && r.annotation && r.annotation.trim()) {
          return `${ref}\n${r.annotation.trim()}`;
        }
        return ref;
      })
      .join("\n\n");
  };

  const copyRich = async () => {
    if (sortedRefs.length === 0) return;
    const html = buildBulkHtml();
    const plain = buildBulkPlain();
    const count = sortedRefs.length;
    const successMessage = `Copied ${count} reference${count === 1 ? "" : "s"} — paste straight into Word`;
    if (
      typeof window !== "undefined" &&
      "ClipboardItem" in window &&
      navigator.clipboard?.write
    ) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        toast.success(successMessage);
        return;
      } catch {
        // fall through to plain
      }
    }
    try {
      await navigator.clipboard.writeText(plain);
      toast.success(successMessage);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };


  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="References"
        title="APA 7 reference list"
        description="Build, edit and export properly formatted references — copy them straight into Word."
      />

      {showOnboarding && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                Quick start
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>Make a list for each assignment in the sidebar (e.g. <em>PSYC101 — Essay 2</em>).</li>
                <li>Paste a URL or DOI into the lookup field — the form auto-fills.</li>
                <li>Open <em>Notes</em> on any reference to jot quotes / page numbers as you read.</li>
                <li>When you&apos;re done, hit <em>Copy for Word</em> or <em>Download .docx</em> — italics + hanging indent included.</li>
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

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar with all assignments. */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Lists
            </p>
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssignment(false);
                    setSelectedAssignment("all");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedAssignment === "all"
                      ? "relative bg-gradient-to-r from-sky-50 via-sky-100/70 to-transparent text-sky-900 ring-1 ring-inset ring-sky-200/60 before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r before:bg-sky-500 dark:from-sky-900/40 dark:via-sky-900/20 dark:to-transparent dark:text-sky-200 dark:ring-sky-700/40 dark:before:bg-sky-400"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate font-medium">All references</span>
                  <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {assignmentCounts.all}
                  </span>
                </button>
              </li>
              {assignments?.map((a) => {
                const isActive = selectedAssignment === a._id;
                const label = a.courseCode ? `${a.courseCode} — ${a.name}` : a.name;
                return (
                  <li key={a._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssignment(false);
                        setSelectedAssignment(a._id);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "relative bg-gradient-to-r from-sky-50 via-sky-100/70 to-transparent text-sky-900 ring-1 ring-inset ring-sky-200/60 before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r before:bg-sky-500 dark:from-sky-900/40 dark:via-sky-900/20 dark:to-transparent dark:text-sky-200 dark:ring-sky-700/40 dark:before:bg-sky-400"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate font-medium">{label}</span>
                      <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {assignmentCounts[a._id] ?? 0}
                      </span>
                    </button>
                    {isActive && !editingAssignment && (
                      <div className="mt-1 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRenameValue(a.name);
                            setEditingAssignment(true);
                          }}
                          className="text-xs text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
                        >
                          Edit list
                        </button>
                      </div>
                    )}
                    {isActive && editingAssignment && (
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="New name"
                          className={`${inputStyle} text-sm mt-0`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleRenameAssignment();
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleRenameAssignment()}
                            className={`${buttonPrimary} px-3 py-1 text-xs`}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAssignment(false)}
                            className={`${buttonSecondary} px-3 py-1 text-xs`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAssignment()}
                            className="ml-auto rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <input
                type="text"
                placeholder="New list name"
                value={newAssignmentName}
                onChange={(e) => setNewAssignmentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleNewAssignment();
                  }
                }}
                className={`${inputStyle} text-sm mt-0`}
              />
              <button
                type="button"
                onClick={() => void handleNewAssignment()}
                disabled={!newAssignmentName.trim()}
                className={`${buttonSecondary} mt-2 w-full justify-center`}
              >
                + New list
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <details>
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 hover:text-sky-300">
            Reverse-lookup citations from a draft paragraph
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste a paragraph or page of your draft. We&apos;ll extract every (Author, Year) and look up candidate references on OpenAlex.
            </p>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={6}
              placeholder={`e.g.\nPiaget's stage theory has been challenged in recent reviews (Bebane, 2021), with Grigoryevich (2025) arguing that constructivism… Recent meta-analyses also suggest (Smith & Jones, 2022; Lee et al., 2023) that…`}
              className={`${inputStyle} text-sm`}
              disabled={reverseLookupRunning}
            />
            <button
              type="button"
              onClick={() => void handleFindCitations()}
              disabled={reverseLookupRunning || !draftText.trim()}
              className={buttonPrimary}
            >
              {reverseLookupRunning ? "Finding citations…" : "Find citations"}
            </button>

            {reverseRows && reverseRows.length > 0 && (
              <div className="mt-4 space-y-3">
                {reverseRows.map((row, rowIdx) => (
                  <div
                    key={`${row.citation.surname}-${row.citation.year}-${rowIdx}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        {row.citation.raw}
                      </code>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({row.candidates.length} candidate{row.candidates.length === 1 ? "" : "s"})
                      </span>
                    </div>
                    {row.candidates.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        No matches on OpenAlex. Try the manual form or a different search term.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {row.candidates.map((c, ci) => {
                          const picked = revSelections[rowIdx] === ci;
                          const authorList = c.authorsRaw
                            .slice(0, 3)
                            .map((a) => a.surname)
                            .join(", ");
                          const more = c.authorsRaw.length > 3 ? " et al." : "";
                          const viewUrl = c.doi
                            ? `https://doi.org/${c.doi}`
                            : c.url;
                          return (
                              <li key={ci}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    setRevSelections((s) =>
                                      s[rowIdx] === ci
                                        ? Object.fromEntries(
                                            Object.entries(s).filter(([k]) => k !== String(rowIdx))
                                          )
                                        : { ...s, [rowIdx]: ci }
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setRevSelections((s) =>
                                        s[rowIdx] === ci
                                          ? Object.fromEntries(
                                              Object.entries(s).filter(([k]) => k !== String(rowIdx))
                                            )
                                          : { ...s, [rowIdx]: ci }
                                      );
                                    }
                                  }}
                                  className={`group block w-full cursor-pointer rounded-lg border p-2 text-left text-xs transition-colors ${
                                    picked
                                      ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-900/30"
                                      : "border-slate-200 bg-white hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
                                  }`}
                                >
                                  <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {c.title}
                                  </p>
                                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                                    {authorList}{more}
                                    {c.year ? ` · ${c.year}` : ""}
                                    {c.journal ? ` · ${c.journal}` : ""}
                                    {c.citedByCount && c.citedByCount > 0
                                      ? ` · cited ${c.citedByCount}×`
                                      : ""}
                                  </p>
                                  {c.abstract && (
                                    <p className="mt-1 line-clamp-2 text-slate-500 dark:text-slate-400">
                                      {c.abstract}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {viewUrl && (
                                      <a
                                        href={viewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                                      >
                                        <span>↗</span>
                                        <span>View</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleAddSingleCandidate(c);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-sky-500 active:bg-sky-700"
                                    >
                                      + Add now
                                    </button>
                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                      {picked ? "Picked for batch" : "Click row to pick"}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleImportReverseSelections()}
                    disabled={revImporting || Object.keys(revSelections).length === 0}
                    className={buttonPrimary}
                  >
                    {revImporting
                      ? "Importing…"
                      : `Import ${Object.keys(revSelections).length} selected`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReverseRows(null);
                      setRevSelections({});
                    }}
                    className={buttonSecondary}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </details>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <details>
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 hover:text-sky-300">
            Bulk import — paste a list of DOIs or URLs
          </summary>
          <div className="mt-3 space-y-3">
            <textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              rows={5}
              placeholder={`One DOI or URL per line, e.g.:\n10.1000/xyz123\nhttps://doi.org/10.1234/abcd\nhttps://openstax.org/books/...`}
              className={`${inputStyle} font-mono text-xs`}
              disabled={bulkImportRunning}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleBulkImport()}
                disabled={bulkImportRunning || !bulkImportText.trim()}
                className={buttonPrimary}
              >
                {bulkImportRunning
                  ? `Importing ${bulkProgress.done}/${bulkProgress.total}…`
                  : "Look up and import all"}
              </button>
              {bulkImportRunning && bulkProgress.failed > 0 && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  {bulkProgress.failed} failed so far
                </span>
              )}
            </div>
          </div>
        </details>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          {editingId ? "Edit reference" : "Add a reference"}
        </h2>

        {/* URL is the primary lookup — full width, large input. */}
        <div className="mt-3">
          <span className={labelStyle}>Paste a URL</span>
          <div className="mt-1 flex gap-2">
            <input
              ref={urlInputRef}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://doi.org/10.1234/abcd  •  https://openstax.org/...  •  any article URL"
              className={`${inputStyle} text-base`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleLookup("url");
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleLookup("url")}
              disabled={lookupBusy !== null || !urlInput.trim()}
              className={buttonPrimary}
            >
              {lookupBusy === "url" ? "Looking up…" : "Look up"}
            </button>
          </div>
          {/* No DOI or URL? Upload the PDF and let the AI read the details. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              No link or DOI — just the PDF?
            </span>
            <input
              ref={pdfFileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePdfLookup(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => pdfFileRef.current?.click()}
              disabled={pdfBusy || lookupBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500"
            >
              <span aria-hidden>📄</span>
              {pdfBusy ? "Reading PDF…" : "Upload a PDF and extract the details"}
            </button>
          </div>
        </div>

        {/* DOI + ISSN are secondary lookups, side by side. */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["doi", "issn"] as const).map((kind) => {
            const label = kind === "doi" ? "DOI" : "ISSN";
            const placeholder = kind === "doi" ? "10.1000/xyz123" : "0028-0836";
            const value = kind === "doi" ? doiInput : issnInput;
            const setValue = kind === "doi" ? setDoiInput : setIssnInput;
            return (
              <div key={kind}>
                <span className={labelStyle}>{label}</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className={inputStyle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleLookup(kind);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleLookup(kind)}
                    disabled={lookupBusy !== null || !value.trim()}
                    className={buttonSecondary}
                  >
                    {lookupBusy === kind ? "…" : "Go"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ISBN — rarely used, tucked into a collapsible. */}
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            More: look up by ISBN
          </summary>
          <div className="mt-2 max-w-md">
            <div className="flex gap-2">
              <input
                value={isbnInput}
                onChange={(e) => setIsbnInput(e.target.value)}
                placeholder="9780000000000"
                className={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleLookup("isbn");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleLookup("isbn")}
                disabled={lookupBusy !== null || !isbnInput.trim()}
                className={buttonSecondary}
              >
                {lookupBusy === "isbn" ? "…" : "Go"}
              </button>
            </div>
          </div>
        </details>
        {lookupError && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{lookupError}</p>
        )}

        {lookupInfo && (lookupInfo.warnings.length > 0 || lookupInfo.sourcesQueried.length > 0) && (
          <div className="mt-3 space-y-2">
            {lookupInfo.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">Sources disagreed on some fields — please double-check before saving:</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {lookupInfo.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {lookupInfo.aiReasoning && (
                  <p className="mt-2 border-t border-amber-300 pt-2 italic text-amber-700/90 dark:border-amber-700/30 dark:text-amber-300/80">
                    AI (DeepSeek) reviewed the page and chose: {lookupInfo.aiReasoning}
                  </p>
                )}
              </div>
            )}
            {lookupInfo.sourcesQueried.length > 0 && (
              <p className="text-xs text-slate-500">
                Queried: {lookupInfo.sourcesQueried.join(", ")}
                {Object.keys(lookupInfo.fieldSources).length > 0 && (
                  <>
                    {" · "}
                    <details className="inline">
                      <summary className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200">
                        per-field sources
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-500 dark:text-slate-400">
                        {Object.entries(lookupInfo.fieldSources).map(([field, source]) => (
                          <li key={field}>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{field}</span>: {source}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_TYPES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                setSourceType(s);
                setFormError(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs ${
                sourceType === s
                  ? "bg-sky-600 text-white"
                  : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {sourceType === "aiTool" ? (
            <div>
              <span className={labelStyle}>Maker / company</span>
              <input
                value={form.maker}
                onChange={(e) => update("maker", e.target.value)}
                placeholder="e.g. OpenAI"
                className={inputStyle}
              />
            </div>
          ) : sourceType === "editedBook" ? (
            <AuthorsEditor
              label="Editors"
              value={form.editors}
              onChange={(v) => update("editors", v)}
            />
          ) : (
            <AuthorsEditor
              label={
                sourceType === "report"
                  ? "Author or organisation"
                  : sourceType === "onlineVideo"
                    ? "Uploader / channel"
                    : "Authors"
              }
              value={form.authors}
              onChange={(v) => update("authors", v)}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelStyle}>Year</span>
              <input
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                placeholder="2024 (or n.d.)"
                className={inputStyle}
              />
            </div>
            {(sourceType === "website" ||
              sourceType === "newsArticle" ||
              sourceType === "onlineVideo") && (
              <div>
                <span className={labelStyle}>Month and day (optional)</span>
                <input
                  value={form.monthDay}
                  onChange={(e) => update("monthDay", e.target.value)}
                  placeholder="June 30"
                  className={inputStyle}
                />
              </div>
            )}
          </div>

          {sourceType !== "bookChapter" && sourceType !== "aiTool" && (
            <div>
              <span className={labelStyle}>Title</span>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={
                  sourceType === "journalArticle"
                    ? "Article title"
                    : sourceType === "newsArticle"
                      ? "News headline"
                      : sourceType === "website"
                        ? "Page title"
                        : sourceType === "report"
                          ? "Report title"
                          : sourceType === "onlineVideo"
                            ? "Video title"
                            : sourceType === "editedBook"
                              ? "Book title"
                              : "Book title"
                }
                className={inputStyle}
              />
            </div>
          )}

          {sourceType === "book" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Edition (optional)</span>
                <input
                  value={form.edition}
                  onChange={(e) => update("edition", e.target.value)}
                  placeholder="2nd ed."
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Publisher</span>
                <input
                  value={form.publisher}
                  onChange={(e) => update("publisher", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelStyle}>DOI (optional)</span>
                <input
                  value={form.doi}
                  onChange={(e) => update("doi", e.target.value)}
                  placeholder="10.1000/xyz123"
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "bookChapter" && (
            <>
              <div>
                <span className={labelStyle}>Chapter title</span>
                <input
                  value={form.chapterTitle}
                  onChange={(e) => update("chapterTitle", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <AuthorsEditor
                label="Editors"
                value={form.editors}
                onChange={(v) => update("editors", v)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className={labelStyle}>Book title</span>
                  <input
                    value={form.bookTitle}
                    onChange={(e) => update("bookTitle", e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <span className={labelStyle}>Page start</span>
                  <input
                    value={form.pageStart}
                    onChange={(e) => update("pageStart", e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <span className={labelStyle}>Page end</span>
                  <input
                    value={form.pageEnd}
                    onChange={(e) => update("pageEnd", e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <span className={labelStyle}>Edition (optional)</span>
                  <input
                    value={form.edition}
                    onChange={(e) => update("edition", e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <span className={labelStyle}>Publisher</span>
                  <input
                    value={form.publisher}
                    onChange={(e) => update("publisher", e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>
            </>
          )}

          {sourceType === "journalArticle" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={labelStyle}>Journal name</span>
                <input
                  value={form.journal}
                  onChange={(e) => update("journal", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Volume</span>
                <input
                  value={form.volume}
                  onChange={(e) => update("volume", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Issue (optional)</span>
                <input
                  value={form.issue}
                  onChange={(e) => update("issue", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Page start</span>
                <input
                  value={form.pageStart}
                  onChange={(e) => update("pageStart", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Page end</span>
                <input
                  value={form.pageEnd}
                  onChange={(e) => update("pageEnd", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>DOI (preferred)</span>
                <input
                  value={form.doi}
                  onChange={(e) => update("doi", e.target.value)}
                  placeholder="10.1000/xyz123"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>URL (if no DOI)</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "website" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Site name (optional)</span>
                <input
                  value={form.siteName}
                  onChange={(e) => update("siteName", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>URL</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelStyle}>
                  Retrieved date (only if content updates)
                </span>
                <input
                  value={form.retrievedDate}
                  onChange={(e) => update("retrievedDate", e.target.value)}
                  placeholder="May 7, 2026"
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "newsArticle" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>News source</span>
                <input
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                  placeholder="The New Zealand Herald"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>URL (optional)</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "report" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Report number (optional)</span>
                <input
                  value={form.reportNumber}
                  onChange={(e) => update("reportNumber", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Publisher (if different)</span>
                <input
                  value={form.publisher}
                  onChange={(e) => update("publisher", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelStyle}>URL (optional)</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "editedBook" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Edition (optional)</span>
                <input
                  value={form.edition}
                  onChange={(e) => update("edition", e.target.value)}
                  placeholder="2nd ed."
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Publisher</span>
                <input
                  value={form.publisher}
                  onChange={(e) => update("publisher", e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelStyle}>DOI (optional)</span>
                <input
                  value={form.doi}
                  onChange={(e) => update("doi", e.target.value)}
                  placeholder="10.1000/xyz123"
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "onlineVideo" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Platform</span>
                <input
                  value={form.platform}
                  onChange={(e) => update("platform", e.target.value)}
                  placeholder="YouTube, Vimeo, TikTok…"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>URL</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {sourceType === "aiTool" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelStyle}>Tool name</span>
                <input
                  value={form.toolName}
                  onChange={(e) => update("toolName", e.target.value)}
                  placeholder="ChatGPT"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Version (optional)</span>
                <input
                  value={form.version}
                  onChange={(e) => update("version", e.target.value)}
                  placeholder="GPT-5, Mar 14 version, etc."
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>Description (in brackets)</span>
                <input
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Large language model"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className={labelStyle}>URL</span>
                <input
                  value={form.url}
                  onChange={(e) => update("url", e.target.value)}
                  placeholder="https://chat.openai.com/chat"
                  className={inputStyle}
                />
              </div>
            </div>
          )}

          {formError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className={buttonPrimary}>
              {submitting
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add to list"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className={buttonSecondary}
              >
                Cancel edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setForm(emptyForm())}
                className={buttonSecondary}
              >
                Reset form
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        {/* Sticky toolbar — search + count + actions stay reachable on scroll. */}
        <div className="sticky top-0 -mx-5 -mt-5 mb-4 rounded-t-2xl border-b border-slate-200 bg-white/90 px-3 sm:px-5 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              References ({sortedRefs.length}
              {filterText ? ` of ${refs?.length ?? 0}` : ""})
            </h2>
            <div className="relative basis-full sm:basis-auto sm:ml-auto sm:flex-1 sm:max-w-md order-3 sm:order-none">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search author, title, year, notes…  ( / )"
                className={`${inputStyle} pl-9 mt-0`}
              />
            </div>
            <label className="hidden sm:flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={annotatedMode}
                onChange={(e) => setAnnotatedMode(e.target.checked)}
                className="rounded border-slate-600 bg-white dark:bg-slate-950"
              />
              Annotated mode
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectMode((m) => !m);
                if (selectMode) setSelectedRefIds(new Set());
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectMode
                  ? "border-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
              }`}
              title="Toggle select mode (s) — pick refs and quick-cite them as a group"
            >
              {selectMode ? "✕ Exit select" : "Multi-cite"}
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Tags:</span>
              {allTags.map((tag) => {
                const active = activeTagFilters.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTagFilter(tag)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      active
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
              {activeTagFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTagFilters(new Set())}
                  className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  clear filters
                </button>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={copyRich}
              disabled={sortedRefs.length === 0}
              className={buttonPrimary}
              title="Copies the full reference list with italics + hanging indent. Paste straight into Word."
            >
              Copy for Word
            </button>
            <button
              onClick={downloadDocx}
              disabled={sortedRefs.length === 0}
              className={buttonSecondary}
            >
              Download .docx
            </button>
            <button
              onClick={runStyleCheck}
              disabled={sortedRefs.length === 0}
              className={`${buttonSecondary} hidden sm:inline-flex`}
            >
              Check NZ English
            </button>
            <button
              onClick={refreshAllFormatting}
              disabled={sortedRefs.length === 0 || refreshingFormatting}
              className={`${buttonSecondary} hidden sm:inline-flex`}
              title="Re-runs the APA formatter on every reference. Use after the formatter has been updated."
            >
              {refreshingFormatting ? "Refreshing…" : "Refresh formatting"}
            </button>
          </div>
        </div>

        {styleFlags !== null && (
          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Style check ({styleFlags.length}{" "}
                {styleFlags.length === 1 ? "issue" : "issues"})
              </h3>
              <button
                type="button"
                onClick={() => setStyleFlags(null)}
                className={buttonGhost}
              >
                Close
              </button>
            </div>
            {styleFlags.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                No US spellings or Oxford commas found.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {styleFlags.map((f, i) => (
                  <li key={i} className="text-slate-700 dark:text-slate-300">
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                      {f.kind === "us-spelling" ? "US spelling" : "Oxford comma"}
                    </span>{" "}
                    <code className="text-slate-900 dark:text-slate-100">{f.match}</code> →{" "}
                    <span className="text-emerald-700 dark:text-emerald-300">{f.suggestion}</span>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {f.snippet}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {refs === undefined ? (
          /* Loading skeletons while the references query is in flight. */
          <ul className="space-y-3" aria-label="Loading references">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="h-3 w-11/12 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-3 w-9/12 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-3 w-7/12 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 flex gap-2">
                  <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </li>
            ))}
          </ul>
        ) : sortedRefs.length === 0 ? (
          filterText ? (
            <EmptyState
              icon="📚"
              title="Nothing matches your search"
              body="Try a different keyword or clear the search to see your full list."
              variant="default"
            />
          ) : (
            <EmptyState
              icon="📚"
              title="No references in this assignment yet"
              body="Build your reference list by pasting a DOI, ISBN or article URL above. Or use the Source Finder to search 250 million peer-reviewed papers."
              cta={{ label: "Open Source Finder", href: "/uni/sources" }}
              variant="default"
            />
          )
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
            {sortedRefs.map((r) => (
              <motion.li
                key={r._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`rounded-xl border bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-sm transition-all dark:from-slate-950 dark:to-slate-950 dark:shadow-none ${
                  selectMode && selectedRefIds.has(r._id)
                    ? "border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-500"
                    : "border-slate-200 hover:-translate-y-px hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:hover:border-sky-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selectedRefIds.has(r._id)}
                      onChange={() => toggleSelectRef(r._id)}
                      aria-label="Select for multi-cite"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-400 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                    />
                  )}
                  <p
                    className="flex-1 text-sm text-slate-900 dark:text-slate-100"
                    style={{
                      textIndent: "-1.27cm",
                      marginLeft: "1.27cm",
                      lineHeight: 2,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeFormatted(r.formatted ?? ""),
                    }}
                  />
                </div>

                {/* Tags row */}
                {((r.tags && r.tags.length > 0) || tagDrafts[r._id] !== undefined) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[1.27cm]">
                    {(r.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => void removeTagFromReference(r._id, r.tags, tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {tagDrafts[r._id] !== undefined ? (
                      <input
                        type="text"
                        value={tagDrafts[r._id]}
                        autoFocus
                        onChange={(e) =>
                          setTagDrafts((s) => ({ ...s, [r._id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addTagToReference(r._id, r.tags, tagDrafts[r._id]);
                            setTagDrafts((s) => {
                              const next = { ...s };
                              delete next[r._id];
                              return next;
                            });
                          } else if (e.key === "Escape") {
                            setTagDrafts((s) => {
                              const next = { ...s };
                              delete next[r._id];
                              return next;
                            });
                          }
                        }}
                        onBlur={() => {
                          if (tagDrafts[r._id]?.trim()) {
                            void addTagToReference(r._id, r.tags, tagDrafts[r._id]);
                          }
                          setTagDrafts((s) => {
                            const next = { ...s };
                            delete next[r._id];
                            return next;
                          });
                        }}
                        placeholder="tag…"
                        className="w-24 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTagDrafts((s) => ({ ...s, [r._id]: "" }))}
                        className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-300"
                      >
                        + tag
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    In-text:{" "}
                    <CopyChip
                      text={r.inTextShort ?? ""}
                      label="in-text citation"
                    />
                  </span>
                  <span className="flex items-center gap-1.5">
                    Narrative:{" "}
                    <CopyChip
                      text={r.inTextNarrative ?? ""}
                      label="narrative citation"
                    />
                  </span>
                  {(!r.tags || r.tags.length === 0) && tagDrafts[r._id] === undefined && (
                    <button
                      type="button"
                      onClick={() => setTagDrafts((s) => ({ ...s, [r._id]: "" }))}
                      className="ml-auto text-xs text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
                      title="Add a tag to this reference"
                    >
                      + Tag
                    </button>
                  )}
                  <button
                    onClick={() => toggleNotes(r._id, r.notes)}
                    className={`text-xs text-slate-700 dark:text-slate-300 hover:text-sky-300 ${
                      (!r.tags || r.tags.length === 0) && tagDrafts[r._id] === undefined
                        ? ""
                        : "ml-auto"
                    }`}
                    title="Add or view notes / quotes / annotation for this reference"
                  >
                    {openNotes[r._id]
                      ? "Hide notes"
                      : (r.notes && r.notes.trim()) || (r.annotation && r.annotation.trim())
                        ? "Notes ●"
                        : "+ Notes"}
                  </button>
                  <button
                    onClick={() =>
                      startEdit({
                        _id: r._id,
                        sourceType: r.sourceType,
                        fields: r.fields,
                        assignmentId: r.assignmentId,
                      })
                    }
                    className="text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      toast("Delete this reference?", {
                        description: "This can't be undone.",
                        duration: 8000,
                        action: {
                          label: "Delete",
                          onClick: async () => {
                            try {
                              await deleteRef({ id: r._id });
                              toast.success("Reference deleted");
                            } catch (err) {
                              toast.error(
                                getErrorMessage(err, "Could not delete reference")
                              );
                            }
                          },
                        },
                        cancel: { label: "Cancel", onClick: () => {} },
                      });
                    }}
                    className="text-xs text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>

                {annotatedMode && (r.annotation?.trim() || openNotes[r._id]) && (
                  <p
                    className="mt-2 text-sm italic text-slate-700 dark:text-slate-300"
                    style={{ marginLeft: "1.27cm", lineHeight: 1.7 }}
                  >
                    {r.annotation?.trim() || (
                      <span className="text-slate-500">
                        (No annotation yet — open notes to add one)
                      </span>
                    )}
                  </p>
                )}

                {openNotes[r._id] && (
                  <div className="mt-3 space-y-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3">
                    <div>
                      <span className={labelStyle}>Quick notes (private — not exported)</span>
                      <textarea
                        rows={3}
                        value={notesDraft[r._id] ?? r.notes ?? ""}
                        onChange={(e) =>
                          setNotesDraft((s) => ({
                            ...s,
                            [r._id]: e.target.value,
                          }))
                        }
                        onBlur={() => void autoSaveNotes(r._id, r.notes, r.annotation)}
                        placeholder="Quotes, page numbers, ideas to use…"
                        className={`${inputStyle} text-sm`}
                      />
                    </div>
                    <div>
                      <span className={labelStyle}>
                        Annotation (50“150 words, exported in annotated bibliography mode)
                      </span>
                      <textarea
                        rows={4}
                        value={annotationDraft[r._id] ?? r.annotation ?? ""}
                        onChange={(e) =>
                          setAnnotationDraft((s) => ({
                            ...s,
                            [r._id]: e.target.value,
                          }))
                        }
                        onBlur={() => void autoSaveNotes(r._id, r.notes, r.annotation)}
                        placeholder="Brief summary + relevance to your assignment…"
                        className={`${inputStyle} text-sm`}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {savedFlash[r._id] ? (
                          <span className="text-emerald-600 dark:text-emerald-400">✓ Saved</span>
                        ) : (
                          "Saves automatically when you click out of the box"
                        )}
                      </span>
                      <button
                        onClick={() =>
                          setOpenNotes((s) => ({ ...s, [r._id]: false }))
                        }
                        className={buttonSecondary}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Source Lens area. Three states:
                    A) Reference has a saved analysis → small toggle to
                       show/hide the saved panel. Re-run option too.
                    B) Reference has an abstract but no analysis → "Run
                       Source Lens" button.
                    C) Reference has neither → nothing rendered (no
                       way to analyse it). */}
                {(() => {
                  const savedAnalysis = (r as { lensAnalysis?: LensDeepResult })
                    .lensAnalysis;
                  const refFields = r.fields as { _abstract?: string } | undefined;
                  const abstract =
                    typeof refFields?._abstract === "string"
                      ? refFields._abstract
                      : "";
                  const canRun = abstract.length >= 50;
                  if (!savedAnalysis && !canRun) return null;
                  const isOpen = lensOpen[r._id] ?? false;
                  const isRunning = lensRunning[r._id] ?? false;
                  const error = lensErrors[r._id];
                  // Active assignment for re-running with context
                  const activeAss =
                    selectedAssignment !== "all"
                      ? assignments?.find((a) => a._id === selectedAssignment)
                      : undefined;
                  const runLens = async () => {
                    if (!canRun) return;
                    setLensRunning((s) => ({ ...s, [r._id]: true }));
                    setLensErrors((s) => ({ ...s, [r._id]: "" }));
                    try {
                      const fields = r.fields as {
                        title?: string;
                        authors?: { given?: string; surname?: string }[];
                        year?: string;
                        journal?: string;
                        doi?: string;
                      };
                      const authors = (fields.authors ?? [])
                        .map((a) => {
                          const s = a.surname ?? "";
                          const g = a.given ?? "";
                          return `${s}${g ? ", " + g : ""}`.trim();
                        })
                        .filter((x) => x.length > 0);
                      const yearNum =
                        fields.year && /^\d{4}$/.test(fields.year)
                          ? Number(fields.year)
                          : undefined;
                      const result = (await sourceLens({
                        sourceTitle: fields.title ?? "(untitled)",
                        sourceAuthors: authors,
                        sourceYear: yearNum,
                        sourceJournal: fields.journal,
                        sourceAbstract: abstract,
                        sourceDoi: fields.doi,
                        sourceType: r.sourceType,
                        assignmentBrief: activeAss?.brief ?? undefined,
                        assignmentRubric: activeAss?.rubric ?? undefined,
                        assignmentName: activeAss?.name ?? undefined,
                      })) as LensDeepResult;
                      // Persist the analysis on the reference so it
                      // survives page refresh + next session.
                      await updateRef({
                        id: r._id,
                        lensAnalysis: result,
                      });
                      setLensOpen((s) => ({ ...s, [r._id]: true }));
                      toast.success("Source Lens analysis saved");
                    } catch (err) {
                      setLensErrors((s) => ({
                        ...s,
                        [r._id]:
                          getErrorMessage(err, "Lens analysis failed"),
                      }));
                    } finally {
                      setLensRunning((s) => ({ ...s, [r._id]: false }));
                    }
                  };
                  return (
                    <div className="mt-3 pl-[1.27cm]">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {savedAnalysis ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLensOpen((s) => ({
                                ...s,
                                [r._id]: !(s[r._id] ?? false),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-violet-800 hover:border-violet-500 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:border-violet-500 dark:hover:bg-violet-900/40"
                            title="Show / hide saved Source Lens analysis"
                          >
                            🔍 {isOpen ? "Hide" : "Show"} Lens · {savedAnalysis.relevance.score}/10
                          </button>
                        ) : null}
                        {/* Read with highlights — only available when
                            the reference has a stored sourceText (i.e.
                            it was saved AFTER a Tier 2 Deep Read).
                            Opens the reader in a new tab. */}
                        {savedAnalysis &&
                          (r as { sourceText?: string }).sourceText &&
                          savedAnalysis.deepRead && (
                            <a
                              href={`/uni/sources/reader?refId=${encodeURIComponent(r._id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-500 dark:hover:bg-amber-900/40"
                              title="Open the paper with AI highlights overlaid (new tab)"
                            >
                              📖 Read with highlights
                            </a>
                          )}
                        {canRun && (
                          <button
                            type="button"
                            onClick={runLens}
                            disabled={isRunning}
                            className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-0.5 text-violet-800 hover:border-violet-500 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/30"
                            title={
                              savedAnalysis
                                ? "Re-run Lens against the currently active assignment"
                                : "Analyse this source against your active assignment"
                            }
                          >
                            {isRunning
                              ? "Analysing…"
                              : savedAnalysis
                                ? "Re-run Lens"
                                : "🔍 Run Source Lens"}
                          </button>
                        )}
                        {savedAnalysis && isOpen && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  lensResultToMarkdown(savedAnalysis),
                                );
                                toast.success("Copied analysis as markdown");
                              } catch {
                                toast.error("Couldn't copy");
                              }
                            }}
                            className="text-violet-600 hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200"
                          >
                            Copy analysis
                          </button>
                        )}
                      </div>
                      {(isOpen || isRunning || error) && (
                        <LensPanel
                          running={isRunning}
                          result={isOpen ? savedAnalysis : undefined}
                          error={error}
                          hasAssignmentContext={!!activeAss}
                        />
                      )}
                    </div>
                  );
                })()}
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
        </div>
      </div>

      {/* Floating quick-cite bar — appears in select mode with at least 1 ref. */}
      {selectMode && selectedRefIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {selectedRefIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => void copyMultiCite()}
            className={`${buttonPrimary} px-3 py-1.5 text-xs`}
          >
            Copy multi-cite
          </button>
          <button
            type="button"
            onClick={() => setSelectedRefIds(new Set())}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear
          </button>
        </div>
      )}
    </main>
  );
}
