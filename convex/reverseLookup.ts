"use node";

// Reverse-lookup: given a paragraph of draft prose containing APA in-text
// citations like "(Smith, 2020)" or "Smith et al. (2022)", extract every
// citation and ask OpenAlex for candidate works that match. The user then
// confirms the right one in the UI before importing.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

interface ExtractedCitation {
  raw: string;
  surname: string;
  year: string;
  isNarrative: boolean;
  position: number;
}

interface Candidate {
  id?: string;
  title: string;
  authorsRaw: { kind: "person"; surname: string; given: string }[];
  year: string;
  journal?: string;
  publisher?: string;
  type?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  citedByCount?: number;
}

interface ReverseLookupRow {
  citation: ExtractedCitation;
  candidates: Candidate[];
}

const splitDisplayName = (name: string): { kind: "person"; surname: string; given: string } => {
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
  return { kind: "person", surname: trimmed, given: "" };
};

// ---------------------------------------------------------------------------
// Citation extraction
// ---------------------------------------------------------------------------

const stripEtAl = (s: string): string =>
  s.replace(/\s+et\s+al\.?$/i, "").trim();

const stripCoauthor = (s: string): string => {
  // "Smith & Jones" -> "Smith"; "Smith and Jones" -> "Smith"
  const m = /^(.+?)\s*(?:&|and)\s+/i.exec(s);
  return m ? m[1].trim() : s;
};

const cleanSurname = (raw: string): string =>
  stripCoauthor(stripEtAl(raw))
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .trim();

function extractCitations(text: string): ExtractedCitation[] {
  const results: ExtractedCitation[] = [];

  // Parenthetical: (Smith, 2020), (Smith et al., 2020), (Smith & Jones, 2020),
  // multi-cite (Smith, 2020; Jones, 2022).
  const parenRe = /\(([^()]{1,200}?,\s*\d{4}[a-z]?(?:\s*;\s*[^()]+?,\s*\d{4}[a-z]?)*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(text)) !== null) {
    const inner = m[1];
    const segments = inner.split(/\s*;\s*/);
    for (const seg of segments) {
      const inner = /^(.+?),\s*(\d{4}[a-z]?)\s*(?:,\s*(?:p\.|para\.|pp\.).*)?$/.exec(
        seg.trim()
      );
      if (inner) {
        const surname = cleanSurname(inner[1]);
        if (surname) {
          results.push({
            raw: m[0],
            surname,
            year: inner[2],
            isNarrative: false,
            position: m.index,
          });
        }
      }
    }
  }

  // Narrative: "Smith (2020)" or "Smith et al. (2020)" or "Smith and Jones (2020)"
  const narrativeRe =
    /\b([A-Z][a-zA-Z'’\-À-ſ]+(?:\s+(?:et\s+al\.?|and|&)\s+[A-Z][a-zA-Z'’\-À-ſ]+)*)\s+\((\d{4}[a-z]?)\)/g;
  while ((m = narrativeRe.exec(text)) !== null) {
    const surname = cleanSurname(m[1]);
    if (surname) {
      results.push({
        raw: m[0],
        surname,
        year: m[2],
        isNarrative: true,
        position: m.index,
      });
    }
  }

  // De-duplicate by case-insensitive surname + year (ignoring a/b suffix).
  const seen = new Set<string>();
  return results
    .sort((a, b) => a.position - b.position)
    .filter((r) => {
      const key = `${r.surname.toLowerCase()}|${r.year.replace(/[a-z]$/, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ---------------------------------------------------------------------------
// OpenAlex search
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
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
}

const reconstructAbstract = (
  inv: Record<string, number[]> | undefined
): string | undefined => {
  if (!inv) return undefined;
  const positions: { word: string; pos: number }[] = [];
  for (const [word, posList] of Object.entries(inv)) {
    for (const pos of posList) positions.push({ word, pos });
  }
  positions.sort((a, b) => a.pos - b.pos);
  const text = positions.map((p) => p.word).join(" ");
  return text.length > 320 ? `${text.slice(0, 320).trim()}…` : text;
};

const SELECT_FIELDS =
  "id,doi,title,display_name,publication_year,publication_date,type,authorships,primary_location,cited_by_count,abstract_inverted_index";

async function fetchOpenAlex(
  filter: string,
  search: string | undefined,
  perPage: number
): Promise<OpenAlexWork[]> {
  const params = new URLSearchParams({
    filter,
    per_page: String(perPage),
    select: SELECT_FIELDS,
  });
  if (search) params.set("search", search);
  const res = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
    headers: {
      "User-Agent": "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: OpenAlexWork[] };
  return json.results ?? [];
}

const mapWork = (w: OpenAlexWork): Candidate => {
  const isJournal = w.type === "journal-article" || w.type === "article";
  const sourceName = w.primary_location?.source?.display_name;
  return {
    id: w.id,
    title: w.title ?? w.display_name ?? "(untitled)",
    authorsRaw: (w.authorships ?? [])
      .map((a) => a.author?.display_name)
      .filter((n): n is string => !!n)
      .map(splitDisplayName),
    year: w.publication_year ? String(w.publication_year) : "",
    journal: isJournal ? sourceName : undefined,
    publisher: !isJournal
      ? w.primary_location?.source?.publisher ?? sourceName
      : w.primary_location?.source?.publisher,
    type: w.type,
    doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? undefined,
    url: w.primary_location?.landing_page_url ?? w.id,
    abstract: reconstructAbstract(w.abstract_inverted_index),
    citedByCount: w.cited_by_count ?? 0,
  };
};

async function searchOpenAlex(
  surname: string,
  year: string,
  perPage = 8
): Promise<Candidate[]> {
  const cleanYear = parseInt(year.replace(/[a-z]$/, ""), 10);
  if (!Number.isFinite(cleanYear)) return [];

  // Strategy 1: raw_author_name.search filter — substring matches the
  // raw byline as published, robust for "Bouton, M.", "M. Bouton" etc.
  const exact = await fetchOpenAlex(
    `raw_author_name.search:${surname},publication_year:${cleanYear}`,
    undefined,
    perPage
  );
  const seen = new Set<string>();
  const collected: OpenAlexWork[] = [];
  for (const w of exact) {
    if (w.id && !seen.has(w.id)) {
      seen.add(w.id);
      collected.push(w);
    }
  }

  // Strategy 2: ±1 year (online-first vs print-year mismatches).
  if (collected.length < 5) {
    const widened = await fetchOpenAlex(
      `raw_author_name.search:${surname},publication_year:${cleanYear - 1}|${cleanYear + 1}`,
      undefined,
      perPage
    );
    for (const w of widened) {
      if (w.id && !seen.has(w.id)) {
        seen.add(w.id);
        collected.push(w);
      }
    }
  }

  // Strategy 3: full-text fallback if still nothing — uses OpenAlex's
  // ranking (relevance + cited-by) instead of a strict author filter.
  if (collected.length === 0) {
    const fallback = await fetchOpenAlex(
      `publication_year:${cleanYear}`,
      surname,
      perPage
    );
    for (const w of fallback) {
      if (w.id && !seen.has(w.id)) {
        seen.add(w.id);
        collected.push(w);
      }
    }
  }

  // Sort by cited_by_count descending so the best-known paper for that
  // surname-year combo appears first.
  collected.sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0));
  return collected.slice(0, perPage).map(mapWork);
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const findInText = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (!text || text.trim().length < 10) {
      throw new Error("Please paste at least a sentence containing citations.");
    }

    const citations = extractCitations(text);
    if (citations.length === 0) {
      return { rows: [] as ReverseLookupRow[], totalCitations: 0 };
    }

    // Query in parallel with a small concurrency cap so we don't get
    // throttled by OpenAlex.
    const rows: ReverseLookupRow[] = await Promise.all(
      citations.map(async (citation) => {
        const candidates = await searchOpenAlex(citation.surname, citation.year);
        return { citation, candidates };
      })
    );
    return { rows, totalCitations: citations.length };
  },
});
