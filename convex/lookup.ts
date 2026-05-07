"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// CrossRef DOI lookup. Returns a normalised payload that maps cleanly onto
// the APA 7 fields the References form expects.

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

const extractYear = (msg: CrossRefMessage): string => {
  const parts = msg.issued?.["date-parts"]?.[0] ?? msg.published?.["date-parts"]?.[0];
  return parts && parts[0] ? String(parts[0]) : "";
};

const mapAuthors = (raw: CrossRefAuthor[] | undefined) =>
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

async function crossRefLookup(rawDoi: string) {
  const cleaned = rawDoi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!cleaned) throw new Error("DOI is empty");

  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleaned)}`, {
    headers: { "User-Agent": "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)" },
  });
  if (!res.ok) {
    throw new Error(`CrossRef ${res.status}: DOI not found`);
  }
  const json = (await res.json()) as { message: CrossRefMessage };
  const m = json.message;

  const type = m.type ?? "";
  const sourceType =
    type === "journal-article"
      ? ("journalArticle" as const)
      : type === "book-chapter"
        ? ("bookChapter" as const)
        : type === "book"
          ? ("book" as const)
          : type === "report" || type === "monograph"
            ? ("report" as const)
            : ("journalArticle" as const);

  const pages = (m.page ?? "").split(/[-–]/);

  return {
    sourceType,
    fields: {
      authors: mapAuthors(m.author),
      editors: mapAuthors(m.editor),
      year: extractYear(m),
      title: (m.title ?? [])[0] ?? "",
      chapterTitle: (m.title ?? [])[0] ?? "",
      bookTitle: (m["container-title"] ?? [])[0] ?? "",
      journal: (m["container-title"] ?? [])[0] ?? "",
      publisher: m.publisher ?? "",
      volume: m.volume ?? "",
      issue: m.issue ?? "",
      pageStart: pages[0]?.trim() ?? "",
      pageEnd: pages[1]?.trim() ?? "",
      doi: m.DOI ?? cleaned,
      url: m.URL,
    },
    raw: { type, doi: m.DOI },
  };
}

export const doi = action({
  args: { doi: v.string() },
  handler: async (ctx, { doi }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return await crossRefLookup(doi);
  },
});

interface OpenLibraryBook {
  title?: string;
  publishers?: string[];
  publish_date?: string;
  authors?: { name?: string }[];
  number_of_pages?: number;
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
}

const yearFromPublishDate = (s: string | undefined): string => {
  if (!s) return "";
  const m = s.match(/(\d{4})/);
  return m ? m[1] : "";
};

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

    return {
      sourceType: "book" as const,
      fields: {
        authors: (book.authors ?? []).map((a) => {
          const name = a.name ?? "";
          const parts = name.split(/\s+/);
          if (parts.length >= 2) {
            return {
              kind: "person" as const,
              surname: parts[parts.length - 1],
              given: parts.slice(0, -1).join(" "),
            };
          }
          return { kind: "group" as const, name };
        }),
        year: yearFromPublishDate(book.publish_date),
        title: book.title ?? "",
        publisher: (book.publishers ?? [])[0] ?? "",
      },
    };
  },
});

interface PageMeta {
  title?: string;
  siteName?: string;
  authors?: string[];
  publishedDate?: string;
  citationDoi?: string;
  citationJournal?: string;
  citationVolume?: string;
  citationIssue?: string;
  citationFirstPage?: string;
  citationLastPage?: string;
  citationPublisher?: string;
}

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

// Strip "Title | Site Name" or "Title - Site Name" trailing site suffix.
const stripSiteSuffix = (title: string, siteName: string | undefined): string => {
  if (!siteName) return title.trim();
  const suffixes = [` | ${siteName}`, ` - ${siteName}`, ` — ${siteName}`, ` · ${siteName}`];
  for (const s of suffixes) {
    if (title.endsWith(s)) return title.slice(0, -s.length).trim();
  }
  return title.trim();
};

const splitNameToAuthor = (name: string) => {
  const trimmed = name.trim();
  // citation_author often comes as "Last, First" — handle both forms
  if (trimmed.includes(",")) {
    const [surname, given] = trimmed.split(",", 2).map((s) => s.trim());
    return {
      kind: "person" as const,
      surname,
      given: given ?? "",
    };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return {
      kind: "person" as const,
      surname: parts[parts.length - 1],
      given: parts.slice(0, -1).join(" "),
    };
  }
  return { kind: "group" as const, name: trimmed };
};

const extractDoiFromUrl = (urlString: string): string | undefined => {
  // Direct doi.org URL
  const m1 = urlString.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i);
  if (m1) return decodeURIComponent(m1[1]);
  // Embedded /doi/<DOI> path on a publisher site
  const m2 = urlString.match(/\/doi\/(?:abs\/|full\/|pdf\/)?(10\.\d{4,9}\/[^?#\s]+)/i);
  if (m2) return m2[1];
  return undefined;
};

export const url = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    let cleaned = url.trim();
    if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      throw new Error("Invalid URL");
    }

    // Fast path: if the URL contains a DOI, use CrossRef for proper
    // structured metadata (authors, journal, volume, issue, pages, year).
    const embeddedDoi = extractDoiFromUrl(cleaned);
    if (embeddedDoi) {
      try {
        return await crossRefLookup(embeddedDoi);
      } catch {
        // Fall through to scraping if CrossRef fails or returns nothing useful.
      }
    }

    const res = await fetch(cleaned, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; UniCitationTool/1.0; +https://festiverides.online/uni)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Page returned ${res.status}`);
    const html = await res.text();

    // citation_* meta tags are the academic publishing standard (Google
    // Scholar). They give us proper journal-article metadata when present.
    const citationAuthors = allMetaValues(html, "citation_author");
    const citationDoi = metaTag(
      html,
      /<meta\s+(?:property|name)=["']citation_doi["']\s+content=["']([^"']+)["']/i
    );

    // If the page declares a DOI even though the URL didn't, use CrossRef.
    if (citationDoi) {
      try {
        return await crossRefLookup(citationDoi);
      } catch {
        // fall through
      }
    }

    const meta: PageMeta = {
      title:
        metaTag(html, /<meta\s+(?:property|name)=["']citation_title["']\s+content=["']([^"']+)["']/i) ??
        metaTag(html, /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ??
        metaTag(html, /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ??
        metaTag(html, /<title[^>]*>([^<]+)<\/title>/i),
      siteName: metaTag(
        html,
        /<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i
      ),
      authors:
        citationAuthors.length > 0
          ? citationAuthors
          : (() => {
              const single =
                metaTag(html, /<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ??
                metaTag(
                  html,
                  /<meta\s+(?:property|name)=["']article:author["']\s+content=["']([^"']+)["']/i
                );
              return single ? [single] : [];
            })(),
      publishedDate:
        metaTag(
          html,
          /<meta\s+(?:property|name)=["']citation_publication_date["']\s+content=["']([^"']+)["']/i
        ) ??
        metaTag(
          html,
          /<meta\s+(?:property|name)=["']citation_date["']\s+content=["']([^"']+)["']/i
        ) ??
        metaTag(
          html,
          /<meta\s+(?:property|name)=["']article:published_time["']\s+content=["']([^"']+)["']/i
        ) ??
        metaTag(
          html,
          /<meta\s+(?:property|name)=["']og:published_time["']\s+content=["']([^"']+)["']/i
        ),
      citationJournal: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_journal_title["']\s+content=["']([^"']+)["']/i
      ),
      citationVolume: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_volume["']\s+content=["']([^"']+)["']/i
      ),
      citationIssue: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_issue["']\s+content=["']([^"']+)["']/i
      ),
      citationFirstPage: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_firstpage["']\s+content=["']([^"']+)["']/i
      ),
      citationLastPage: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_lastpage["']\s+content=["']([^"']+)["']/i
      ),
      citationPublisher: metaTag(
        html,
        /<meta\s+(?:property|name)=["']citation_publisher["']\s+content=["']([^"']+)["']/i
      ),
    };

    const cleanedTitle = stripSiteSuffix(meta.title ?? parsed.hostname, meta.siteName);

    const year = yearFromPublishDate(meta.publishedDate);
    const monthDay = meta.publishedDate
      ? (() => {
          const d = new Date(meta.publishedDate!);
          if (isNaN(d.getTime())) return undefined;
          return d.toLocaleDateString("en-NZ", { month: "long", day: "numeric" });
        })()
      : undefined;

    // Authors: parsed citation_authors first, otherwise empty (better to
    // leave blank than fall back to hostname junk).
    const authors =
      meta.authors && meta.authors.length > 0
        ? meta.authors.map(splitNameToAuthor)
        : [];

    // If the page exposes journal-style citation_* tags, treat as journal article.
    const looksLikeJournal = !!(
      meta.citationJournal ||
      meta.citationVolume ||
      meta.citationFirstPage
    );

    if (looksLikeJournal) {
      return {
        sourceType: "journalArticle" as const,
        fields: {
          authors,
          year,
          title: cleanedTitle,
          journal: meta.citationJournal ?? "",
          volume: meta.citationVolume ?? "",
          issue: meta.citationIssue ?? "",
          pageStart: meta.citationFirstPage ?? "",
          pageEnd: meta.citationLastPage ?? "",
          url: cleaned,
        },
      };
    }

    return {
      sourceType: "website" as const,
      fields: {
        authors,
        year,
        monthDay,
        title: cleanedTitle,
        siteName: meta.siteName ?? parsed.hostname,
        url: cleaned,
      },
    };
  },
});
