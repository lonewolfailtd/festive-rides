# `/surprise` — June's Library (READ THIS FIRST, every agent)

This is a collection of **private, passcode-gated family storybooks** shown on an
animated bookshelf (`/surprise`). Books are added over time, **often by
different agents working in parallel.** You are responsible for **exactly one
book**. Read the rules before creating or editing anything.

---

## 🚦 The golden rule: stay inside your own book

> **You may ADD your own book and register it. You may NOT change another book's
> story, art, audio, or registry entry — ever.**

- Each book's bespoke code lives in its **own subfolder** under `app/surprise/`
  (e.g. `app/surprise/flight/`), with its art/audio under
  `public/surprise/<id>/`.
- **Never edit, rename, refactor, "improve", or delete another book's files or
  another book's registry row** — even to fix a bug or DRY things up. Those are
  finished gifts. If you think a shared change is genuinely needed, **stop and
  ask the human.**
- **Do not run or modify another book to "test" your work.** Verify only your
  own (see _Verifying_).

---

## 🏛️ How the library is wired (the shared spine)

| File | Role | May I edit? |
|------|------|-------------|
| `app/surprise/SurpriseClient.tsx` | Gate toggle → renders `<Library>`. | ❌ shared |
| `app/surprise/Library.tsx` | Shelf; clicking a book navigates to `/surprise/<id>`. | ❌ shared |
| `app/surprise/StoryPlayer.tsx` | Renders a book by `id`. | ⚠️ append-only: add **one** `if (id === "yours")` branch |
| `app/surprise/[storyId]/` | Per-book page (`/surprise/<id>`): gate check + open-book animation around `StoryPlayer`. Generic — no edit needed. | ❌ shared |
| `app/surprise/Bookshelf.tsx` | Renders every spine from the registry. Generic — no edit needed. | ❌ shared |
| `app/surprise/stories/registry.ts` | **The list of books.** | ⚠️ append-only: add **one** entry |
| `app/surprise/Gate.tsx`, `gate-config.ts`, `unlock/route.ts`, `SmoothScroll.tsx`, `layout.tsx` | Passcode, font, smooth-scroll. | ❌ shared — reuse by import only |
| `app/surprise/progress.ts` | Reading progress (localStorage). Shelf locks later books until the first published book is opened once; story pages record visits + show first-time "press play" help. | ❌ shared |

The two **⚠️ append-only** files are your integration points. Touch **only your
own added lines** there; leave every other book's lines exactly as they are.
(Yes, two agents appending to the same file can conflict — keep your diff to a
single contiguous block so it merges cleanly, and coordinate via the human if
needed.)

> Note: `Gate` is currently disabled (`GATE_ENABLED = false` in
> `gate-config.ts`) for testing. Do not flip it — the human re-enables it
> before sharing. The gate covers the shelf AND every `/surprise/<id>` page.

---

## 🛠️ How to add a NEW book (the recipe `flight` follows)

1. **Pick a unique `id`** (short lowercase, e.g. `flight`) and create
   `app/surprise/<id>/` for your code.
2. **Build your engine** in that folder — keep story copy as **data** in a
   `story.ts`, scenes/motion/playback in component files. You may copy the
   `flight/` book as a starting template (copying out is fine; editing the
   original is not).
3. **Put assets** under `public/surprise/<id>/` (e.g. `scenes/`, `audio/`).
   Never write into another book's `public/surprise/<other>/`.
4. **Register it** — append one entry to `STORIES` in `stories/registry.ts`
   (`id`, `title`, spine colours, `height`, `status`). Use
   `status: "coming-soon"` until your scenes are ready, then flip to
   `"published"` to make the spine clickable.
5. **Wire the player** — add one `if (id === "<id>")` branch to
   `app/surprise/StoryPlayer.tsx` returning your root component. Your book then
   lives at `/surprise/<id>` automatically. If your book runs its **own**
   Lenis (like `flight`'s `PlaybackProvider`), do **not** also wrap it in
   `<SmoothScroll>`.

### ⚠️ Gotcha: the open book sits inside a transformed ancestor

The story page (`[storyId]/StoryPageClient.tsx`) wraps the open story in a
`motion.div` with a persistent `transformPerspective`. A CSS transform on an
ancestor **breaks `position: fixed`** for descendants. If your book has viewport-pinned UI
(controls, progress bar), **render it through a React portal to
`document.body`** — see how `flight/FlightStory.tsx`'s `Controls` does it.
`position: sticky` is fine and needs no workaround.

## 🎨 House conventions

- **Stack:** Next.js App Router · Framer Motion (`useScroll`/`useTransform`) ·
  Lenis smooth scroll · Tailwind.
- **Font:** Fredoka via `var(--font-fredoka)` (from the shared layout).
- **One film everywhere (library standard):** every scene ships ONE set of
  assets — the **landscape (16:9)** still + clip — served identically on every
  device; phones centre-crop the same footage via `object-cover`. Do NOT make
  separate portrait variants: the owner wants mobile and desktop to show the
  exact same videos and animations. Compose scenes with the key subject near
  the centre so the phone crop keeps them in frame.
- **No text baked into generated images** — overlay titles/verses in the DOM.
- **Character consistency:** locked June references live in
  `public/surprise/characters/` (`june-master.jpg`, `june-sheet.jpg`, …) — feed
  them to the image model so she looks the same across books.
- **Privacy:** family-only. The shared layout sets `noindex`; keep it. No public
  links or share URLs.

## ✅ Verifying your work

- `npx tsc --noEmit` must be clean.
- View your book from the shelf at `/surprise` (Gate is off during testing).
- Before finishing, run `git status` and confirm **every change is inside your
  own `app/surprise/<id>/` and `public/surprise/<id>/`**, plus *only* your single
  appended entry in `registry.ts` and your single branch in `Library.tsx`.
  Anything else means you've strayed out of your lane.

---

### 📚 Books so far
| id | title | status |
|----|-------|--------|
| `june` | Juniper's First Kiwi Adventure | published 🔒 |
| `flight` | The Fantail Who Flew Her Home | published 🔒 |
| `sleepy-kiwi`, `pukeko-rainbow`, `up-the-maunga` | (placeholders) | coming-soon |

🔒 = finished, do not touch. Pick an `id` not already in `registry.ts`.
