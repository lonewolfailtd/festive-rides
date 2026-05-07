// APA 7 formatter — Open Polytechnic NZ house style.
// All output uses NZ English conventions in any prose Claude/the user writes;
// the APA formatting rules below follow APA 7's own punctuation
// (e.g. comma before "&" in author lists is APA style, not an Oxford comma).

import type {
  Author,
  BookChapterFields,
  BookFields,
  FormattedReference,
  JournalArticleFields,
  NewsArticleFields,
  ReportFields,
  SourceFields,
  WebsiteFields,
} from "./types";

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const i = (s: string) => `<i>${escapeHtml(s)}</i>`;
const t = (s: string) => escapeHtml(s);

const stripHtml = (s: string): string =>
  s
    .replace(/<\/?i>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const personRefName = (a: Extract<Author, { kind: "person" }>): string => {
  const initials = a.given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((sub) => (sub[0] ? sub[0].toUpperCase() + "." : ""))
        .join("-")
    )
    .join(" ");
  return `${a.surname}, ${initials}`.trim();
};

const authorRefName = (a: Author): string =>
  a.kind === "person" ? personRefName(a) : a.name;

const formatAuthorList = (authors: Author[]): string => {
  if (authors.length === 0) return "";
  const names = authors.map(authorRefName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) {
    const head = names.slice(0, -1).join(", ");
    const last = names[names.length - 1];
    return `${head}, & ${last}`;
  }
  const first19 = names.slice(0, 19).join(", ");
  const last = names[names.length - 1];
  return `${first19}, . . . ${last}`;
};

const inTextSurname = (a: Author): string =>
  a.kind === "person" ? a.surname : a.name;

const inTextSurnames = (authors: Author[]): string[] =>
  authors.map(inTextSurname);

const buildInTextShort = (authors: Author[], year: string): string => {
  if (authors.length === 0) return `(${year || "n.d."})`;
  const names = inTextSurnames(authors);
  if (names.length === 1) return `(${names[0]}, ${year || "n.d."})`;
  if (names.length === 2) return `(${names[0]} & ${names[1]}, ${year || "n.d."})`;
  return `(${names[0]} et al., ${year || "n.d."})`;
};

const buildInTextNarrative = (authors: Author[], year: string): string => {
  if (authors.length === 0) return `(${year || "n.d."})`;
  const names = inTextSurnames(authors);
  if (names.length === 1) return `${names[0]} (${year || "n.d."})`;
  if (names.length === 2) return `${names[0]} and ${names[1]} (${year || "n.d."})`;
  return `${names[0]} et al. (${year || "n.d."})`;
};

const buildSortKey = (
  authors: Author[],
  fallbackTitle: string
): string => {
  if (authors.length === 0) return fallbackTitle.toLowerCase().trim();
  const first = authors[0];
  const surname = first.kind === "person" ? first.surname : first.name;
  return surname.toLowerCase().trim();
};

const yearOrNd = (year: string | undefined): string =>
  year && year.trim() ? year.trim() : "n.d.";

const datePart = (year: string | undefined, monthDay: string | undefined): string => {
  const y = yearOrNd(year);
  if (monthDay && monthDay.trim()) return `${y}, ${monthDay.trim()}`;
  return y;
};

const pageRange = (
  start: string | undefined,
  end: string | undefined
): string => {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return "";
  if (!s) return e;
  if (!e || e === s) return s;
  return `${s}–${e}`;
};

const doiUrl = (doi: string | undefined): string | undefined => {
  if (!doi) return undefined;
  const v = doi.trim();
  if (!v) return undefined;
  if (v.startsWith("http")) return v;
  return `https://doi.org/${v.replace(/^doi:\s*/i, "")}`;
};

// APA 7: do not end a reference with a period when the entry ends with
// a DOI or URL (avoids the period looking like part of the link).
const endsWithLink = (raw: string): boolean => {
  const trailingTagsStripped = raw.replace(/<\/?[a-z]+>\s*$/i, "").trimEnd();
  return /https?:\/\/\S+$/i.test(trailingTagsStripped);
};

const finalSentence = (s: string): string => {
  const trimmed = s.trimEnd();
  if (endsWithLink(trimmed)) return trimmed;
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
};

const buildBook = (f: BookFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  // APA 7: title is italic; edition parens are NOT italic.
  const titlePart = i(f.title);
  const editionSuffix = f.edition ? ` (${t(f.edition)})` : "";
  const editionSuffixPlain = f.edition ? ` (${f.edition})` : "";

  const tail: string[] = [];
  if (f.publisher) tail.push(t(f.publisher));
  const doiLink = doiUrl(f.doi);
  if (doiLink) tail.push(t(doiLink));

  const html = finalSentence(
    [
      t(authors),
      `(${t(yearOrNd(f.year))}).`,
      `${titlePart}${editionSuffix}.`,
      tail.join(". "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${yearOrNd(f.year)}).`,
      `${f.title}${editionSuffixPlain}.`,
      [f.publisher, doiLink].filter(Boolean).join(". "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

const buildBookChapter = (f: BookChapterFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  const editorsRaw = formatAuthorList(f.editors);
  const editorsLabel = f.editors.length > 1 ? "Eds." : "Ed.";
  const pages = pageRange(f.pageStart, f.pageEnd);
  // APA 7: book title is italic; (edition, pp. xx-xx) parens are NOT italic.
  const parenParts: string[] = [];
  if (f.edition) parenParts.push(f.edition);
  if (pages) parenParts.push(`pp. ${pages}`);
  const parenSuffix = parenParts.length > 0 ? ` (${t(parenParts.join(", "))})` : "";
  const parenSuffixPlain = parenParts.length > 0 ? ` (${parenParts.join(", ")})` : "";

  const html = finalSentence(
    [
      t(authors),
      `(${t(yearOrNd(f.year))}).`,
      `${t(f.chapterTitle)}.`,
      `In ${t(editorsRaw)} (${editorsLabel}),`,
      `${i(f.bookTitle)}${parenSuffix}.`,
      f.publisher ? t(f.publisher) : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${yearOrNd(f.year)}).`,
      `${f.chapterTitle}.`,
      `In ${editorsRaw} (${editorsLabel}),`,
      `${f.bookTitle}${parenSuffixPlain}.`,
      f.publisher,
    ]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

const buildJournal = (f: JournalArticleFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  const pages = pageRange(f.pageStart, f.pageEnd);
  const volIssue = f.volume
    ? f.issue
      ? `${i(f.volume)}(${t(f.issue)})`
      : i(f.volume)
    : "";
  const volIssuePlain = f.volume
    ? f.issue
      ? `${f.volume}(${f.issue})`
      : f.volume
    : "";

  const journalAndDetails: string[] = [];
  if (f.journal) journalAndDetails.push(i(f.journal));
  if (volIssue) journalAndDetails.push(volIssue);
  if (pages) journalAndDetails.push(t(pages));
  const journalPart = journalAndDetails.join(", ");

  const journalAndDetailsPlain: string[] = [];
  if (f.journal) journalAndDetailsPlain.push(f.journal);
  if (volIssuePlain) journalAndDetailsPlain.push(volIssuePlain);
  if (pages) journalAndDetailsPlain.push(pages);
  const journalPartPlain = journalAndDetailsPlain.join(", ");

  const link = doiUrl(f.doi) ?? f.url;
  const html = finalSentence(
    [
      t(authors),
      `(${t(yearOrNd(f.year))}).`,
      `${t(f.title)}.`,
      `${journalPart}.`,
      link ? t(link) : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${yearOrNd(f.year)}).`,
      `${f.title}.`,
      `${journalPartPlain}.`,
      link,
    ]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

const buildWebsite = (f: WebsiteFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  const date = datePart(f.year, f.monthDay);
  const retrieved = f.retrievedDate
    ? `Retrieved ${f.retrievedDate}, from ${f.url}`
    : f.url;

  // APA 7: when a page is part of a larger site, the page title is plain
  // and the site name is italic. When the work stands alone (no site name),
  // the title itself is italic.
  const standAlone = !f.siteName || !f.siteName.trim();
  const titlePart = standAlone ? i(f.title) : t(f.title);
  const tail: string[] = [];
  if (f.siteName) tail.push(i(f.siteName));
  if (retrieved) tail.push(t(retrieved));
  const tailPlain: string[] = [];
  if (f.siteName) tailPlain.push(f.siteName);
  if (retrieved) tailPlain.push(retrieved);

  const html = finalSentence(
    [t(authors), `(${t(date)}).`, `${titlePart}.`, tail.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${date}).`,
      `${f.title}.`,
      tailPlain.join(". "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

const buildNews = (f: NewsArticleFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  const date = datePart(f.year, f.monthDay);
  const tail: string[] = [];
  if (f.source) tail.push(i(f.source));
  if (f.url) tail.push(t(f.url));
  const tailPlain: string[] = [];
  if (f.source) tailPlain.push(f.source);
  if (f.url) tailPlain.push(f.url);

  const html = finalSentence(
    [t(authors), `(${t(date)}).`, `${t(f.title)}.`, tail.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [authors, `(${date}).`, `${f.title}.`, tailPlain.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

const buildReport = (f: ReportFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  // APA 7: report title is italic; (Report No. X) parens are NOT italic.
  const titlePart = i(f.title);
  const reportNumberSuffix = f.reportNumber ? ` (${t(f.reportNumber)})` : "";
  const reportNumberSuffixPlain = f.reportNumber ? ` (${f.reportNumber})` : "";

  const tail: string[] = [];
  if (f.publisher) tail.push(t(f.publisher));
  if (f.url) tail.push(t(f.url));
  const tailPlain: string[] = [];
  if (f.publisher) tailPlain.push(f.publisher);
  if (f.url) tailPlain.push(f.url);

  const html = finalSentence(
    [
      t(authors),
      `(${t(yearOrNd(f.year))}).`,
      `${titlePart}${reportNumberSuffix}.`,
      tail.join(". "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${yearOrNd(f.year)}).`,
      `${f.title}${reportNumberSuffixPlain}.`,
      tailPlain.join(". "),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return { html, plain };
};

export function formatReference(input: SourceFields): FormattedReference {
  let result: { html: string; plain: string };
  let authors: Author[];
  let year: string;
  let titleForFallback: string;

  switch (input.sourceType) {
    case "book":
      result = buildBook(input.fields);
      authors = input.fields.authors;
      year = input.fields.year;
      titleForFallback = input.fields.title;
      break;
    case "bookChapter":
      result = buildBookChapter(input.fields);
      authors = input.fields.authors;
      year = input.fields.year;
      titleForFallback = input.fields.chapterTitle;
      break;
    case "journalArticle":
      result = buildJournal(input.fields);
      authors = input.fields.authors;
      year = input.fields.year;
      titleForFallback = input.fields.title;
      break;
    case "website":
      result = buildWebsite(input.fields);
      authors = input.fields.authors;
      year = input.fields.year ?? "";
      titleForFallback = input.fields.title;
      break;
    case "newsArticle":
      result = buildNews(input.fields);
      authors = input.fields.authors;
      year = input.fields.year;
      titleForFallback = input.fields.title;
      break;
    case "report":
      result = buildReport(input.fields);
      authors = input.fields.authors;
      year = input.fields.year;
      titleForFallback = input.fields.title;
      break;
  }

  return {
    formattedHtml: result.html,
    formattedPlain: stripHtml(result.plain),
    inTextShort: buildInTextShort(authors, year),
    inTextNarrative: buildInTextNarrative(authors, year),
    sortKey: buildSortKey(authors, titleForFallback),
  };
}
