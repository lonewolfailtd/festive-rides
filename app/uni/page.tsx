import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { ThemeToggle, PalettePicker } from "./ThemeProvider";
import WorkspaceBar from "./WorkspaceBar";
import DashboardCards from "./DashboardCards";
import GradesChart from "./GradesChart";
import Greeting from "./Greeting";
import QuickImport from "./QuickImport";

const cards = [
  {
    href: "/uni/analyser",
    title: "Assignment Analyser",
    blurb:
      "Paste your assignment brief and rubric. We work out what's actually being asked, suggest an outline, split your word count across sections and tell you what kinds of sources to find.",
  },
  {
    href: "/uni/references",
    title: "References",
    blurb:
      "Build a properly formatted APA 7 reference list. Paste a journal link, an ISBN or a DOI and we fill in the rest. Copy straight to Word with the right indents.",
  },
  {
    href: "/uni/sources",
    title: "Source Finder",
    blurb:
      "Search 250 million peer-reviewed papers and import any one of them as an APA 7 reference in one click. Filter by year and peer-review status.",
  },
  {
    href: "/uni/bibliography",
    title: "Bibliography Importer",
    blurb:
      "Got a messy reference list from a previous course or a Word doc? Paste it here and we convert every entry to APA 7, then add them all to your list at once.",
  },
  {
    href: "/uni/coach",
    title: "Draft Coach",
    blurb:
      "Paste your draft and get a marker-style score across structure, argument, evidence use, citation density and tone — with quotes from your own writing and what to change.",
  },
  {
    href: "/uni/checker",
    title: "AI Checker",
    blurb:
      "Find out what a Turnitin- or GPTZero-style detector would flag in your draft. Paragraph-by-paragraph scores, plus a tool that rewrites any flagged passage to sound more human.",
  },
  {
    href: "/uni/citations",
    title: "Citation Extractor",
    blurb:
      "Catches the classic marker-deduction trap: pulls every in-text citation from your draft, checks each one against your reference list and flags anything missing or never used.",
  },
  {
    href: "/uni/plagiarism",
    title: "Plagiarism Self-Check",
    blurb:
      "Spots phrases that sound copy-pasted or unusually distinctive — the stuff a real plagiarism scanner would flag. Each one comes with a Google search link so you can check yourself.",
  },
  {
    href: "/uni/editor",
    title: "NZ Editor",
    blurb:
      "Grammarly-style proofreader tuned for NZ English: catches US spellings, missing macrons on te reo Māori, Oxford comma slips, and weak essay structure. Tells you what's wrong, what to change it to, and why.",
  },
];

export default function UniHomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Decorative gradient orb that subtly tints the top-left of the dashboard. Pure CSS, no images. */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 -left-32 -z-10 h-96 w-96 rounded-full bg-gradient-to-br from-sky-200/40 via-sky-100/20 to-transparent blur-3xl dark:from-sky-900/30 dark:via-sky-950/15"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -right-32 -z-10 h-96 w-96 rounded-full bg-gradient-to-tl from-sky-200/30 via-sky-100/15 to-transparent blur-3xl dark:from-sky-900/25 dark:via-sky-950/10"
      />
      {/* Compact header — one row, top toolbar pulled into the same line so
          the workspace bar sits in the first viewport on mobile too. */}
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-y-3 gap-x-3">
        <div className="min-w-0 w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Uni Citation Tool
            <span className="block sm:inline sm:ml-2 mt-0.5 sm:mt-0 text-xs font-normal text-sky-600 dark:text-sky-400">
              · Open Polytechnic NZ · APA 7
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
          <PalettePicker />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <Greeting />

      {/* Quick Import — drop a brief PDF, the tool sets up everything. */}
      <section className="mb-6">
        <QuickImport />
      </section>

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
