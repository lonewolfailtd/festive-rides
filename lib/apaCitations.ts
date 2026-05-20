// Shared APA 7 in-text citation builder. Produces ready-to-paste
// parenthetical AND narrative forms from a paper's metadata plus an
// optional section/page hint. Used by:
//   - app/uni/sources/reader/ReaderClient.tsx (per-highlight buttons)
//   - app/uni/article-qa/ArticleQAClient.tsx (per-supporting-quote
//     buttons inside answers panel)
//
// Centralising means a citation-format fix lands everywhere at once.

export interface CitationBundle {
  // "(Smith, 2003, p. 422)" — drop in at the end of a paraphrased
  // sentence, or after a direct quote.
  parenthetical: string;
  // "Smith (2003, p. 422)" — use when the author name is part of
  // your prose ("Smith and Lowis (2003) found that...").
  narrative: string;
  // The page number extracted from the section string, if any. Null
  // when no page could be identified. The UI can use this to
  // conditionally show "Quote + cite" buttons.
  page: string | null;
}

// APA 7 author rules baked in:
//   1 author    → "Smith"
//   2 authors   → "Smith & Jones" (parens) / "Smith and Jones" (prose)
//   3+ authors  → "Smith et al." (both)
// Last names extracted whether the input is "Lastname, First" or
// "First Lastname". The function tolerates messy input gracefully.
export function buildCitations(opts: {
  authors: string[];
  year: number | null | undefined;
  section?: string;
}): CitationBundle {
  const lastNames = opts.authors
    .map((a) => {
      const trimmed = a.trim();
      if (!trimmed) return "";
      if (trimmed.includes(",")) {
        // "Brown, Cynthia" → "Brown"
        return trimmed.split(",")[0].trim();
      }
      // "Cynthia Brown" → "Brown" (last whitespace-separated token)
      const parts = trimmed.split(/\s+/);
      return parts[parts.length - 1];
    })
    .filter((n) => n.length > 0);

  // Page extraction from a "section" hint. Tries multiple formats:
  //   "p. 422", "pp. 415-426"          (APA short form)
  //   "page 8", "Page 8", "pages 4-10"  (long form)
  //   "[Page 8]"                        (pdfjs marker format — we
  //                                     inject these during extract,
  //                                     and the AI sometimes copies
  //                                     them verbatim into section)
  // Falls back to null when no page found.
  let page: string | null = null;
  if (opts.section) {
    // Order matters: long forms before short forms so "page" wins
    // over "p" alone. Word boundary `\b` prevents "stage 9" matching
    // — we don't want sentence words like "page" inside other words.
    let m = opts.section.match(
      /\[page\s+(\d+(?:[-–]\d+)?)\s*\]/i,
    );
    if (!m) {
      m = opts.section.match(
        /\bpages?\.?\s*(\d+(?:[-–]\d+)?)/i,
      );
    }
    if (!m) {
      m = opts.section.match(/\bpp?\.?\s*(\d+(?:[-–]\d+)?)/i);
    }
    if (m) page = m[1];
  }

  let parenAuthor: string;
  let narAuthor: string;
  if (lastNames.length === 0) {
    parenAuthor = "[author]";
    narAuthor = "[author]";
  } else if (lastNames.length === 1) {
    parenAuthor = lastNames[0];
    narAuthor = lastNames[0];
  } else if (lastNames.length === 2) {
    parenAuthor = `${lastNames[0]} & ${lastNames[1]}`;
    narAuthor = `${lastNames[0]} and ${lastNames[1]}`;
  } else {
    parenAuthor = `${lastNames[0]} et al.`;
    narAuthor = `${lastNames[0]} et al.`;
  }

  const yearStr = opts.year ? String(opts.year) : "n.d.";
  const pageSuffix = page ? `, p. ${page}` : "";

  return {
    parenthetical: `(${parenAuthor}, ${yearStr}${pageSuffix})`,
    // Narrative: page goes inside the parens after the year — e.g.
    // "Brown and Lowis (2003, p. 422)" — when a page is present.
    narrative: page
      ? `${narAuthor} (${yearStr}, p. ${page})`
      : `${narAuthor} (${yearStr})`,
    page,
  };
}
