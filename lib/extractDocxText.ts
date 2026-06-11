// Shared client-side .docx text extraction via Mammoth's browser bundle.
// Wraps the flow previously copy-pasted across the uni tools (Checker,
// Editor, Submission Audit, Quick Import). Failure modes throw an Error
// with a user-friendly message so callers keep their existing catch
// handling unchanged.

export interface ExtractDocxTextOptions {
  /** Reject files larger than this many bytes. */
  maxBytes?: number;
  /** Error message when the file exceeds maxBytes. */
  tooLargeMessage?: string;
  /** Throw if the extracted text is shorter than this (default 0 = no check). */
  minChars?: number;
  /** Error message when the text is shorter than minChars. */
  minCharsMessage?: string;
  /** Truncate the extracted text to this many characters. */
  maxChars?: number;
}

export async function extractDocxText(
  file: File,
  opts: ExtractDocxTextOptions = {},
): Promise<string> {
  const {
    maxBytes,
    tooLargeMessage = "Word doc over 20MB — please trim.",
    minChars = 0,
    minCharsMessage = "Could not pull text from this Word doc.",
    maxChars,
  } = opts;

  if (maxBytes !== undefined && file.size > maxBytes) {
    throw new Error(tooLargeMessage);
  }

  // Import the browser bundle explicitly to avoid Node-only deps.
  const mammoth = await import("mammoth/mammoth.browser");
  const buffer = await file.arrayBuffer();
  const out = await mammoth.extractRawText({ arrayBuffer: buffer });
  let text = (out.value ?? "").trim();
  if (text.length < minChars) {
    throw new Error(minCharsMessage);
  }
  if (maxChars !== undefined && text.length > maxChars) {
    text = text.slice(0, maxChars);
  }
  return text;
}
