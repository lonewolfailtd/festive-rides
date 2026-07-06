"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";
import { api, internal } from "./_generated/api";
import { logErrors } from "./errorLog";

// Citation Extractor — pulls every in-text citation out of a draft, then
// cross-checks them against the student's saved references list.
//
// Two failure modes we flag:
//   1. Cited in draft but missing from refs list — marker will dock marks.
//   2. In refs list but never cited — dead weight in the bibliography.
// Plus we surface paragraphs with zero citations so unsupported claims
// stand out.

const SYSTEM_PROMPT = `You are an APA 7 citation extractor for Open Polytechnic of New Zealand students.

The student will paste a draft. Your job is to identify every in-text citation in the draft. Be thorough — pick up parenthetical citations like "(Smith, 2020)" or "(Jones & Lee, 2018, p. 14)" AND narrative citations like "Smith (2020) argues..." or "According to Jones and Lee (2018)...".

Also flag any paragraph that contains zero citations — these are paragraphs of pure assertion that need a source.

Paragraphs are separated by one or more blank lines. Number them starting at 0.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "citations": [
    {
      "text": "string — the citation as it appears in the draft, e.g. (Smith, 2020) or Smith (2020)",
      "type": "parenthetical" | "narrative",
      "authorLast": "string — surname of the first author, or the group/organisation name",
      "year": "string — four-digit year, or 'n.d.' if no date",
      "page": "string — page number if given, otherwise null",
      "paragraphIndex": number
    }
  ],
  "paragraphsWithNoCitations": [number],
  "summary": "string — 2-3 sentences describing the citation pattern and any obvious gaps"
}

Hard rules:
- Use NZ English in the summary (organise, behaviour, analyse, colour).
- Do NOT use the Oxford comma in the summary.
- For "et al." citations, set authorLast to the first author's surname only.
- For group authors like "(Ministry of Health, 2022)", set authorLast to the full group name.
- Match years exactly as written. "n.d." stays as "n.d.".
- Don't invent citations. If the draft has none, return an empty citations array.`;

type AIOutput = {
  citations: {
    text: string;
    type: "parenthetical" | "narrative";
    authorLast: string;
    year: string;
    page: string | null;
    paragraphIndex: number;
  }[];
  paragraphsWithNoCitations: number[];
  summary: string;
};

type RefDoc = {
  _id: string;
  fields?: {
    authors?: { kind: "person"; surname: string; given: string }[] | { kind: "group"; name: string }[] | unknown[];
    year?: string;
    title?: string;
    [k: string]: unknown;
  };
  formatted?: string;
  inTextShort?: string;
};

// Pull a comparable surname out of a reference's first author. Group authors
// (organisations) use the group name. Falls back to empty string if missing.
function refAuthorLast(ref: RefDoc): string {
  const authors = ref.fields?.authors;
  if (!Array.isArray(authors) || authors.length === 0) return "";
  const first = authors[0] as { kind?: string; surname?: string; name?: string };
  if (first.kind === "group") return (first.name ?? "").trim();
  return (first.surname ?? "").trim();
}

function refYear(ref: RefDoc): string {
  return (ref.fields?.year ?? "").toString().trim();
}

// Loose match — lowercase, strip punctuation, allow a year like "2020a" to
// match "2020". Group authors can be long so we only check that one starts
// with the other.
function authorsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

function yearsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Allow "2020" to match "2020a" (APA letter suffix for same-year refs).
  const stripLetter = (s: string) => s.replace(/[a-z]$/, "");
  return stripLetter(na) === stripLetter(nb);
}

function refLabel(ref: RefDoc): string {
  if (ref.inTextShort && ref.inTextShort.trim()) return ref.inTextShort.trim();
  const author = refAuthorLast(ref) || "Unknown";
  const yr = refYear(ref) || "n.d.";
  return `${author} (${yr})`;
}

export const extract = action({
  args: {
    text: v.string(),
    assignmentId: v.optional(v.id("assignments")),
    model: v.optional(v.string()),
  },
  handler: logErrors("citations.extract", async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const trimmed = args.text.trim();
    if (trimmed.length < 100) {
      throw new Error("Please paste at least 100 characters of draft.");
    }
    if (trimmed.length > 50000) {
      throw new Error("Draft is too long — please trim to under 50000 characters or split into sections.");
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      model: args.model ?? "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.1,
      maxTokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `DRAFT TO EXTRACT CITATIONS FROM:\n\n${trimmed}` },
      ],
    });

    const parsed = safeJsonParse<AIOutput>(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "citations.extract",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    const paragraphsWithNoCitations = Array.isArray(parsed.paragraphsWithNoCitations)
      ? parsed.paragraphsWithNoCitations
      : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";

    // Pull the user's saved references for this assignment (or all of them
    // if no assignmentId was passed).
    const refs = (await ctx.runQuery(api.references.listForAssignment, {
      assignmentId: args.assignmentId,
    })) as RefDoc[];

    // Citations in the draft that don't match any reference in the list.
    const seen = new Set<string>();
    const missingFromRefList: string[] = [];
    for (const c of citations) {
      const key = `${c.authorLast.toLowerCase()}|${c.year.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const matched = refs.some(
        (r) =>
          authorsMatch(refAuthorLast(r), c.authorLast) &&
          yearsMatch(refYear(r), c.year)
      );
      if (!matched) {
        missingFromRefList.push(`${c.authorLast} (${c.year})`);
      }
    }

    // References saved but never cited — dead weight in the bibliography.
    const unusedRefs: { id: string; label: string }[] = [];
    for (const r of refs) {
      const ra = refAuthorLast(r);
      const ry = refYear(r);
      if (!ra) continue; // skip incomplete records
      const cited = citations.some(
        (c) => authorsMatch(ra, c.authorLast) && yearsMatch(ry, c.year)
      );
      if (!cited) {
        unusedRefs.push({ id: r._id, label: refLabel(r) });
      }
    }

    return {
      citations,
      paragraphsWithNoCitations,
      summary,
      missingFromRefList,
      unusedRefs,
      totalCitations: citations.length,
      totalRefs: refs.length,
    };
  }),
});
