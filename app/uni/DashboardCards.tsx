"use client";

// Tool cards grouped into three workflow stages: Plan / Research /
// Write & Review. Each group has a small eyebrow heading. The flat
// 8-card grid was hard to scan at a glance — a student opening the
// dashboard mid-assignment now finds the right tool by stage.
//
// Listens for the active-assignment change event from WorkspaceBar and
// appends `?assignmentId=...` to each card's href so clicking through
// opens the tool already filtered to the right assignment.

import Link from "next/link";
import { useEffect, useState } from "react";

const ACTIVE_EVENT = "uni:active-assignment-changed";
const STORAGE_KEY = "uni-active-assignment-v1";

const PROPAGATE_TO = new Set([
  "/uni/references",
  "/uni/analyser",
  "/uni/coach",
  "/uni/sources",
  "/uni/citations",
  "/uni/bibliography",
  "/uni/submission-audit",
]);

interface Card {
  href: string;
  title: string;
  blurb: string;
}

// Workflow groups. Order within a group is intentional — most-used first.
const GROUPS: { eyebrow: string; tagline: string; hrefs: string[] }[] = [
  {
    eyebrow: "Plan",
    tagline: "Decode the brief and map the work.",
    hrefs: ["/uni/analyser"],
  },
  {
    eyebrow: "Research",
    tagline: "Find sources and build your reference list.",
    hrefs: ["/uni/references", "/uni/sources", "/uni/bibliography"],
  },
  {
    eyebrow: "Write & Review",
    tagline: "Draft, score and check before you submit.",
    hrefs: [
      "/uni/coach",
      "/uni/editor",
      "/uni/checker",
      "/uni/citations",
      "/uni/plagiarism",
      "/uni/submission-audit",
    ],
  },
];

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

  const cardByHref = new Map(cards.map((c) => [c.href, c]));

  const renderCard = (c: Card) => {
    const href =
      activeId && PROPAGATE_TO.has(c.href)
        ? `${c.href}?assignmentId=${encodeURIComponent(activeId)}`
        : c.href;
    return (
      <Link
        key={c.href}
        href={href}
        className="group block rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_4px_8px_rgba(2,132,199,0.08),0_16px_40px_-12px_rgba(2,132,199,0.18)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:border-sky-700 dark:hover:bg-slate-900/80 dark:hover:shadow-[0_4px_8px_rgba(56,189,248,0.06),0_16px_40px_-12px_rgba(56,189,248,0.12)]"
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {c.title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {c.blurb}
        </p>
        <span className="mt-3 inline-block text-xs font-medium text-sky-600 transition-transform group-hover:translate-x-0.5 dark:text-sky-400">
          Open →
        </span>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const groupCards = group.hrefs
          .map((h) => cardByHref.get(h))
          .filter((c): c is Card => Boolean(c));
        if (groupCards.length === 0) return null;
        return (
          <section key={group.eyebrow}>
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                {group.eyebrow}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {group.tagline}
              </p>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupCards.map(renderCard)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
