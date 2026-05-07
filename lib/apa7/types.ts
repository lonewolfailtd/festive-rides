// Field shapes for each source type the citation tool supports.
// Author entries can be a person (surname + initials) or a group (organisation).

export type Author =
  | { kind: "person"; surname: string; given: string }
  | { kind: "group"; name: string };

export interface BookFields {
  authors: Author[];
  year: string;
  title: string;
  edition?: string;
  publisher: string;
  doi?: string;
}

export interface BookChapterFields {
  authors: Author[];
  year: string;
  chapterTitle: string;
  editors: Author[];
  bookTitle: string;
  pageStart?: string;
  pageEnd?: string;
  edition?: string;
  publisher: string;
  doi?: string;
}

export interface JournalArticleFields {
  authors: Author[];
  year: string;
  title: string;
  journal: string;
  volume?: string;
  issue?: string;
  pageStart?: string;
  pageEnd?: string;
  doi?: string;
  url?: string;
}

export interface WebsiteFields {
  authors: Author[];
  year?: string;
  monthDay?: string;
  title: string;
  siteName?: string;
  url: string;
  retrievedDate?: string;
}

export interface NewsArticleFields {
  authors: Author[];
  year: string;
  monthDay?: string;
  title: string;
  source: string;
  url?: string;
}

export interface ReportFields {
  authors: Author[];
  year: string;
  title: string;
  reportNumber?: string;
  publisher?: string;
  url?: string;
}

export type SourceType =
  | "book"
  | "bookChapter"
  | "journalArticle"
  | "website"
  | "newsArticle"
  | "report";

export type SourceFields =
  | { sourceType: "book"; fields: BookFields }
  | { sourceType: "bookChapter"; fields: BookChapterFields }
  | { sourceType: "journalArticle"; fields: JournalArticleFields }
  | { sourceType: "website"; fields: WebsiteFields }
  | { sourceType: "newsArticle"; fields: NewsArticleFields }
  | { sourceType: "report"; fields: ReportFields };

export interface FormattedReference {
  formattedHtml: string;
  formattedPlain: string;
  inTextShort: string;
  inTextNarrative: string;
  sortKey: string;
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  book: "Book",
  bookChapter: "Book chapter",
  journalArticle: "Journal article",
  website: "Website / web page",
  newsArticle: "News article",
  report: "Report (government or organisation)",
};
