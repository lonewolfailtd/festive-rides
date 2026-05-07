"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are an APA 7 reference parser for Open Polytechnic of New Zealand students. The student will paste a chunk of references in any format — Word doc reference list, EndNote export, mixed APA 6 + APA 7, poorly formatted bibliography, whatever. Your job is to extract every distinct reference and normalise it to strict APA 7.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "summary": "string — count of references parsed plus any notes (e.g. some entries had missing data)",
  "references": [
    {
      "sourceType": "journalArticle" | "book" | "bookChapter" | "webpage" | "report" | "thesis" | "newspaperArticle" | "other",
      "fields": {
        "authors": [{ "lastName": "Smith", "firstName": "Jane", "initials": "J." }],
        "year": "2020",
        "title": "...",
        "containerTitle": "Journal of X",
        "volume": "12",
        "issue": "3",
        "pages": "45-67",
        "doi": "10.1234/xyz",
        "url": "...",
        "publisher": "...",
        "edition": null,
        "place": null
      },
      "formatted": "the full APA 7 formatted reference string with proper italics indicated by *asterisks* around italicised parts",
      "inTextShort": "(Smith, 2020)",
      "inTextNarrative": "Smith (2020)",
      "sortKey": "smith2020",
      "issues": ["string — any data missing or guessed (e.g. 'no DOI provided', 'year unclear')"]
    }
  ]
}

Hard rules:
- Use NZ English in any prose you write (organise, behaviour, analyse, colour, recognise, programme).
- Do NOT use the Oxford comma in your prose.
- Follow APA 7 STRICTLY:
  - Italicise journal titles, book titles, report titles and webpage titles of standalone works. Mark italics with *asterisks* in the "formatted" string.
  - Do NOT italicise journal article titles or book chapter titles.
  - Use "&" before the final author inside parenthetical citations, "and" in narrative citations.
  - Year always in parentheses after authors: Smith, J. (2020).
  - Sentence case for article and chapter titles (only first word, first word after a colon, and proper nouns capitalised). Title case for journal titles.
  - For 21+ authors, list first 19, then ellipsis, then last author.
  - For 3+ authors in-text, use "Smith et al. (2020)" / "(Smith et al., 2020)".
  - Include DOI as a hyperlink-style URL: https://doi.org/10.1234/xyz
- If a field is unknown, use null and add a note to "issues".
- "sortKey" is lower-case last-name-of-first-author + year, e.g. "smith2020" — used for de-duping and sorting.
- Be conservative: if you can't tell whether something is one reference or two, split it and flag the issue.
- Do NOT invent data. If the year is missing, set year to null and add "year missing" to issues.`;

export const parse = action({
  args: {
    text: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = args.text.trim();
    if (trimmed.length < 50) {
      throw new Error("Please paste at least 50 characters of reference text.");
    }
    if (trimmed.length > 100000) {
      throw new Error(
        "Bibliography is very long — please trim to under 100000 characters or split into chunks."
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });
    const { content: raw, modelUsed, usage } = await callOpenRouterDetailed({
      // DeepSeek V4 Flash has a 1M-token context which matters for big
      // bibliographies — a 100k char paste plus the system prompt is fine.
      model: args.model ?? "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.1,
      maxTokens: 8000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `BIBLIOGRAPHY TO PARSE:\n${trimmed}` },
      ],
    });

    const parsed = safeJsonParse(raw);
    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "bibliographyImport.parse",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return parsed;
  },
});
