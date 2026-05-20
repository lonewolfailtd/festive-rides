"use node";

// Article Q&A: read a specific article PDF and answer specific
// assignment questions about it.
//
// Different from Source Lens (which judges relevance) — this tool
// extracts FACTS the student needs from an article they've already
// decided to use. Typical workflow: paste the article's full text
// (extracted client-side via pdfjs), paste the assignment's questions
// (verbatim from the brief), get answers grounded in verbatim quotes
// from the article.
//
// Hard product principle: this never writes the student's answer for
// them. It returns facts + verbatim supporting quotes. The student
// turns those into their own prose.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are a research assistant helping an Open Polytechnic NZ student answer specific questions about an academic article they're studying. They give you the full text of the article (extracted from a PDF) and a list of questions from their assignment. Your job: extract the factual answers from the article and provide verbatim supporting quotes the student can cite.

OUTPUT (JSON, no markdown):
{
  "articleSummary": "2-3 sentence summary of what the article is about and what it found",
  "authors": {
    "names": ["string — author names in publication order"],
    "affiliations": "string|null — university / institution affiliations if mentioned in the article",
    "credibilityNotes": "string — short paragraph the student can use to assess author credibility (qualifications, affiliations, prior work mentioned in article)"
  },
  "journal": {
    "name": "string|null — journal name if identifiable",
    "indexingNotes": "string — short paragraph on journal credibility indicators visible in the article (peer-review mentions, publisher, ISSN if shown)"
  },
  "apaReference": "string — best-effort APA 7 reference string built from the extracted metadata. Format: Author, A. A., Author, B. B., & Author, C. C. (Year). Title. Journal Name, Volume(Issue), pages. https://doi.org/... — Use what you can extract from the article. Mark unknown fields with [unknown].",
  "answers": [
    {
      "question": "string — VERBATIM repeat of the student's question",
      "answer": "string — direct answer drawn from the article, 1-3 sentences max. Be specific — name numbers, dates, instruments, demographics where the question asks for them.",
      "supportingQuotes": [
        {
          "quote": "string — verbatim quote from the article (10-50 words) that supports the answer. MUST be character-for-character from the article.",
          "section": "string — where in the article this quote came from, e.g. 'Method, p. 4', 'Discussion, paragraph 3', 'Abstract'"
        }
      ],
      "confidence": "high" | "medium" | "low",
      "notesForStudent": "string|null — short caveat for the student. Examples: 'The article doesn't directly state this; I inferred from X', 'Verify this from the methods section yourself', 'The article mentions this once in passing — strengthen by reading X paragraph'."
    }
  ],
  "missingQuestions": [
    "string — any questions the article doesn't contain enough information to answer. Empty array if all answered."
  ]
}

NON-NEGOTIABLE RULES:

1. NEVER FABRICATE. If the article doesn't say something, don't claim it does. If you can't find an answer in the article, put the question in 'missingQuestions' rather than guessing.

2. VERBATIM QUOTES ONLY. Every supportingQuote.quote must appear in the article character-for-character. Don't paraphrase, don't summarise — quote exactly. The student will paste these into their assignment and they MUST be real.

3. BE SPECIFIC. If the question asks "how many participants", give the number. If it asks "name a material", give the actual name. Don't hedge with "approximately" if the article gives a precise figure.

4. DON'T WRITE THE STUDENT'S ANSWER. Your 'answer' field is research notes — 1-3 sentences of factual extraction. The student takes these notes and writes their own paragraph. Don't produce essay-style prose.

5. NZ ENGLISH. -ise / -our / -re spellings. NO Oxford commas. Use 'whānau', 'Māori', 'Pākehā' with macrons where relevant.

6. APA REFERENCE: build the reference even if metadata is incomplete. Mark unknown fields with [unknown] rather than skipping the reference entirely. The student will fix gaps from the publisher's webpage.

7. CONFIDENCE CALIBRATION:
   - high — explicit, single-source answer from the article (e.g. "30 participants" stated directly)
   - medium — answer requires combining info from 2+ places, or is restated less directly
   - low — answer is inferred or article is ambiguous; flag in notesForStudent

8. SECTION REFERENCES — when the extracted text has [Page N] markers, USE them. Otherwise give the section heading ("Methods", "Discussion") or a paragraph reference.`;

// Companion action: given a stored assignment brief, extract the list
// of questions the student needs to answer. Cheap Flash-tier task —
// pure structure recognition (find the bullet lists, the question
// sentences in Part A / B etc), no judgement. ~$0.0002 per call.
const EXTRACT_SYSTEM_PROMPT = `You are reading an academic assignment brief. Identify every distinct question the student needs to answer when reading their assigned research article. Return them as a flat list — one question per array item, in the order they appear.

INCLUDE:
- Direct questions ("What is the aim of the research?")
- Imperative prompts that require an answer ("Summarise the method used in the article", "Identify one key finding", "Identify one limitation")
- Sub-points under a main bullet, broken out so each becomes its own item ("Number of participants", "Demographics", "Name of one material and two example items")

EXCLUDE:
- Formatting / structural instructions ("Write one paragraph", "Use APA format")
- Word count guidance
- Citation instructions
- General writing advice
- Instructions to generate the student's own research question or original content (those aren't extractable from the article)

OUTPUT (JSON, no markdown):
{
  "questions": [
    "string — one question per item, phrased clearly enough that the AI can answer it from a research article",
    ...
  ]
}

If the assignment has no article-related questions, return an empty array. Don't invent questions.

Use NZ English. No Oxford commas.`;

export const extractQuestions = action({
  args: {
    assignmentBrief: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const brief = args.assignmentBrief.trim();
    if (brief.length < 100) {
      throw new Error(
        "Assignment brief is too short — make sure the brief was loaded into the assignment via Quick Import.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Cap brief input — most Open Polytech briefs are 5-20k chars.
    const briefCapped = brief.length > 30000 ? brief.slice(0, 30000) : brief;

    const userContent = `=== ASSIGNMENT BRIEF ===
${briefCapped}

Extract the questions the student needs to answer when reading their research article.`;

    const r = await callOpenRouterDetailed({
      model: "deepseek/deepseek-v4-flash",
      responseFormatJson: true,
      temperature: 0.1, // very low — we want consistent extraction
      maxTokens: 2000,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    if (!r.content || !r.content.trim()) {
      throw new Error(
        "Couldn't extract questions from the brief — the AI returned an empty response. Try pasting the questions manually instead.",
      );
    }

    const parsed = safeJsonParse(r.content) as { questions?: string[] };

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "articleQA.extractQuestions",
      model: r.modelUsed,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
    });

    return {
      questions: parsed.questions ?? [],
    };
  },
});

export const answer = action({
  args: {
    extractedText: v.string(),
    questions: v.array(v.string()),
    assignmentBrief: v.optional(v.string()),
    assignmentName: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    if (args.extractedText.trim().length < 500) {
      throw new Error(
        "The extracted article text is too short — make sure the PDF extracted properly. If it's a scanned image, OCR isn't available; try a different copy of the article.",
      );
    }
    if (args.questions.length === 0) {
      throw new Error(
        "Paste at least one question. Copy them straight from your assignment brief.",
      );
    }
    if (args.questions.length > 20) {
      throw new Error(
        "Limit questions to 20 per run — too many at once dilutes the answers. Split into batches.",
      );
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Cap input text to 200k chars (~50k tokens) to keep costs bounded.
    const articleText =
      args.extractedText.length > 200000
        ? args.extractedText.slice(0, 200000)
        : args.extractedText;

    const questionsBlock = args.questions
      .map((q, i) => `${i + 1}. ${q.trim()}`)
      .join("\n");

    const assignmentBlock = args.assignmentBrief
      ? `\n\n=== ASSIGNMENT CONTEXT ${args.assignmentName ? `(${args.assignmentName}) ` : ""}===
${args.assignmentBrief.trim().slice(0, 4000)}\n`
      : "";

    const userContent = `=== ARTICLE FULL TEXT (extracted from PDF, [Page N] markers preserved) ===
${articleText}
${assignmentBlock}
=== STUDENT'S QUESTIONS ===
${questionsBlock}

Answer each question with facts from the article and verbatim supporting quotes. Never fabricate. Build the APA reference from the metadata you can find.`;

    // Gemini 2.5 Flash by default — this is a factual-extraction task
    // (find these facts in the article, quote them verbatim), not a
    // judgement task. Pro was 3-4× slower for no meaningful quality
    // gain: real-world test on a 12-page paper with 9 questions ran
    // 220+ seconds on Pro vs ~60s on Flash. Pro stays available via
    // the model arg for users who want extra rigour. Falls back the
    // other direction (Flash → Pro) on transient / parse failures.
    const primaryModel = args.model ?? "google/gemini-2.5-flash";

    async function callAndParse(model: string): Promise<{
      result: unknown;
      modelUsed: string;
      usage: { inputTokens: number; outputTokens: number };
    }> {
      const r = await callOpenRouterDetailed({
        model,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 8000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      if (!r.content || !r.content.trim()) {
        throw new Error("empty response");
      }
      const parsed = safeJsonParse(r.content);
      return { result: parsed, modelUsed: r.modelUsed, usage: r.usage };
    }

    function shouldRetry(err: unknown): boolean {
      const msg = err instanceof Error ? err.message : "";
      return (
        msg.includes("empty response") ||
        msg.includes("no content") ||
        msg.includes("timed out") ||
        msg.includes("Could not parse model output as JSON") ||
        msg.includes("Unexpected end of JSON") ||
        msg.includes("Unterminated string")
      );
    }

    let result: unknown;
    let modelUsed: string;
    let usage: { inputTokens: number; outputTokens: number };
    try {
      const r = await callAndParse(primaryModel);
      result = r.result;
      modelUsed = r.modelUsed;
      usage = r.usage;
    } catch (err) {
      if (!shouldRetry(err)) throw err;
      const fallbackModel =
        primaryModel === "google/gemini-2.5-pro"
          ? "google/gemini-2.5-flash"
          : primaryModel === "google/gemini-2.5-flash"
            ? "google/gemini-2.5-pro"
            : primaryModel === "deepseek/deepseek-v4-pro"
              ? "deepseek/deepseek-v4-flash"
              : "deepseek/deepseek-v4-pro";
      try {
        const r = await callAndParse(fallbackModel);
        result = r.result;
        modelUsed = r.modelUsed;
        usage = r.usage;
      } catch {
        throw new Error(
          "Article Q&A couldn't analyse this article — the AI returned incomplete results on both attempts. Try splitting your questions into smaller batches, or check that the PDF extracted text properly.",
        );
      }
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "articleQA.answer",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  },
});
