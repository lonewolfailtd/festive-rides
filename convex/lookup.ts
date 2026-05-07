"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

type Author =
  | { kind: "person"; surname: string; given: string }
  | { kind: "group"; name: string };

type SourceType = "book" | "bookChapter" | "journalArticle" | "website" | "report";

interface NormalisedFields {
  authors?: Author[];
  editors?: Author[];
  year?: string;
  title?: string;
  chapterTitle?: string;
  bookTitle?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pageStart?: string;
  pageEnd?: string;
  doi?: string;
  url?: string;
  monthDay?: string;
  siteName?: string;
}

type LookupSource = "openalex" | "crossref" | "page";

// ---------------------------------------------------------------------------
// CrossRef
// ---------------------------------------------------------------------------

interface CrossRefAuthor {
  family?: string;
  given?: string;
  name?: string;
}

interface CrossRefMessage {
  DOI?: string;
  type?: string;
  title?: string[];
  "container-title"?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  author?: CrossRefAuthor[];
  editor?: CrossRefAuthor[];
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  URL?: string;
}

const extractCrossRefYear = (msg: CrossRefMessage): string => {
  const parts = msg.issued?.["date-parts"]?.[0] ?? msg.published?.["date-parts"]?.[0];
  return parts && parts[0] ? String(parts[0]) : "";
};

const mapCrossRefAuthors = (raw: CrossRefAuthor[] | undefined): Author[] =>
  (raw ?? []).map((a) => {
    if (a.family || a.given) {
      return {
        kind: "person" as const,
        surname: a.family ?? "",
        given: a.given ?? "",
      };
    }
    return { kind: "group" as const, name: a.name ?? "" };
  });

const crossRefTypeToSource = (t: string | undefined): SourceType => {
  switch (t) {
    case "journal-article":
      return "journalArticle";
    case "book-chapter":
      return "bookChapter";
    case "book":
      return "book";
    case "report":
    case "monograph":
      return "report";
    default:
      return "journalArticle";
  }
};

async function crossRefLookup(
  rawDoi: string
): Promise<{ sourceType: SourceType; fields: NormalisedFields } | null> {
  const cleaned = rawDoi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!cleaned) return null;

  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleaned)}`, {
    headers: { "User-Agent": "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { message: CrossRefMessage };
  const m = json.message;
  const pages = (m.page ?? "").split(/[-–]/);

  const sourceType = crossRefTypeToSource(m.type);
  const containerTitle = (m["container-title"] ?? [])[0] ?? "";
  const title = (m.title ?? [])[0] ?? "";

  return {
    sourceType,
    fields: {
      authors: mapCrossRefAuthors(m.author),
      editors: mapCrossRefAuthors(m.editor),
      year: extractCrossRefYear(m),
      title,
      chapterTitle: title,
      bookTitle: containerTitle,
      journal: containerTitle,
      publisher: m.publisher ?? "",
      volume: m.volume ?? "",
      issue: m.issue ?? "",
      pageStart: pages[0]?.trim() ?? "",
      pageEnd: pages[1]?.trim() ?? "",
      doi: m.DOI ?? cleaned,
      url: m.URL,
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAlex
// ---------------------------------------------------------------------------

interface OpenAlexAuthorship {
  author?: { display_name?: string };
}

interface OpenAlexWork {
  id?: string;
  doi?: string;
  type?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  authorships?: OpenAlexAuthorship[];
  primary_location?: {
    source?: { display_name?: string; type?: string; publisher?: string };
    landing_page_url?: string;
  };
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
}

const splitDisplayName = (name: string): Author => {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [surname, given] = trimmed.split(",", 2).map((s) => s.trim());
    return { kind: "person", surname, given: given ?? "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return {
      kind: "person",
      surname: parts[parts.length - 1],
      given: parts.slice(0, -1).join(" "),
    };
  }
  return { kind: "group", name: trimmed };
};

const openAlexTypeToSource = (t: string | undefined): SourceType => {
  switch (t) {
    case "journal-article":
    case "article":
      return "journalArticle";
    case "book-chapter":
    case "book-part":
      return "bookChapter";
    case "book":
    case "monograph":
      return "book";
    case "report":
      return "report";
    default:
      return "journalArticle";
  }
};

async function openAlexLookup(
  rawDoi: string
): Promise<{ sourceType: SourceType; fields: NormalisedFields } | null> {
  const cleaned = rawDoi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!cleaned) return null;

  const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(cleaned)}`, {
    headers: {
      "User-Agent": "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)",
    },
  });
  if (!res.ok) return null;
  const w = (await res.json()) as OpenAlexWork;

  const sourceType = openAlexTypeToSource(w.type);
  const containerName = w.primary_location?.source?.display_name ?? "";
  const isJournal = sourceType === "journalArticle";
  const title = w.title ?? w.display_name ?? "";

  return {
    sourceType,
    fields: {
      authors: (w.authorships ?? [])
        .map((a) => a.author?.display_name)
        .filter((n): n is string => !!n)
        .map(splitDisplayName),
      year: w.publication_year ? String(w.publication_year) : "",
      title,
      chapterTitle: title,
      bookTitle: !isJournal ? containerName : "",
      journal: isJournal ? containerName : "",
      publisher: w.primary_location?.source?.publisher ?? "",
      volume: w.biblio?.volume ?? "",
      issue: w.biblio?.issue ?? "",
      pageStart: w.biblio?.first_page ?? "",
      pageEnd: w.biblio?.last_page ?? "",
      doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? cleaned,
      url: w.primary_location?.landing_page_url ?? w.id,
    },
  };
}

// ---------------------------------------------------------------------------
// Page scrape
// ---------------------------------------------------------------------------

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");

const metaTag = (html: string, regex: RegExp): string | undefined => {
  const m = html.match(regex);
  return m ? decodeEntities(m[1]).trim() : undefined;
};

const allMetaValues = (html: string, name: string): string[] => {
  const re = new RegExp(
    `<meta\\s+(?:property|name)=["']${name}["']\\s+content=["']([^"']+)["']`,
    "gi"
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out.push(decodeEntities(match[1]).trim());
  }
  return out;
};

const stripSiteSuffix = (title: string, siteName: string | undefined): string => {
  if (!siteName) return title.trim();
  const suffixes = [` | ${siteName}`, ` - ${siteName}`, ` — ${siteName}`, ` · ${siteName}`];
  for (const s of suffixes) {
    if (title.endsWith(s)) return title.slice(0, -s.length).trim();
  }
  return title.trim();
};

const yearFromDate = (s: string | undefined): string => {
  if (!s) return "";
  const m = s.match(/(\d{4})/);
  return m ? m[1] : "";
};

async function pageScrape(
  url: string
): Promise<{ sourceType: SourceType; fields: NormalisedFields } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; UniCitationTool/1.0; +https://festiverides.online/uni)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();

  const citationAuthors = allMetaValues(html, "citation_author");
  const citationDoi = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_doi["']\s+content=["']([^"']+)["']/i
  );
  const citationJournal = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_journal_title["']\s+content=["']([^"']+)["']/i
  );
  const citationVolume = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_volume["']\s+content=["']([^"']+)["']/i
  );
  const citationIssue = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_issue["']\s+content=["']([^"']+)["']/i
  );
  const citationFirstPage = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_firstpage["']\s+content=["']([^"']+)["']/i
  );
  const citationLastPage = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_lastpage["']\s+content=["']([^"']+)["']/i
  );
  const citationPublisher = metaTag(
    html,
    /<meta\s+(?:property|name)=["']citation_publisher["']\s+content=["']([^"']+)["']/i
  );
  const citationDate =
    metaTag(
      html,
      /<meta\s+(?:property|name)=["']citation_publication_date["']\s+content=["']([^"']+)["']/i
    ) ??
    metaTag(
      html,
      /<meta\s+(?:property|name)=["']citation_date["']\s+content=["']([^"']+)["']/i
    );

  const ogTitle = metaTag(
    html,
    /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i
  );
  const ogSite = metaTag(
    html,
    /<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i
  );
  const ogPublished = metaTag(
    html,
    /<meta\s+(?:property|name)=["']article:published_time["']\s+content=["']([^"']+)["']/i
  );
  const htmlTitle = metaTag(html, /<title[^>]*>([^<]+)<\/title>/i);
  const ogAuthor =
    metaTag(html, /<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ??
    metaTag(
      html,
      /<meta\s+(?:property|name)=["']article:author["']\s+content=["']([^"']+)["']/i
    );

  const looksLikeJournal = !!(
    citationJournal ||
    citationVolume ||
    citationFirstPage
  );
  const sourceType: SourceType = looksLikeJournal ? "journalArticle" : "website";

  const rawTitle =
    metaTag(html, /<meta\s+(?:property|name)=["']citation_title["']\s+content=["']([^"']+)["']/i) ??
    ogTitle ??
    metaTag(html, /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ??
    htmlTitle ??
    parsed.hostname;
  const title = stripSiteSuffix(rawTitle, ogSite);

  const authors =
    citationAuthors.length > 0
      ? citationAuthors.map(splitDisplayName)
      : ogAuthor
        ? [splitDisplayName(ogAuthor)]
        : [];

  const dateString = citationDate ?? ogPublished;
  const monthDay = dateString
    ? (() => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return undefined;
        return d.toLocaleDateString("en-NZ", { month: "long", day: "numeric" });
      })()
    : undefined;

  return {
    sourceType,
    fields: {
      authors,
      year: yearFromDate(dateString),
      title,
      journal: citationJournal ?? "",
      volume: citationVolume ?? "",
      issue: citationIssue ?? "",
      pageStart: citationFirstPage ?? "",
      pageEnd: citationLastPage ?? "",
      publisher: citationPublisher ?? "",
      doi: citationDoi ?? "",
      url,
      siteName: ogSite ?? parsed.hostname,
      monthDay,
    },
  };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<LookupSource, string> = {
  openalex: "OpenAlex",
  crossref: "CrossRef",
  page: "page meta",
};

const isMeaningful = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const normaliseString = (v: string): string =>
  v
    .toLowerCase()
    .replace(/[\s.,;:!?'"()\[\]{}—–-]/g, "")
    .trim();

const authorsKey = (authors: Author[]): string =>
  authors
    .map((a) =>
      a.kind === "person"
        ? `${a.surname.toLowerCase()}|${a.given.toLowerCase()}`
        : `g:${a.name.toLowerCase()}`
    )
    .join("&");

const valuesEqual = (a: unknown, b: unknown, field: string): boolean => {
  if (typeof a === "string" && typeof b === "string") {
    return normaliseString(a) === normaliseString(b);
  }
  if (Array.isArray(a) && Array.isArray(b) && field === "authors") {
    return authorsKey(a as Author[]) === authorsKey(b as Author[]);
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

const FIELDS_TO_MERGE: (keyof NormalisedFields)[] = [
  "authors",
  "editors",
  "year",
  "title",
  "chapterTitle",
  "bookTitle",
  "journal",
  "publisher",
  "volume",
  "issue",
  "pageStart",
  "pageEnd",
  "doi",
  "url",
  "monthDay",
  "siteName",
];

interface MergeResult {
  fields: NormalisedFields;
  fieldSources: Partial<Record<keyof NormalisedFields, string>>;
  warnings: string[];
}

function mergeSources(
  inputs: { name: LookupSource; fields: NormalisedFields }[]
): MergeResult {
  const out: NormalisedFields = {};
  const fieldSources: Partial<Record<keyof NormalisedFields, string>> = {};
  const warnings: string[] = [];

  for (const field of FIELDS_TO_MERGE) {
    const candidates = inputs
      .map((i) => ({ name: i.name, value: i.fields[field] }))
      .filter((c) => isMeaningful(c.value));
    if (candidates.length === 0) continue;

    // priority order = order of inputs
    const winner = candidates[0];
    (out as Record<string, unknown>)[field] = winner.value;

    const disagreements = candidates.filter(
      (c) => !valuesEqual(c.value, winner.value, field)
    );

    if (disagreements.length > 0) {
      const all = [winner, ...disagreements]
        .map((c) => `${SOURCE_LABELS[c.name]}: ${formatForWarning(c.value, field)}`)
        .join(" | ");
      warnings.push(`${field}: ${all}`);
      fieldSources[field] = `${SOURCE_LABELS[winner.name]} (disputed)`;
    } else if (candidates.length > 1) {
      fieldSources[field] = candidates.map((c) => SOURCE_LABELS[c.name]).join(" + ");
    } else {
      fieldSources[field] = SOURCE_LABELS[winner.name];
    }
  }

  return { fields: out, fieldSources, warnings };
}

const formatForWarning = (v: unknown, field: string): string => {
  if (Array.isArray(v) && field === "authors") {
    return (v as Author[])
      .map((a) => (a.kind === "person" ? `${a.given} ${a.surname}`.trim() : a.name))
      .join("; ");
  }
  if (typeof v === "string") return v;
  return JSON.stringify(v);
};

// ---------------------------------------------------------------------------
// DOI extraction from URLs
// ---------------------------------------------------------------------------

const extractDoiFromUrl = (urlString: string): string | undefined => {
  const m1 = urlString.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i);
  if (m1) return decodeURIComponent(m1[1]);
  const m2 = urlString.match(/\/doi\/(?:abs\/|full\/|pdf\/)?(10\.\d{4,9}\/[^?#\s]+)/i);
  if (m2) return m2[1];
  return undefined;
};

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

interface PublicResult {
  sourceType: SourceType;
  fields: NormalisedFields;
  fieldSources: Partial<Record<keyof NormalisedFields, string>>;
  warnings: string[];
  sourcesQueried: string[];
}

async function multiSourceDoiLookup(
  doi: string,
  pageUrl?: string
): Promise<PublicResult> {
  const queries: Promise<{
    name: LookupSource;
    sourceType: SourceType;
    fields: NormalisedFields;
  } | null>[] = [
    openAlexLookup(doi).then((r) =>
      r ? { name: "openalex" as const, sourceType: r.sourceType, fields: r.fields } : null
    ),
    crossRefLookup(doi).then((r) =>
      r ? { name: "crossref" as const, sourceType: r.sourceType, fields: r.fields } : null
    ),
  ];
  if (pageUrl) {
    queries.push(
      pageScrape(pageUrl).then((r) =>
        r ? { name: "page" as const, sourceType: r.sourceType, fields: r.fields } : null
      )
    );
  }

  const settled = await Promise.all(queries);
  const successful = settled.filter(
    (s): s is { name: LookupSource; sourceType: SourceType; fields: NormalisedFields } =>
      s !== null
  );

  if (successful.length === 0) {
    throw new Error("No metadata found from any source");
  }

  // Source type: prefer the most specific non-website. Priority order matches
  // the array (OpenAlex > CrossRef > page).
  const sourceType = successful[0].sourceType;
  const merge = mergeSources(
    successful.map((s) => ({ name: s.name, fields: s.fields }))
  );

  return {
    sourceType,
    fields: merge.fields,
    fieldSources: merge.fieldSources,
    warnings: merge.warnings,
    sourcesQueried: successful.map((s) => SOURCE_LABELS[s.name]),
  };
}

export const doi = action({
  args: { doi: v.string() },
  handler: async (ctx, { doi }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const cleaned = doi
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "");
    if (!cleaned) throw new Error("DOI is empty");
    return await multiSourceDoiLookup(cleaned);
  },
});

interface OpenLibraryBook {
  title?: string;
  publishers?: string[];
  publish_date?: string;
  authors?: { name?: string }[];
}

export const isbn = action({
  args: { isbn: v.string() },
  handler: async (ctx, { isbn }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const cleaned = isbn.replace(/[^0-9Xx]/g, "");
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      throw new Error("ISBN must be 10 or 13 digits");
    }
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&jscmd=data&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    const json = (await res.json()) as Record<string, OpenLibraryBook>;
    const book = json[`ISBN:${cleaned}`];
    if (!book) throw new Error("Book not found in Open Library");

    const fields: NormalisedFields = {
      authors: (book.authors ?? []).map((a) =>
        splitDisplayName(a.name ?? "")
      ),
      year: yearFromDate(book.publish_date),
      title: book.title ?? "",
      publisher: (book.publishers ?? [])[0] ?? "",
    };

    const result: PublicResult = {
      sourceType: "book",
      fields,
      fieldSources: { authors: "Open Library", title: "Open Library", year: "Open Library", publisher: "Open Library" },
      warnings: [],
      sourcesQueried: ["Open Library"],
    };
    return result;
  },
});

export const url = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    let cleaned = url.trim();
    if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
    try {
      new URL(cleaned);
    } catch {
      throw new Error("Invalid URL");
    }

    // If the URL contains a DOI, run the full multi-source merge against
    // that DOI plus the page itself.
    const embeddedDoi = extractDoiFromUrl(cleaned);
    if (embeddedDoi) {
      try {
        return await multiSourceDoiLookup(embeddedDoi, cleaned);
      } catch {
        // fall through to page-only scrape
      }
    }

    // No DOI in URL — try the page itself, and if the page declares a DOI
    // we then fetch CrossRef + OpenAlex against that DOI too.
    const scraped = await pageScrape(cleaned);
    if (!scraped) throw new Error("Could not fetch page");
    const declaredDoi = scraped.fields.doi;
    if (declaredDoi) {
      try {
        return await multiSourceDoiLookup(declaredDoi, cleaned);
      } catch {
        // fall back to page-only result below
      }
    }

    const result: PublicResult = {
      sourceType: scraped.sourceType,
      fields: scraped.fields,
      fieldSources: Object.fromEntries(
        FIELDS_TO_MERGE.filter((f) => isMeaningful(scraped.fields[f])).map((f) => [
          f,
          SOURCE_LABELS.page,
        ])
      ),
      warnings: [],
      sourcesQueried: [SOURCE_LABELS.page],
    };
    return result;
  },
});
