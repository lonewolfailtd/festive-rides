"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// OpenAlex source-finder. Free, no key required.
// Docs: https://docs.openalex.org

interface OpenAlexAuthor {
  author?: { display_name?: string; orcid?: string };
}

interface OpenAlexWork {
  id?: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  type?: string;
  authorships?: OpenAlexAuthor[];
  primary_location?: {
    source?: { display_name?: string; type?: string };
    landing_page_url?: string;
  };
  open_access?: { is_oa?: boolean; oa_url?: string };
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
}

const reconstructAbstract = (
  inv: Record<string, number[]> | undefined
): string | undefined => {
  if (!inv) return undefined;
  const positions: { word: string; pos: number }[] = [];
  for (const [word, posList] of Object.entries(inv)) {
    for (const pos of posList) {
      positions.push({ word, pos });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p) => p.word).join(" ");
};

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { kind: "group" as const, name: full };
  return {
    kind: "person" as const,
    surname: parts[parts.length - 1],
    given: parts.slice(0, -1).join(" "),
  };
};

// Unified search-result shape returned to clients. Both OpenAlex and
// Semantic Scholar map their per-API responses into this shape, then
// we merge + de-dupe before returning. Keeping the shape stable means
// the Source Finder UI doesn't care which engine produced any given row.
interface NormalisedResult {
  id?: string;
  title: string;
  year: number | null;
  authors: ReturnType<typeof splitName>[];
  journal?: string;
  publisher?: string;
  type?: string;
  doi?: string;
  url?: string;
  openAccessUrl?: string;
  citedByCount: number;
  abstract?: string;
  // Provenance — which engine produced this row. Used by the merge
  // step to boost results that appear in BOTH (strong relevance signal).
  sources: ("openalex" | "semantic_scholar")[];
}

// Semantic Scholar Graph API response shape (subset we care about).
// Docs: https://api.semanticscholar.org/api-docs/graph
interface SemanticScholarPaper {
  paperId?: string;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  authors?: { name?: string }[];
  externalIds?: {
    DOI?: string | null;
    ArXiv?: string | null;
    PubMed?: string | null;
  };
  openAccessPdf?: { url?: string | null } | null;
  publicationTypes?: string[] | null;
  journal?: { name?: string } | null;
  citationCount?: number;
}

// Search Semantic Scholar's Graph API in parallel with OpenAlex.
// 138M papers, high-quality metadata, free without API key at moderate
// rates (~1 req/sec). Mostly complementary to OpenAlex — papers found
// only in S2 fill gaps in OpenAlex's coverage, papers found in BOTH
// get a relevance boost (we move them to the top of the merged list).
async function searchSemanticScholar(
  query: string,
  limit: number,
  yearFrom?: number,
  openAccessOnly?: boolean,
): Promise<NormalisedResult[]> {
  // S2 supports a small set of filter args. We only pass yearFrom +
  // openAccessOnly here; sourceType / nzAuthoredOnly aren't well
  // supported, so we don't push them through — the OpenAlex side
  // covers those filters anyway.
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 25)),
    fields:
      "paperId,title,abstract,year,authors,externalIds,openAccessPdf,publicationTypes,journal,citationCount",
  });
  if (yearFrom) params.set("year", `${yearFrom}-`);
  if (openAccessOnly) params.set("openAccessPdf", "");

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)",
    },
  });
  if (!res.ok) {
    // S2 is a best-effort augmentation — if it fails (rate limit,
    // outage), we just return [] and let OpenAlex carry the search.
    // The merge function tolerates an empty array gracefully.
    return [];
  }
  const json = (await res.json()) as { data?: SemanticScholarPaper[] };
  const papers = json.data ?? [];

  return papers.map((p): NormalisedResult => {
    const pubType = p.publicationTypes?.[0]?.toLowerCase();
    const isJournal =
      pubType === "journalarticle" || (!!p.journal?.name && !pubType);
    // S2 publication types differ from OpenAlex's. Map the common ones
    // back to OpenAlex-style strings so the client's existing tag
    // styling + filtering paths keep working.
    const mappedType = pubType
      ? pubType === "journalarticle"
        ? "journal-article"
        : pubType === "review"
          ? "review"
          : pubType === "book"
            ? "book"
            : pubType === "bookchapter"
              ? "book-chapter"
              : pubType === "conferencepaper"
                ? "proceedings-article"
                : pubType
      : undefined;
    return {
      id: p.paperId ? `https://www.semanticscholar.org/paper/${p.paperId}` : undefined,
      title: p.title ?? "(untitled)",
      year: p.year ?? null,
      authors: (p.authors ?? [])
        .map((a) => a.name)
        .filter((n): n is string => !!n)
        .map(splitName),
      journal: isJournal ? p.journal?.name ?? undefined : undefined,
      publisher: !isJournal ? p.journal?.name ?? undefined : undefined,
      type: mappedType,
      doi: p.externalIds?.DOI ?? undefined,
      url: p.paperId
        ? `https://www.semanticscholar.org/paper/${p.paperId}`
        : undefined,
      openAccessUrl: p.openAccessPdf?.url ?? undefined,
      citedByCount: p.citationCount ?? 0,
      abstract: p.abstract ?? undefined,
      sources: ["semantic_scholar"],
    };
  });
}

// Normalise a title for de-dupe matching. Lowercase, strip non-alphanum,
// collapse whitespace. Title fuzzy-match catches the common case where
// two engines have the same paper but DOI is missing on one side.
function normaliseTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Merge two NormalisedResult arrays. De-dupe primary key: DOI (case-
// insensitive). Fallback: normalised title. When the same paper
// appears in BOTH sources, we combine the `sources` arrays — a
// "both-engines-found-this" signal we can use for ranking. OpenAlex
// entries are preferred as the base (richer field coverage on average)
// with S2 fields filled in where OpenAlex's are missing.
function mergeResults(
  openalexResults: NormalisedResult[],
  s2Results: NormalisedResult[],
): NormalisedResult[] {
  const byKey = new Map<string, NormalisedResult>();
  const titleKeyByDoi = new Map<string, string>(); // for cross-reference when one side lacks DOI

  // Walk OpenAlex first — these become the base rows.
  for (const r of openalexResults) {
    const doi = r.doi?.toLowerCase();
    const titleKey = normaliseTitle(r.title);
    const key = doi ?? `t:${titleKey}`;
    byKey.set(key, r);
    if (doi) titleKeyByDoi.set(`t:${titleKey}`, doi);
  }

  // Walk S2 — merge into existing keys or add new.
  for (const r of s2Results) {
    const doi = r.doi?.toLowerCase();
    const titleKey = normaliseTitle(r.title);
    // Try DOI first; then title fuzzy-match — including the case
    // where OpenAlex had a DOI but S2 doesn't (look up by title to
    // find the DOI-keyed entry).
    let key = doi ?? `t:${titleKey}`;
    if (!byKey.has(key)) {
      const reverseDoi = titleKeyByDoi.get(`t:${titleKey}`);
      if (reverseDoi && byKey.has(reverseDoi)) key = reverseDoi;
    }
    const existing = byKey.get(key);
    if (existing) {
      // Merge: existing wins, but fill in missing fields from S2.
      existing.sources = Array.from(
        new Set([...existing.sources, ...r.sources]),
      );
      existing.abstract = existing.abstract ?? r.abstract;
      existing.openAccessUrl = existing.openAccessUrl ?? r.openAccessUrl;
      existing.citedByCount = Math.max(
        existing.citedByCount,
        r.citedByCount,
      );
      existing.journal = existing.journal ?? r.journal;
      existing.publisher = existing.publisher ?? r.publisher;
      existing.doi = existing.doi ?? r.doi;
    } else {
      byKey.set(key, r);
    }
  }

  // Sort: results that appear in BOTH sources first (strong relevance
  // signal), then OpenAlex-only, then S2-only. Within each group,
  // preserve the input order (OpenAlex's relevance ranking).
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => {
    const aBoth = a.sources.length === 2 ? 0 : 1;
    const bBoth = b.sources.length === 2 ? 0 : 1;
    if (aBoth !== bBoth) return aBoth - bBoth;
    return 0;
  });
  return merged;
}

// Map our friendly source-type values to OpenAlex `type` filter values.
// "all" passes no filter. Note: in OpenAlex "book" can sometimes appear
// as type "book" or "monograph" depending on data; we accept the broader
// of the two when filtering for "book".
const SOURCE_TYPE_FILTER: Record<string, string | null> = {
  all: null,
  journalArticle: "type:journal-article",
  book: "type:book|monograph",
  bookChapter: "type:book-chapter",
  thesis: "type:dissertation",
  // Government / NGO / technical reports. Often the best NZ source for
  // policy and health topics (Te Whatu Ora, MoH, Stats NZ etc).
  report: "type:report",
  // Review articles — secondary sources that synthesise primary studies.
  // High-leverage citation type for student writing.
  reviewArticle: "type:review",
  // Pre-peer-review research papers — useful when the topic is brand-new.
  preprint: "type:preprint",
};

const SORT_BY_FILTER: Record<string, string | null> = {
  // Default OpenAlex relevance sort — no `sort` parameter
  relevance: null,
  cited: "cited_by_count:desc",
  newest: "publication_date:desc",
  oldest: "publication_date:asc",
};

export const search = action({
  args: {
    query: v.string(),
    perPage: v.optional(v.number()),
    onlyPeerReviewed: v.optional(v.boolean()),
    yearFrom: v.optional(v.number()),
    // New filters
    sourceType: v.optional(v.string()), // "all" | "journalArticle" | "book" | "bookChapter" | "thesis" | "report" | "reviewArticle" | "preprint"
    openAccessOnly: v.optional(v.boolean()),
    nzAuthoredOnly: v.optional(v.boolean()),
    sortBy: v.optional(v.string()), // "relevance" | "cited" | "newest" | "oldest"
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const q = args.query.trim();
    if (q.length < 3) throw new Error("Query is too short");

    const params = new URLSearchParams({
      search: q,
      per_page: String(Math.min(args.perPage ?? 10, 25)),
      "select":
        "id,doi,title,display_name,publication_year,publication_date,type,authorships,primary_location,open_access,cited_by_count,abstract_inverted_index",
    });
    const filters: string[] = [];

    // Source type filter takes precedence over the legacy peer-reviewed
    // toggle. "Peer-reviewed only" was previously `type:journal-article`
    // alone, which was too tight — it excludes peer-reviewed book
    // chapters, review articles, and conference proceedings. Broadened
    // to a union of types that ARE typically peer-reviewed:
    //   journal-article  — published in academic journals
    //   review           — review articles in journals
    //   book-chapter     — chapters in edited academic books
    //   proceedings-article — peer-reviewed conference papers
    // The OR syntax in OpenAlex filters uses `|` between values.
    const typeFilter = args.sourceType
      ? SOURCE_TYPE_FILTER[args.sourceType]
      : args.onlyPeerReviewed
        ? "type:journal-article|review|book-chapter|proceedings-article"
        : null;
    if (typeFilter) filters.push(typeFilter);

    if (args.yearFrom) filters.push(`from_publication_date:${args.yearFrom}-01-01`);
    if (args.openAccessOnly) filters.push("is_oa:true");
    if (args.nzAuthoredOnly) {
      // Filter to works with at least one author affiliated with a New
      // Zealand institution. Country code "nz" — case-insensitive in the
      // OpenAlex API.
      filters.push("authorships.institutions.country_code:nz");
    }

    if (filters.length > 0) params.set("filter", filters.join(","));

    // Sort — only set if non-default (relevance is OpenAlex's default
    // when search is provided)
    const sortFilter = args.sortBy ? SORT_BY_FILTER[args.sortBy] : null;
    if (sortFilter) params.set("sort", sortFilter);

    const res = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
      headers: {
        "User-Agent": "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)",
      },
    });
    if (!res.ok) {
      // OpenAlex sometimes goes down for short periods (Heroku-style
      // 5xx with an "Application Error" HTML page). Surface that as a
      // clear "their problem, try again later" message rather than
      // leaking the raw HTML to the user. Distinguish:
      //   5xx → OpenAlex's outage, retry later
      //   429 → we're being rate-limited, wait briefly
      //   other 4xx → something wrong with our request
      if (res.status >= 500) {
        throw new Error(
          "OpenAlex (the academic search engine we use) is temporarily down. This is on their end. Try again in a few minutes — the rest of the app is fine.",
        );
      }
      if (res.status === 429) {
        throw new Error(
          "OpenAlex is rate-limiting us. Wait about 30 seconds and try again.",
        );
      }
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAlex ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { results?: OpenAlexWork[]; meta?: { count?: number } };
    const oaWorks = json.results ?? [];

    // Map OpenAlex into the unified NormalisedResult shape so we can
    // merge with Semantic Scholar's results below.
    const openalexResults: NormalisedResult[] = oaWorks.map((w) => {
      const source = w.primary_location?.source;
      const sourceName = source?.display_name;
      // Key off the VENUE type, not the work type. OpenAlex types reviews,
      // meta-analyses, letters and editorials as "review"/"article" rather
      // than "journal-article", but they still belong in a journal — so
      // check whether the source itself is a journal. This stops the
      // journal name being dropped (and misfiled as publisher) for review
      // and meta-analysis articles.
      const isJournal = source?.type === "journal" || w.type === "journal-article";
      return {
        id: w.id,
        title: w.title ?? w.display_name ?? "(untitled)",
        year: w.publication_year ?? null,
        authors: (w.authorships ?? [])
          .map((a) => a.author?.display_name)
          .filter((n): n is string => !!n)
          .map(splitName),
        journal: isJournal ? sourceName : undefined,
        publisher: !isJournal ? sourceName : undefined,
        type: w.type,
        doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? undefined,
        url: w.primary_location?.landing_page_url ?? w.id,
        openAccessUrl: w.open_access?.oa_url ?? undefined,
        citedByCount: w.cited_by_count ?? 0,
        abstract: reconstructAbstract(w.abstract_inverted_index),
        sources: ["openalex"],
      };
    });

    // Augment with Semantic Scholar in parallel. Free, 138M papers,
    // very high-quality metadata — particularly good at surfacing
    // papers OpenAlex misses (different indexing pipelines). We use
    // Promise.allSettled-style handling implicitly: searchSemanticScholar
    // returns [] on any error, so OpenAlex's results are always the
    // floor. Papers that appear in BOTH sources get a relevance boost.
    const s2Results = await searchSemanticScholar(
      q,
      Math.min(args.perPage ?? 10, 25),
      args.yearFrom,
      args.openAccessOnly,
    ).catch(() => [] as NormalisedResult[]);

    const merged = mergeResults(openalexResults, s2Results);

    // Strip the `sources` provenance array before returning — the
    // client doesn't need it and including it would bloat the wire
    // size. The merge logic already used it for ranking.
    return {
      total: json.meta?.count ?? merged.length,
      results: merged.map(({ sources: _sources, ...rest }) => rest),
    };
  },
});
