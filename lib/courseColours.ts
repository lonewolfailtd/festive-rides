// Allowed palette for course colour-coding. The schema's `courses.colour`
// field is a free-form string but the UI only ever writes one of these
// keys, then maps the key to the matching Tailwind classes for chips and
// dots. Restricting to a small palette keeps the dashboard visually
// coherent even when a student tags 4-5 papers at once.
//
// We list every full Tailwind class as a literal string so the JIT
// compiler picks them up at build time — `bg-${key}-500` would be
// stripped because it's not statically detectable.

export type CourseColour =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

export type CourseColourEntry = {
  key: CourseColour;
  label: string;
  chipBg: string;
  chipText: string;
  dot: string;
};

export const COURSE_COLOURS: CourseColourEntry[] = [
  {
    key: "sky",
    label: "Sky",
    chipBg: "bg-sky-100 dark:bg-sky-900/40",
    chipText: "text-sky-800 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  {
    key: "emerald",
    label: "Emerald",
    chipBg: "bg-emerald-100 dark:bg-emerald-900/40",
    chipText: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    key: "amber",
    label: "Amber",
    chipBg: "bg-amber-100 dark:bg-amber-900/40",
    chipText: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  {
    key: "rose",
    label: "Rose",
    chipBg: "bg-rose-100 dark:bg-rose-900/40",
    chipText: "text-rose-800 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  {
    key: "violet",
    label: "Violet",
    chipBg: "bg-violet-100 dark:bg-violet-900/40",
    chipText: "text-violet-800 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  {
    key: "slate",
    label: "Slate",
    chipBg: "bg-slate-100 dark:bg-slate-800",
    chipText: "text-slate-800 dark:text-slate-200",
    dot: "bg-slate-500",
  },
];

export const DEFAULT_COURSE_COLOUR: CourseColour = "sky";

export function colourFor(key: string | undefined | null): CourseColourEntry {
  if (!key) return COURSE_COLOURS[0];
  const found = COURSE_COLOURS.find((c) => c.key === key);
  return found ?? COURSE_COLOURS[0];
}
