// ───────────────────────────────────────────────────────────────────────────
// STORY REGISTRY — the one place to add a new book to the shelf.
//
// To add a story:
//   1. Add an entry below with a unique `id`, a title, two spine colours, and
//      status "coming-soon".
//   2. Build its scenes (art + narration). When it's ready, flip status to
//      "published" and it becomes a clickable book on the shelf.
//
// The bookshelf + player are generic — every new entry "just works".
// ───────────────────────────────────────────────────────────────────────────

export type StoryStatus = "published" | "coming-soon";

export interface StoryMeta {
  id: string;
  title: string;
  subtitle?: string;
  /** Spine gradient (top → bottom), any CSS colour. */
  spineFrom: string;
  spineTo: string;
  /** Foil/letter colour on the spine. */
  ink: string;
  /** Relative spine height on the shelf (px) — vary it for a natural look. */
  height: number;
  status: StoryStatus;
}

export const STORIES: StoryMeta[] = [
  {
    id: "june",
    title: "Juniper's First Kiwi Adventure",
    subtitle: "Born under a Strawberry Moon",
    spineFrom: "#1e3a8a",
    spineTo: "#38bdf8",
    ink: "#eff6ff",
    height: 320,
    status: "published",
  },
  {
    id: "flight",
    title: "The Fantail Who Flew Her Home",
    subtitle: "A big flight home across the sea",
    spineFrom: "#155e75",
    spineTo: "#22d3ee",
    ink: "#ecfeff",
    height: 312,
    // Locked while the script is revised to the book-1 language rules
    // (English-only narration). Flip back to "published" when re-recorded.
    status: "coming-soon",
  },
  {
    id: "sleepy-kiwi",
    title: "The Sleepy Little Kiwi",
    spineFrom: "#7c2d12",
    spineTo: "#c2691b",
    ink: "#fff7ed",
    height: 300,
    status: "coming-soon",
  },
  {
    id: "pukeko-rainbow",
    title: "Pūkeko's Rainbow",
    spineFrom: "#9d174d",
    spineTo: "#ec4899",
    ink: "#fdf2f8",
    height: 310,
    status: "coming-soon",
  },
  {
    id: "up-the-maunga",
    title: "All the Way Up the Maunga",
    spineFrom: "#14532d",
    spineTo: "#22c55e",
    ink: "#f0fdf4",
    height: 290,
    status: "coming-soon",
  },
];

export const getStory = (id: string) => STORIES.find((s) => s.id === id);
