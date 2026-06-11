// Sanitiser for stored `formatted` reference strings before they reach an
// HTML sink (dangerouslySetInnerHTML, Word-export HTML).
//
// `formatted` has two provenances and only one is trustworthy:
//   - References built in-app store HTML from lib/apa7/format.ts — text is
//     escaped there and italics use <i> tags.
//   - References imported via the bibliography parser store the raw LLM
//     output string (asterisk-marked, unescaped), so the field as a whole
//     must be treated as untrusted.
//
// Strategy: escape ALL HTML, then re-allow only the bare italic tags APA
// formatting needs (<em>/</em> and <i>/</i>). Ampersands that already form
// one of the five entities our formatter emits (&amp; &lt; &gt; &quot; &#39;)
// are left intact so previously escaped text doesn't double-escape; every
// other ampersand is escaped. Those entities decode to plain characters, so
// preserving them is safe. No attributes survive — `<i onclick=…>` stays
// escaped because only the exact bare tag sequences are unescaped.
export function sanitizeFormatted(html: string): string {
  return html
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(em|i)&gt;/gi, "<$1$2>");
}
