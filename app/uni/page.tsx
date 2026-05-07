import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { ThemeToggle } from "./ThemeProvider";
import WorkspaceBar from "./WorkspaceBar";
import DashboardCards from "./DashboardCards";
import GradesChart from "./GradesChart";

const cards = [
  {
    href: "/uni/analyser",
    title: "Assignment Analyser",
    blurb:
      "Paste your brief and rubric. Get the question decoded, suggested outline, word-count split and source types you should be hunting for.",
  },
  {
    href: "/uni/references",
    title: "References",
    blurb:
      "Build APA 7 references for any source type. Auto-fill from DOI, ISBN or URL. Copy to Word with hanging indent.",
  },
  {
    href: "/uni/sources",
    title: "Source Finder",
    blurb:
      "Search 250M+ scholarly works on OpenAlex. Filter by peer-reviewed and year. One-click import as APA 7.",
  },
  {
    href: "/uni/bibliography",
    title: "Bibliography Importer",
    blurb:
      "Paste a chunk of references in any format and we'll parse each one to APA 7, then bulk-import them.",
  },
  {
    href: "/uni/coach",
    title: "Draft Coach",
    blurb:
      "Paste your draft. Get scored feedback on structure, argument, evidence, citation density and tone.",
  },
  {
    href: "/uni/checker",
    title: "AI Checker",
    blurb:
      "See what a Turnitin / GPTZero-style detector would flag. Per-paragraph scores, AI tells, humanise tool.",
  },
  {
    href: "/uni/citations",
    title: "Citation Extractor",
    blurb:
      "Pulls every in-text citation, cross-checks them against your references list and flags missing or unused.",
  },
  {
    href: "/uni/plagiarism",
    title: "Plagiarism Self-Check",
    blurb:
      "Scan your draft for phrases that look templated or too distinctive. Google search link for each so you can verify.",
  },
];

export default function UniHomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Compact header — one row, top toolbar pulled into the same line so
          the workspace bar sits in the first viewport on mobile too. */}
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Uni Citation Tool
            <span className="ml-2 text-xs font-normal text-sky-600 dark:text-sky-400">
              · Open Polytechnic NZ · APA 7
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/uni/calendar"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            <span aria-hidden>📅</span> Calendar
          </Link>
          <Link
            href="/uni/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            <span aria-hidden>⚙</span> Settings
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Workspace bar + grades chart sit side-by-side on lg+ so they share
          one visual row instead of stacking. On mobile they stack naturally
          via grid-cols-1 default. */}
      <section className="mb-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <WorkspaceBar />
        <GradesChart />
      </section>

      <DashboardCards cards={cards} />
    </main>
  );
}
