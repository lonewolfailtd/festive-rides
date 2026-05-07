import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { ThemeToggle } from "./ThemeProvider";
import PomodoroTimer from "./PomodoroTimer";

const cards = [
  {
    href: "/uni/references",
    title: "References",
    blurb:
      "Build APA 7 references for any source type. Auto-fill from DOI, ISBN or URL. Copy to Word with hanging indent. Edit, sort and download as .docx.",
  },
  {
    href: "/uni/analyser",
    title: "Assignment Analyser",
    blurb:
      "Paste your brief and rubric. Get the actual question, task verbs explained, suggested outline, word-count split and the source types you should be hunting for.",
  },
  {
    href: "/uni/coach",
    title: "Draft Coach",
    blurb:
      "Paste your draft. Get scored feedback on structure, argument, evidence, citation density and tone, plus specific improvements with quoted snippets.",
  },
  {
    href: "/uni/sources",
    title: "Source Finder",
    blurb:
      "Search 250M+ scholarly works on OpenAlex. Filter by peer-reviewed and year. One-click import a result as a properly formatted APA 7 reference.",
  },
  {
    href: "/uni/checker",
    title: "AI Checker",
    blurb:
      "Paste your draft (or upload PDF / Word doc) to see what a Turnitin / GPTZero-style detector would flag. Per-paragraph scores, AI tells, and a 'humanise this passage' rewrite tool.",
  },
  {
    href: "/uni/citations",
    title: "Citation Extractor",
    blurb:
      "Paste your draft. We pull out every in-text citation, cross-check them against your references list, and flag what's missing or unused before your marker does.",
  },
  {
    href: "/uni/plagiarism",
    title: "Plagiarism Self-Check",
    blurb:
      "Scan your draft for phrases that look templated, too distinctive, or copy-paste-flavoured. Get a Google search link for each one so you can verify before submission.",
  },
  {
    href: "/uni/bibliography",
    title: "Bibliography Importer",
    blurb:
      "Paste a chunk of references in any format and we'll parse each one to APA 7, then bulk-import them to your references list. Saves an hour of typing if you're moving from Word.",
  },
];

export default function UniHomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-4 flex items-center justify-end gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
      <header className="mb-10">
        <p className="text-sm font-medium text-sky-600 dark:text-sky-400">Open Polytechnic NZ · APA 7</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Uni Citation Tool</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Build APA 7 references, organise them per assignment, plan and
          polish your writing — and copy a properly formatted list straight
          into your assignment.
        </p>
      </header>

      <section className="mb-8">
        <PomodoroTimer />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-100 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none dark:hover:border-sky-700 dark:hover:bg-slate-900/80 dark:hover:shadow-none"
          >
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.blurb}</p>
            <span className="mt-3 inline-block text-sm text-sky-400">Open →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
