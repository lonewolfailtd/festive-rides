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
  volume?: string; // for chapters in a multi-volume work, e.g. "Vol. 2"
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

export interface EditedBookFields {
  editors: Author[];
  year: string;
  title: string;
  edition?: string;
  publisher: string;
  doi?: string;
}

export interface OnlineVideoFields {
  // Authors here = uploader / channel / creator. Single channel uses 1 entry.
  authors: Author[];
  year: string;
  monthDay?: string;
  title: string;
  platform: string;
  url: string;
}

export interface AIToolFields {
  maker: string;        // e.g. "OpenAI"
  year: string;
  toolName: string;     // e.g. "ChatGPT"
  version?: string;     // e.g. "Mar 14 version"
  description: string;  // e.g. "Large language model"
  url: string;
}

export type SourceType =
  | "book"
  | "bookChapter"
  | "editedBook"
  | "journalArticle"
  | "website"
  | "newsArticle"
  | "report"
  | "onlineVideo"
  | "aiTool";

export type SourceFields =
  | { sourceType: "book"; fields: BookFields }
  | { sourceType: "bookChapter"; fields: BookChapterFields }
  | { sourceType: "editedBook"; fields: EditedBookFields }
  | { sourceType: "journalArticle"; fields: JournalArticleFields }
  | { sourceType: "website"; fields: WebsiteFields }
  | { sourceType: "newsArticle"; fields: NewsArticleFields }
  | { sourceType: "report"; fields: ReportFields }
  | { sourceType: "onlineVideo"; fields: OnlineVideoFields }
  | { sourceType: "aiTool"; fields: AIToolFields };

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
  editedBook: "Edited book",
  journalArticle: "Journal article",
  website: "Website / web page",
  newsArticle: "News article",
  report: "Report (government or organisation)",
  onlineVideo: "Online video",
  aiTool: "AI tool (ChatGPT etc.)",
};
