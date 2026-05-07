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
  if (!start) return "";
  if (end && end !== start) return `${start}–${end}`;
  return start;
};

const doiUrl = (doi: string | undefined): string | undefined => {
  if (!doi) return undefined;
  const v = doi.trim();
  if (!v) return undefined;
  if (v.startsWith("http")) return v;
  return `https://doi.org/${v.replace(/^doi:\s*/i, "")}`;
};

const finalSentence = (s: string): string =>
  s.endsWith(".") ? s : `${s}.`;

const buildBook = (f: BookFields): { html: string; plain: string } => {
  const authors = formatAuthorList(f.authors);
  const titleWithEd = f.edition
    ? `${f.title} (${f.edition})`
    : f.title;
  const titlePart = i(titleWithEd);
  const titlePlain = titleWithEd;

  const tail: string[] = [];
  if (f.publisher) tail.push(t(f.publisher));
  const doiLink = doiUrl(f.doi);
  if (doiLink) tail.push(t(doiLink));

  const html = finalSentence(
    [t(authors), `(${t(yearOrNd(f.year))}).`, `${titlePart}.`, tail.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [authors, `(${yearOrNd(f.year)}).`, `${titlePlain}.`, [f.publisher, doiLink].filter(Boolean).join(". ")]
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
  const titleWithEdRaw = f.edition
    ? `${f.bookTitle} (${f.edition}${pages ? `, pp. ${pages}` : ""})`
    : pages
      ? `${f.bookTitle} (pp. ${pages})`
      : f.bookTitle;

  const html = finalSentence(
    [
      t(authors),
      `(${t(yearOrNd(f.year))}).`,
      `${t(f.chapterTitle)}.`,
      `In ${t(editorsRaw)} (${editorsLabel}),`,
      `${i(titleWithEdRaw)}.`,
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
      `${titleWithEdRaw}.`,
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

  const titlePart = i(f.title);
  const titlePlain = f.title;
  const tail: string[] = [];
  if (f.siteName) tail.push(t(f.siteName));
  if (retrieved) tail.push(t(retrieved));

  const html = finalSentence(
    [t(authors), `(${t(date)}).`, `${titlePart}.`, tail.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${date}).`,
      `${titlePlain}.`,
      [f.siteName, retrieved].filter(Boolean).join(". "),
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
  const titleWithNumberRaw = f.reportNumber
    ? `${f.title} (${f.reportNumber})`
    : f.title;
  const tail: string[] = [];
  if (f.publisher) tail.push(t(f.publisher));
  if (f.url) tail.push(t(f.url));
  const tailPlain: string[] = [];
  if (f.publisher) tailPlain.push(f.publisher);
  if (f.url) tailPlain.push(f.url);

  const html = finalSentence(
    [t(authors), `(${t(yearOrNd(f.year))}).`, `${i(titleWithNumberRaw)}.`, tail.join(". ")]
      .filter(Boolean)
      .join(" ")
  );
  const plain = finalSentence(
    [
      authors,
      `(${yearOrNd(f.year)}).`,
      `${titleWithNumberRaw}.`,
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
