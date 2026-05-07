"use client";

// Client wrapper that listens for the active-assignment change event from
// WorkspaceBar and appends `?assignmentId=...` to each card's href so
// clicking through opens the tool already filtered to the right assignment.

import Link from "next/link";
import { useEffect, useState } from "react";

const ACTIVE_EVENT = "uni:active-assignment-changed";
const STORAGE_KEY = "uni-active-assignment-v1";

// Cards that already accept an assignmentId param. The Source Finder, AI
// Checker, Plagiarism check and Bibliography Importer will get the param
// too — they just ignore it if they don't use it, which is fine.
const PROPAGATE_TO = new Set([
  "/uni/references",
  "/uni/analyser",
  "/uni/coach",
  "/uni/sources",
  "/uni/citations",
  "/uni/bibliography",
]);

interface Card {
  href: string;
  title: string;
  blurb: string;
}

export default function DashboardCards({ cards }: { cards: Card[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setActiveId(stored);
    } catch {}
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setActiveId(detail);
    };
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_EVENT, onChange);
  }, []);

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {cards.map((c) => {
        const href =
          activeId && PROPAGATE_TO.has(c.href)
            ? `${c.href}?assignmentId=${encodeURIComponent(activeId)}`
            : c.href;
        return (
          <Link
            key={c.href}
            href={href}
            className="block rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-100 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none dark:hover:border-sky-700 dark:hover:bg-slate-900/80 dark:hover:shadow-none"
          >
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.blurb}</p>
            <span className="mt-3 inline-block text-sm text-sky-400">Open →</span>
          </Link>
        );
      })}
    </section>
  );
}
