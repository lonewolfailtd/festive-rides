"use node";

// Source Lens (Tier 1, abstract-based): assignment-aware source analysis.
//
// The student clicks a button on a Source Finder result. We take what
// we have (title + abstract + author/year + journal) AND the student's
// active assignment context (brief + rubric + outline if available),
// then produce a focused brief: "is this useful for YOUR assignment,
// and if so, which bits?"
//
// Tier 1 limitation: works from the abstract only, not the full paper.
// For papers with an open-access URL, Tier 2 (full-PDF deep read) is
// a planned follow-up. The student gets enough from the abstract to
// decide whether the paper's worth opening; Tier 2 will give them
// section-by-section quote extraction.
//
// Honest about its limits: the AI is told to flag uncertainty
// explicitly ("I can't tell from the abstract whether X") rather than
// guess. Better for a student to know "this looks promising, go read
// it" than to over-claim what's in a paper we haven't seen the body of.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callOpenRouterDetailed, safeJsonParse } from "./openrouter";

const SYSTEM_PROMPT = `You are a research assistant helping an Open Polytechnic NZ student decide whether a specific academic source is useful for their specific assignment, and if so, which bits matter. You analyse a single source against the student's actual assignment brief + rubric.

You only have the ABSTRACT of the source — not the full paper. Be explicit about that limitation. Do NOT invent claims, methods, or findings that aren't in the abstract.

OUTPUT (JSON, no markdown):
{
  "relevance": {
    "score": number,  // 0-10 honest estimate: how relevant is this source to THIS assignment?
    "verdict": "string — 1-2 sentence summary of why it is or isn't useful. Be specific. Reference the rubric/assignment topic explicitly."
  },
  "keyClaims": [
    "string — the 3-5 main claims or findings stated in the abstract. Use the abstract's own wording where possible."
  ],
  "quotablePhrases": [
    "string — 1-3 verbatim quotes from the abstract (5-25 words each) that the student might cite. Include speech marks. NEVER fabricate — only quote what literally appears in the abstract."
  ],
  "rubricFit": [
    {
      "criterion": "string — name the rubric criterion this paper might help with",
      "howItHelps": "string — 1-2 sentences explaining the connection",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "suggestedCitation": "string — one example of how the student could weave a cite of this source into their writing. Use APA in-text format e.g. 'Smith and Jones (2024) argued that…'. Keep it short (15-30 words). Set to empty string if you can't form a confident example.",
  "skipIfRubricRequires": [
    "string — list rubric requirements this source CANNOT help with. Helps the student decide whether to keep looking for a different source. Empty array if this source is broadly useful."
  ],
  "abstractLimitation": "string — 1 sentence noting what you'd need the full paper for. E.g. 'The abstract doesn't mention the specific intervention duration or sample size — read the methods section if those matter for your assignment.'"
}

NON-NEGOTIABLE RULES:

1. NEVER invent content. If the abstract says nothing about a topic, don't claim it does. If you're uncertain, say so in the verdict.

2. THE QUOTES MUST BE VERBATIM from the abstract — character-for-character. The student will paste them into their draft; making up wording is dangerous.

3. BE HONEST ABOUT THE RELEVANCE SCORE. A 0-3 verdict is fine — the student is better served by "this isn't relevant, move on" than a forced 7/10. Tell them when to skip.

4. RUBRIC FIT is GROUNDED. Don't say "this paper helps with criterion X" unless the abstract actually mentions content that addresses criterion X. Cite which sentence of the abstract makes the connection.

5. NZ ENGLISH in your prose. No Oxford commas. Use 'whānau' / 'Māori' / 'Pākehā' with macrons where relevant.

6. ASSUME ABSTRACT-ONLY. Note in 'abstractLimitation' what details you'd need the full paper for — methods, sample size, specific findings, particular sections of interest.`;

// Tier 2 system prompt — full-paper deep read. Bigger schema with
// section-by-section breakdown and paragraph-level verbatim quotes.
// Tells the model it HAS the full paper and so must NOT use abstract-
// only caveats. Page numbers come from pdfjs page indices baked into
// the section labels (e.g. "Methods (p. 4)").
const DEEP_SYSTEM_PROMPT = `You are a research assistant analysing the FULL TEXT of an academic paper against a specific student's assignment. Unlike abstract-only mode, you have the complete paper text — methods, results, discussion, the lot. Use that depth.

OUTPUT (JSON, no markdown):
{
  "relevance": {
    "score": number,  // 0-10 honest estimate
    "verdict": "string — 1-2 sentence summary of why it's useful (or not) for THIS assignment"
  },
  "sectionRelevance": [
    {
      "section": "string — e.g. 'Introduction', 'Methods', 'Results 3.2', 'Discussion (p. 12)'. Use the paper's own section headings where possible.",
      "relevance": "high" | "medium" | "low" | "skip",
      "summary": "string — 1-2 sentences on what this section contains and whether to read it"
    }
  ],
  "keyClaims": [
    "string — the 3-7 most important claims or findings in the paper. Use the paper's own wording where possible. These should be substantive (specific findings) not vague ('the paper discusses X')."
  ],
  "paragraphQuotes": [
    {
      "section": "string — which section the quote is from, e.g. 'Discussion (p. 10)'",
      "quote": "string — verbatim 20-80 word quote from the paper. MUST appear in the paper character-for-character. The student will paste this in their draft.",
      "whyItMatters": "string — 1 sentence on why this specific quote is useful for the student's assignment"
    }
  ],
  "quotablePhrases": [
    "string — 1-3 short verbatim phrases (5-20 words) suitable for in-line citation, separate from the longer paragraphQuotes"
  ],
  "rubricFit": [
    {
      "criterion": "string — name the rubric criterion this paper helps with",
      "howItHelps": "string — 1-2 sentences explaining how, with section reference where possible",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "suggestedCitation": "string — example in-text APA citation showing how to weave this source into a paragraph",
  "skipIfRubricRequires": [
    "string — what this paper CAN'T help with"
  ],
  "abstractLimitation": ""
}

NON-NEGOTIABLE RULES:

1. QUOTES MUST BE VERBATIM. Every paragraphQuote and quotablePhrase must appear in the paper text character-for-character. The student will paste them into their draft. DO NOT paraphrase, summarise, or invent — only quote.

2. NEVER invent claims. If the paper doesn't say something, don't claim it does. If you're uncertain about a finding, omit it.

3. SECTION LABELS should be specific. "Methods" is OK, but "Methods (p. 4)" is better if you can identify page numbers from the section structure.

4. PARAGRAPH QUOTES are the showcase feature of deep read. Aim for 3-6 of them, drawn from the most rubric-relevant parts of the paper. Each should be 20-80 words — long enough to be a real quotable unit, short enough to drop into a paragraph.

5. "abstractLimitation" must be empty string "" — this is the deep read, you have the full paper.

6. NZ ENGLISH. No Oxford commas. Use 'whānau' / 'Māori' / 'Pākehā' with macrons.

7. HONEST RELEVANCE. 0-3 is fine. Don't pad scores.

8. BE GROUNDED. Reference specific section content when explaining rubric fit, not generic "this paper talks about X".`;

// Helper: extract plain text from a PDF buffer using pdfjs-dist's
// Node-compatible legacy build. Returns text with rough newline
// preservation between pages. Caps total length to keep AI cost
// bounded. Throws a friendly error if the PDF has no extractable text
// (scanned image, encrypted etc).
async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import inside the function so the cold-start cost is paid
  // only on Tier 2 calls. Convex actions cache modules between invocations
  // so this only matters for the first call after a deploy.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    // Disable the worker — we're already in Node, no need for a
    // separate worker thread. pdfjs handles this gracefully.
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  // Cap pages to keep extraction fast — most papers are <30 pages,
  // and the AI only really uses the first 50 pages of context anyway.
  const maxPages = Math.min(pdf.numPages, 50);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(`[Page ${i}]\n${pageText}`);
  }
  const full = parts.join("\n\n");
  if (full.trim().length < 200) {
    throw new Error(
      "Could not extract text from this PDF — it may be a scanned image (no OCR), encrypted, or have unusual fonts. Try the abstract-only Lens instead.",
    );
  }
  // Cap to 200k chars (~50k tokens) — enough for any reasonable paper.
  return full.length > 200000 ? full.slice(0, 200000) : full;
}

// Tier 2 deep-read action. Fetches the OA PDF, extracts text, and
// runs a richer analysis with section-level breakdown and verbatim
// paragraph quotes. Pro model by default for long-context judgement.
export const deepRead = action({
  args: {
    sourceTitle: v.string(),
    sourceAuthors: v.array(v.string()),
    sourceYear: v.optional(v.number()),
    sourceJournal: v.optional(v.string()),
    sourcePdfUrl: v.string(), // OpenAlex's open_access.oa_url
    sourceDoi: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    assignmentBrief: v.optional(v.string()),
    assignmentRubric: v.optional(v.string()),
    assignmentName: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // 1) Fetch the PDF server-side (no CORS limits like client-side).
    // 60s timeout — academic PDFs can be slow to download, but if
    // they're taking that long we should give up and tell the user.
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 60_000);
    let arrayBuffer: ArrayBuffer;
    try {
      const res = await fetch(args.sourcePdfUrl, {
        headers: {
          "User-Agent":
            "UniCitationTool/1.0 (mailto:contact@lonewolfaisolutions.com)",
        },
        signal: fetchController.signal,
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            "The free PDF link is broken (404). The publisher may have moved it. Try the abstract-only Lens or search for another source.",
          );
        }
        if (res.status >= 500) {
          throw new Error(
            `The PDF host returned ${res.status}. Their server may be temporarily down. Try again in a few minutes.`,
          );
        }
        throw new Error(
          `Couldn't download the PDF (HTTP ${res.status}). Try the abstract-only Lens instead.`,
        );
      }
      // Sanity-check the content type — sometimes "open access" links
      // are actually landing pages, not PDFs.
      const contentType = res.headers.get("content-type") ?? "";
      if (
        !contentType.includes("pdf") &&
        !args.sourcePdfUrl.toLowerCase().endsWith(".pdf")
      ) {
        throw new Error(
          "That open-access link doesn't point to a PDF (it's a landing page). Try the abstract-only Lens, or open the link to find the actual PDF.",
        );
      }
      arrayBuffer = await res.arrayBuffer();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          "The PDF download timed out (over 60 seconds). The publisher's server is slow. Try again, or use the abstract-only Lens.",
        );
      }
      throw err;
    } finally {
      clearTimeout(fetchTimeout);
    }

    // 2) Extract text with pdfjs.
    const fullText = await extractPdfText(arrayBuffer);

    // 3) Build the user message and call the AI.
    const authorBlurb =
      args.sourceAuthors.length > 0
        ? args.sourceAuthors.join(", ")
        : "[authors not listed]";
    const yearBlurb = args.sourceYear ? String(args.sourceYear) : "[year unknown]";
    const journalBlurb = args.sourceJournal ? ` · ${args.sourceJournal}` : "";

    const sourceBlock = `=== SOURCE METADATA ===
Title: ${args.sourceTitle}
Authors: ${authorBlurb}
Year: ${yearBlurb}${journalBlurb}
${args.sourceDoi ? `DOI: ${args.sourceDoi}\n` : ""}${args.sourceType ? `Type: ${args.sourceType}\n` : ""}

=== FULL PAPER TEXT (extracted from PDF; [Page N] markers preserved) ===
${fullText}`;

    const assignmentBlock =
      args.assignmentBrief || args.assignmentRubric
        ? `\n\n=== STUDENT'S ASSIGNMENT ${args.assignmentName ? `(${args.assignmentName}) ` : ""}===
${args.assignmentBrief ? `BRIEF / TASK:\n${args.assignmentBrief.trim().slice(0, 4000)}\n\n` : ""}${args.assignmentRubric ? `RUBRIC:\n${args.assignmentRubric.trim().slice(0, 8000)}\n` : ""}`
        : `\n\n=== NO ASSIGNMENT CONTEXT PROVIDED ===
Analyse this paper as a general academic resource.`;

    const userContent = `${sourceBlock}${assignmentBlock}\n\nProduce the JSON output. Remember: verbatim quotes from the paper, no fabrication.`;

    // Pro by default — full-paper analysis is high-stakes and Pro's
    // long-context judgement is meaningfully better. Flash fallback
    // on transient / parse failures.
    const primaryModel = args.model ?? "deepseek/deepseek-v4-pro";

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
          { role: "system", content: DEEP_SYSTEM_PROMPT },
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
        primaryModel === "deepseek/deepseek-v4-pro"
          ? "deepseek/deepseek-v4-flash"
          : "deepseek/deepseek-v4-pro";
      try {
        const r = await callAndParse(fallbackModel);
        result = r.result;
        modelUsed = r.modelUsed;
        usage = r.usage;
      } catch {
        throw new Error(
          "Source Lens deep read couldn't analyse this paper — the AI returned incomplete results on both attempts. The paper may be unusually long or formatted strangely. Try the abstract-only Lens for a quicker summary.",
        );
      }
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "sourceLens.deepRead",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    // Mark this analysis as a deep read so the UI can surface the
    // section breakdown and suppress the abstract-only caveat.
    return { ...(result as Record<string, unknown>), deepRead: true };
  },
});

export const analyse = action({
  args: {
    // Source we're analysing
    sourceTitle: v.string(),
    sourceAuthors: v.array(v.string()),
    sourceYear: v.optional(v.number()),
    sourceJournal: v.optional(v.string()),
    sourceAbstract: v.string(),
    sourceDoi: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    // Optional assignment context (auto-pulled by client from active assignment)
    assignmentBrief: v.optional(v.string()),
    assignmentRubric: v.optional(v.string()),
    assignmentName: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    if (args.sourceAbstract.trim().length < 50) {
      throw new Error(
        "This source has no usable abstract — Source Lens needs an abstract to analyse. Try a different result, or open the paper to check it yourself.",
      );
    }
    if (args.sourceAbstract.length > 6000) {
      // Abstracts shouldn't be this long. Cap to keep input cost
      // bounded; the model gets the most informative bits at the
      // start of an abstract anyway.
      args = { ...args, sourceAbstract: args.sourceAbstract.slice(0, 6000) };
    }

    await ctx.runQuery(internal.usage.enforceQuota, { userId });

    // Build the user message with clear section markers. Assignment
    // context is optional — without it the analysis falls back to
    // generic "is this a good academic source?" mode.
    const authorBlurb =
      args.sourceAuthors.length > 0 ? args.sourceAuthors.join(", ") : "[authors not listed]";
    const yearBlurb = args.sourceYear ? String(args.sourceYear) : "[year unknown]";
    const journalBlurb = args.sourceJournal ? ` · ${args.sourceJournal}` : "";

    const sourceBlock = `=== SOURCE ===
Title: ${args.sourceTitle}
Authors: ${authorBlurb}
Year: ${yearBlurb}${journalBlurb}
${args.sourceDoi ? `DOI: ${args.sourceDoi}\n` : ""}${args.sourceType ? `Type: ${args.sourceType}\n` : ""}
Abstract:
${args.sourceAbstract.trim()}`;

    const assignmentBlock =
      args.assignmentBrief || args.assignmentRubric
        ? `\n\n=== STUDENT'S ASSIGNMENT ${args.assignmentName ? `(${args.assignmentName}) ` : ""}===
${args.assignmentBrief ? `BRIEF / TASK:\n${args.assignmentBrief.trim().slice(0, 4000)}\n\n` : ""}${args.assignmentRubric ? `RUBRIC:\n${args.assignmentRubric.trim().slice(0, 6000)}\n` : ""}`
        : `\n\n=== NO ASSIGNMENT CONTEXT PROVIDED ===
Analyse this source as a general academic resource — relevance, key claims, and whether it's a strong source on its own terms. Don't invent an assignment context to map it against.`;

    const userContent = `${sourceBlock}${assignmentBlock}\n\nProduce the JSON output. Be honest about what you can and can't tell from the abstract alone.`;

    // Flash by default — small structured output, no need for Pro.
    // Pro fallback on transient errors AND on JSON parse errors (Flash
    // occasionally returns empty or truncated output, which manifests
    // as a parse failure rather than an HTTP-level error).
    const primaryModel = args.model ?? "deepseek/deepseek-v4-flash";

    // Single-shot call helper — runs the model, returns parsed result.
    // Throws either an HTTP-level error or a parse error; the caller
    // decides whether to retry on the other model.
    async function callAndParse(model: string): Promise<{
      result: unknown;
      modelUsed: string;
      usage: { inputTokens: number; outputTokens: number };
    }> {
      const r = await callOpenRouterDetailed({
        model,
        responseFormatJson: true,
        temperature: 0.2,
        maxTokens: 2500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      // Treat empty / whitespace-only content the same as a parse
      // failure (Flash sometimes returns "" with status 200).
      if (!r.content || !r.content.trim()) {
        throw new Error("empty response");
      }
      const parsed = safeJsonParse(r.content);
      return { result: parsed, modelUsed: r.modelUsed, usage: r.usage };
    }

    function shouldRetryOnOtherModel(err: unknown): boolean {
      const msg = err instanceof Error ? err.message : "";
      return (
        msg.includes("empty response") ||
        msg.includes("no content") ||
        msg.includes("timed out") ||
        // Parse failures: Flash returned partial / malformed JSON.
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
      if (!shouldRetryOnOtherModel(err)) throw err;
      const fallbackModel =
        primaryModel === "deepseek/deepseek-v4-pro"
          ? "deepseek/deepseek-v4-flash"
          : "deepseek/deepseek-v4-pro";
      try {
        const r = await callAndParse(fallbackModel);
        result = r.result;
        modelUsed = r.modelUsed;
        usage = r.usage;
      } catch (secondErr) {
        // Both models failed. Friendly user-facing message — the
        // student doesn't need to see "Unexpected end of JSON input."
        throw new Error(
          "Source Lens couldn't analyse this source — the AI returned an incomplete response on both attempts. The abstract may be too short or hard to parse. Try a different result, or open the paper directly.",
        );
      }
    }

    await ctx.runMutation(internal.usage.recordUsage, {
      userId,
      action: "sourceLens.analyse",
      model: modelUsed,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return result;
  },
});
