"use client";

import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import PageHeader from "../PageHeader";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { formatReference } from "@/lib/apa7/format";
import {
  SOURCE_LABELS,
  type Author,
  type SourceFields,
  type SourceType,
} from "@/lib/apa7/types";

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
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/10 transition-all hover:-translate-y-px hover:bg-sky-500 hover:shadow-md hover:shadow-sky-900/20 active:translate-y-0 active:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";
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
        copied ? "ring-1 ring-emerald-500/60 text-emerald-200" : ""
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
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupInfo, setLookupInfo] = useState<{
    warnings: string[];
    fieldSources: Record<string, string>;
    sourcesQueried: string[];
    aiReasoning?: string;
  } | null>(null);

  // Style checker state
  const [styleFlags, setStyleFlags] = useState<StyleFlag[] | null>(null);

  const refs = useQuery(api.references.listForAssignment, {
    assignmentId:
      selectedAssignment === "all" ? undefined : selectedAssignment,
  });

  const [filterText, setFilterText] = useState("");
  const [annotatedMode, setAnnotatedMode] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; failed: number }>({
    done: 0,
    total: 0,
    failed: 0,
  });
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
    if (!q) return base;
    return base.filter((r) => {
      const haystack = [
        r.formatted ?? "",
        r.inTextShort ?? "",
        r.inTextNarrative ?? "",
        r.sortKey ?? "",
        r.notes ?? "",
        r.annotation ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .replace(/<\/?[a-z]+>/g, "");
      return haystack.includes(q);
    });
  }, [refs, filterText]);

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
        err instanceof Error ? err.message : "Could not rename list"
      );
    }
  };

  const handleDeleteAssignment = async () => {
    if (selectedAssignment === "all") return;
    const current = assignments?.find((a) => a._id === selectedAssignment);
    if (!current) return;
    const ok = window.confirm(
      `Delete the list "${current.name}"? Any references attached to it will become unassigned (they're not deleted).`
    );
    if (!ok) return;
    try {
      await removeAssignment({ id: selectedAssignment });
      toast.success(`Deleted list "${current.name}"`);
      setEditingAssignment(false);
      setSelectedAssignment("all");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete list"
      );
    }
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
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
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

  const saveNotes = async (id: Id<"references">, currentAnnotation?: string) => {
    try {
      await updateRef({
        id,
        notes: notesDraft[id] ?? "",
        annotation:
          annotationDraft[id] !== undefined
            ? annotationDraft[id]
            : currentAnnotation,
      });
      toast.success("Notes saved");
      setOpenNotes((s) => ({ ...s, [id]: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notes");
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
        err instanceof Error ? err.message : "Lookup failed. Please try again.",
      );
    } finally {
      setLookupBusy(null);
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
        const ref = `<p class=MsoNormal style='${paragraphStyle}'>${r.formatted ?? ""}</p>`;
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
    const blob = new Blob(["﻿", html], {
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
  const refreshAllFormatting = async () => {
    if (sortedRefs.length === 0) return;
    setRefreshingFormatting(true);
    let updated = 0;
    let failed = 0;
    for (const r of sortedRefs) {
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
        const ref = `<p class=MsoNormal style='${paragraphStyle}'><span style='font-weight:normal;font-style:normal;'>${r.formatted ?? ""}</span></p>`;
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="References"
        title="APA 7 reference list"
        description="Build, edit and export properly formatted references — copy them straight into Word."
      />

      <section className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Assignment
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={selectedAssignment}
            onChange={(e) => {
              setEditingAssignment(false);
              setSelectedAssignment(
                e.target.value === "all"
                  ? "all"
                  : (e.target.value as Id<"assignments">)
              );
            }}
            className={`${inputStyle} max-w-md`}
          >
            <option value="all">All references (no assignment filter)</option>
            {assignments?.map((a) => (
              <option key={a._id} value={a._id}>
                {a.courseCode ? `${a.courseCode} — ${a.name}` : a.name}
              </option>
            ))}
          </select>
          {selectedAssignment !== "all" && !editingAssignment && (
            <button
              type="button"
              onClick={() => {
                const current = assignments?.find(
                  (a) => a._id === selectedAssignment
                );
                setRenameValue(current?.name ?? "");
                setEditingAssignment(true);
              }}
              className={buttonGhost}
            >
              Edit list
            </button>
          )}
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="New assignment name"
              value={newAssignmentName}
              onChange={(e) => setNewAssignmentName(e.target.value)}
              className={inputStyle}
            />
            <button
              type="button"
              onClick={handleNewAssignment}
              className={buttonSecondary}
            >
              + Add
            </button>
          </div>
        </div>
        {editingAssignment && selectedAssignment !== "all" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="New name for this list"
              className={`${inputStyle} flex-1`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleRenameAssignment();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handleRenameAssignment()}
              className={buttonPrimary}
            >
              Save name
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteAssignment()}
              className="rounded-md border border-rose-700 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/40"
            >
              Delete list
            </button>
            <button
              type="button"
              onClick={() => setEditingAssignment(false)}
              className={buttonSecondary}
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
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
                <span className="text-xs text-amber-300">
                  {bulkProgress.failed} failed so far
                </span>
              )}
            </div>
          </div>
        </details>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          {editingId ? "Edit reference" : "Add a reference"}
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["doi", "isbn", "issn", "url"] as const).map((kind) => {
            const label =
              kind === "doi"
                ? "Look up by DOI"
                : kind === "isbn"
                  ? "Look up by ISBN"
                  : kind === "issn"
                    ? "Look up by ISSN"
                    : "Look up by URL";
            const placeholder =
              kind === "doi"
                ? "10.1000/xyz123"
                : kind === "isbn"
                  ? "9780000000000"
                  : kind === "issn"
                    ? "0028-0836"
                    : "https://…";
            const value =
              kind === "doi"
                ? doiInput
                : kind === "isbn"
                  ? isbnInput
                  : kind === "issn"
                    ? issnInput
                    : urlInput;
            const setValue =
              kind === "doi"
                ? setDoiInput
                : kind === "isbn"
                  ? setIsbnInput
                  : kind === "issn"
                    ? setIssnInput
                    : setUrlInput;
            return (
              <div key={kind}>
                <span className={labelStyle}>{label}</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => handleLookup(kind)}
                    disabled={lookupBusy !== null}
                    className={buttonSecondary}
                  >
                    {lookupBusy === kind ? "…" : "Go"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {lookupError && (
          <p className="mt-2 text-sm text-rose-400">{lookupError}</p>
        )}

        {lookupInfo && (lookupInfo.warnings.length > 0 || lookupInfo.sourcesQueried.length > 0) && (
          <div className="mt-3 space-y-2">
            {lookupInfo.warnings.length > 0 && (
              <div className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
                <p className="font-medium">Sources disagreed on some fields — please double-check before saving:</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {lookupInfo.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {lookupInfo.aiReasoning && (
                  <p className="mt-2 border-t border-amber-700/30 pt-2 italic text-amber-300/80">
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
            <p className="text-sm text-rose-400">{formError}</p>
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

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search this list (author, title, year, notes)…"
            className={`${inputStyle} max-w-md`}
          />
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={annotatedMode}
              onChange={(e) => setAnnotatedMode(e.target.checked)}
              className="rounded border-slate-600 bg-white dark:bg-slate-950"
            />
            Annotated bibliography mode
          </label>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            References ({sortedRefs.length}
            {filterText ? ` of ${refs?.length ?? 0}` : ""})
          </h2>
          <div className="flex flex-wrap gap-2">
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
              className={buttonSecondary}
            >
              Check NZ English
            </button>
            <button
              onClick={refreshAllFormatting}
              disabled={sortedRefs.length === 0 || refreshingFormatting}
              className={buttonSecondary}
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
              <p className="text-sm text-emerald-400">
                No US spellings or Oxford commas found.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {styleFlags.map((f, i) => (
                  <li key={i} className="text-slate-700 dark:text-slate-300">
                    <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-rose-300">
                      {f.kind === "us-spelling" ? "US spelling" : "Oxford comma"}
                    </span>{" "}
                    <code className="text-slate-900 dark:text-slate-100">{f.match}</code> →{" "}
                    <span className="text-emerald-300">{f.suggestion}</span>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {f.snippet}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {sortedRefs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">No references yet</p>
            <p className="mt-1">
              {filterText
                ? "Nothing matches your search. Clear the search box to see everything."
                : "Use the form above to add your first reference, or paste a list of DOIs / URLs into the bulk-import panel."}
            </p>
          </div>
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
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-700"
              >
                <p
                  className="text-sm text-slate-900 dark:text-slate-100"
                  style={{
                    textIndent: "-1.27cm",
                    marginLeft: "1.27cm",
                    lineHeight: 2,
                  }}
                  dangerouslySetInnerHTML={{ __html: r.formatted ?? "" }}
                />
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
                  <button
                    onClick={() => toggleNotes(r._id, r.notes)}
                    className="ml-auto text-xs text-slate-700 dark:text-slate-300 hover:text-sky-300"
                    title="Add or view notes / quotes / annotation for this reference"
                  >
                    {openNotes[r._id]
                      ? "Hide notes"
                      : (r.notes && r.notes.trim()) || (r.annotation && r.annotation.trim())
                        ? "Notes ●"
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
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRef({ id: r._id })}
                    className="text-xs text-rose-400 hover:text-rose-300"
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
                        placeholder="Quotes, page numbers, ideas to use…"
                        className={`${inputStyle} text-sm`}
                      />
                    </div>
                    <div>
                      <span className={labelStyle}>
                        Annotation (50–150 words, exported in annotated bibliography mode)
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
                        placeholder="Brief summary + relevance to your assignment…"
                        className={`${inputStyle} text-sm`}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setOpenNotes((s) => ({ ...s, [r._id]: false }))
                        }
                        className={buttonSecondary}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void saveNotes(r._id, r.annotation)}
                        className={buttonPrimary}
                      >
                        Save notes
                      </button>
                    </div>
                  </div>
                )}
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </main>
  );
}
