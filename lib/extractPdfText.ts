// Shared client-side PDF text extraction. Wraps the pdfjs flow that was
// previously copy-pasted across the uni tools (Checker, Editor, Analyser,
// Article Q&A, Submission Audit, Sources, Unpack, Quick Import): load
// pdfjs via the polyfill shim, size-check, page-by-page getTextContent,
// whitespace cleanup, min-length check and optional truncation.
//
// All failure modes throw an Error with a user-friendly message so
// callers can keep their existing `toast.error(getErrorMessage(err))` /
// setError catch handling unchanged.

import { loadPdfjs } from "@/lib/pdfjs";

export interface ExtractPdfTextOptions {
  /** Reject files larger than this many bytes (only applies to File input). */
  maxBytes?: number;
  /** Error message when the file exceeds maxBytes. */
  tooLargeMessage?: string;
  /** Only extract the first N pages (default: all pages). */
  maxPages?: number;
  /** Prefix each page's text with "[Page N]\n". */
  pageMarkers?: boolean;
  /** Throw if the cleaned text is shorter than this (default 0 = no check). */
  minChars?: number;
  /** Error message when the text is shorter than minChars. */
  minCharsMessage?: string;
  /** Truncate the cleaned text to this many characters. */
  maxChars?: number;
  /**
   * Progress callback. Called once with (0, total) after the document
   * loads, then (i, total) after each page, where total is the number of
   * pages that will actually be extracted (capped by maxPages).
   */
  onProgress?: (done: number, total: number) => void;
}

export interface ExtractPdfTextResult {
  /** Cleaned (and possibly truncated) extracted text. */
  text: string;
  /** Number of pages actually extracted (numPages capped by maxPages). */
  pages: number;
}

export async function extractPdfText(
  source: File | ArrayBuffer,
  opts: ExtractPdfTextOptions = {},
): Promise<ExtractPdfTextResult> {
  const {
    maxBytes,
    tooLargeMessage = "PDF over 20MB — please trim.",
    maxPages,
    pageMarkers = false,
    minChars = 0,
    minCharsMessage = "Could not pull text from this PDF — it might be image-based.",
    maxChars,
    onProgress,
  } = opts;

  if (maxBytes !== undefined && source instanceof File && source.size > maxBytes) {
    throw new Error(tooLargeMessage);
  }

  const pdfjs = await loadPdfjs();
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const total =
    maxPages !== undefined ? Math.min(doc.numPages, maxPages) : doc.numPages;
  onProgress?.(0, total);
  const parts: string[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const t = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(pageMarkers ? `[Page ${i}]\n${t}` : t);
    onProgress?.(i, total);
  }
  let text = parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
  if (text.length < minChars) {
    throw new Error(minCharsMessage);
  }
  if (maxChars !== undefined && text.length > maxChars) {
    text = text.slice(0, maxChars);
  }
  return { text, pages: total };
}
