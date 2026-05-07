"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
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
  "journalArticle",
  "website",
  "newsArticle",
  "report",
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
});

const labelStyle = "block text-xs font-medium uppercase tracking-wide text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";
const buttonPrimary =
  "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60";
const buttonSecondary =
  "rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800";
const buttonGhost =
  "text-xs text-slate-400 hover:text-slate-200";

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
  return (
    <div>
      <span className={labelStyle}>{label}</span>
      <div className="mt-1 space-y-2">
        {value.map((a, idx) => (
          <div key={idx} className="flex items-center gap-2">
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
            {a.kind === "person" ? (
              <>
                <input
                  type="text"
                  placeholder="Surname"
                  value={a.surname}
                  onChange={(e) => {
                    const next = [...value];
                    next[idx] = { ...a, surname: e.target.value };
                    onChange(next);
                  }}
                  className={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Given names"
                  value={a.given}
                  onChange={(e) => {
                    const next = [...value];
                    next[idx] = { ...a, given: e.target.value };
                    onChange(next);
                  }}
                  className={inputStyle}
                />
              </>
            ) : (
              <input
                type="text"
                placeholder="Group / organisation name"
                value={a.name}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = { ...a, name: e.target.value };
                  onChange(next);
                }}
                className={inputStyle}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (value.length === 1) onChange([newAuthor()]);
                else onChange(value.filter((_, i) => i !== idx));
              }}
              className={buttonGhost}
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
  const { signOut } = useAuthActions();
  const assignments = useQuery(api.assignments.list);
  const createAssignment = useMutation(api.assignments.create);
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
  } | null>(null);

  // Style checker state
  const [styleFlags, setStyleFlags] = useState<StyleFlag[] | null>(null);

  const refs = useQuery(api.references.listForAssignment, {
    assignmentId:
      selectedAssignment === "all" ? undefined : selectedAssignment,
  });

  const sortedRefs = useMemo(() => {
    if (!refs) return [];
    return [...refs].sort((a, b) => {
      const ka = (a.sortKey ?? "").toLowerCase();
      const kb = (b.sortKey ?? "").toLowerCase();
      return ka.localeCompare(kb);
    });
  }, [refs]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

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
      };
      setLookupInfo({
        warnings: info.warnings ?? [],
        fieldSources: info.fieldSources ?? {},
        sourcesQueried: info.sourcesQueried ?? [],
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
    const items = sortedRefs
      .map(
        (r) =>
          `<p class=MsoNormal style='margin-bottom:.0001pt;text-indent:-36.0pt;margin-left:36.0pt;line-height:200%;font-family:"Times New Roman",serif;font-size:12.0pt;'>${r.formatted ?? ""}</p>`,
      )
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>References</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page { margin: 2.54cm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; }
h1 { font-family: "Times New Roman", serif; font-size: 12pt; font-weight: bold; text-align: center; }
p { margin: 0; }
</style>
</head>
<body>
<h1>References</h1>
${items}
</body>
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
    const items = sortedRefs
      .map(
        (r) =>
          `<p style="margin:0 0 0.5em 0;text-indent:-2em;padding-left:2em;line-height:2;font-family:'Times New Roman',serif;">${r.formatted ?? ""}</p>`
      )
      .join("");
    return `<div>${items}</div>`;
  };

  const buildBulkPlain = (): string => {
    return sortedRefs
      .map((r) =>
        (r.formatted ?? "")
          .replace(/<\/?i>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      )
      .join("\n\n");
  };

  const copyRich = async () => {
    if (sortedRefs.length === 0) return;
    const html = buildBulkHtml();
    const plain = buildBulkPlain();
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
        return;
      } catch {
        // fall through to plain
      }
    }
    await navigator.clipboard.writeText(plain);
  };

  const copyPlain = async () => {
    if (sortedRefs.length === 0) return;
    await navigator.clipboard.writeText(buildBulkPlain());
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-sky-400">References</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            APA 7 reference list
          </h1>
        </div>
        <button onClick={() => signOut()} className={buttonSecondary}>
          Sign out
        </button>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Assignment
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
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
                <p className="font-medium">Sources disagree on some fields — please double-check before saving:</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {lookupInfo.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {lookupInfo.sourcesQueried.length > 0 && (
              <p className="text-xs text-slate-500">
                Queried: {lookupInfo.sourcesQueried.join(", ")}
                {Object.keys(lookupInfo.fieldSources).length > 0 && (
                  <>
                    {" · "}
                    <details className="inline">
                      <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                        per-field sources
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-400">
                        {Object.entries(lookupInfo.fieldSources).map(([field, source]) => (
                          <li key={field}>
                            <span className="font-mono text-slate-300">{field}</span>: {source}
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
                  : "border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <AuthorsEditor
            label={sourceType === "report" ? "Author or organisation" : "Authors"}
            value={form.authors}
            onChange={(v) => update("authors", v)}
          />

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
            {(sourceType === "website" || sourceType === "newsArticle") && (
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

          {sourceType !== "bookChapter" && (
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

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            References ({sortedRefs.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyRich}
              disabled={sortedRefs.length === 0}
              className={buttonSecondary}
            >
              Copy all (rich)
            </button>
            <button
              onClick={copyPlain}
              disabled={sortedRefs.length === 0}
              className={buttonSecondary}
            >
              Copy all (plain)
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
          </div>
        </div>

        {styleFlags !== null && (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
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
                  <li key={i} className="text-slate-300">
                    <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-rose-300">
                      {f.kind === "us-spelling" ? "US spelling" : "Oxford comma"}
                    </span>{" "}
                    <code className="text-slate-100">{f.match}</code> →{" "}
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
          <p className="text-sm text-slate-400">
            No references yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-4">
            {sortedRefs.map((r) => (
              <li
                key={r._id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4"
              >
                <p
                  className="text-sm text-slate-100"
                  style={{
                    textIndent: "-2em",
                    paddingLeft: "2em",
                    lineHeight: 1.8,
                  }}
                  dangerouslySetInnerHTML={{ __html: r.formatted ?? "" }}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>
                    In-text:{" "}
                    <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">
                      {r.inTextShort}
                    </code>
                  </span>
                  <span>
                    Narrative:{" "}
                    <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">
                      {r.inTextNarrative}
                    </code>
                  </span>
                  <button
                    onClick={() =>
                      startEdit({
                        _id: r._id,
                        sourceType: r.sourceType,
                        fields: r.fields,
                        assignmentId: r.assignmentId,
                      })
                    }
                    className="ml-auto text-xs text-sky-400 hover:text-sky-300"
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
