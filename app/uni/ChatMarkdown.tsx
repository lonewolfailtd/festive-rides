"use client";

// Minimal, safe Markdown renderer shared by the dashboard tutor and the
// per-page "ask about this result" panels. Handles bold, inline code,
// bullet lists and paragraphs, rendered as React elements (no HTML
// injection, no dependency). Enough for the tutors' replies.

function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-800">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

export default function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (list.length === 0) return;
    const items = [...list];
    blocks.push(
      <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList(`ul-${i}`);
    if (line.trim() === "") return;
    blocks.push(
      <p key={`p-${i}`} className="my-1">
        {renderInline(line, `p-${i}`)}
      </p>,
    );
  });
  flushList("ul-last");
  return <>{blocks}</>;
}
