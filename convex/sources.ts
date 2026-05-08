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
    sourceType: v.optional(v.string()), // "all" | "journalArticle" | "book" | "bookChapter" | "thesis"
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
    // toggle. "Peer-reviewed only" is effectively "journal articles only"
    // in OpenAlex parlance, so if the user has both, the explicit type
    // wins (it's more specific).
    const typeFilter = args.sourceType
      ? SOURCE_TYPE_FILTER[args.sourceType]
      : args.onlyPeerReviewed
        ? "type:journal-article"
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
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAlex ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { results?: OpenAlexWork[]; meta?: { count?: number } };
    const results = json.results ?? [];

    return {
      total: json.meta?.count ?? results.length,
      results: results.map((w) => {
        const sourceName = w.primary_location?.source?.display_name;
        const isJournal = w.type === "journal-article";
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
        };
      }),
    };
  },
});
