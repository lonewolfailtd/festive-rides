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

export const search = action({
  args: {
    query: v.string(),
    perPage: v.optional(v.number()),
    onlyPeerReviewed: v.optional(v.boolean()),
    yearFrom: v.optional(v.number()),
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
    if (args.onlyPeerReviewed) filters.push("type:journal-article");
    if (args.yearFrom) filters.push(`from_publication_date:${args.yearFrom}-01-01`);
    if (filters.length > 0) params.set("filter", filters.join(","));

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
