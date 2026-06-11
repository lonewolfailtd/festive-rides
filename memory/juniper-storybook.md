# Project Memory — Juniper's Storybook 🌿

A private, animated, scroll-driven storybook gift for **Juniper Raine Petersen**
("June" / "Juney"), born **10 June 2025** under a Strawberry Moon. First birthday
**10 June 2026**. Lives in the USA; whānau in Aotearoa NZ. From Aunty Sammi &
Uncle Tane. Lives at `/surprise` on festiverides.online (a Next.js + Convex app).

---

## 🔒 CHARACTER CONSISTENCY (the most important rule)

**Base image (single source of truth):** `public/surprise/characters/june-master.jpg`

- **NEVER change:** her **face, facial features, and hair** — must always match the
  master image exactly. Do not add more/different hair than the master has.
- **OK to change per scene:** her **pose / position** (standing, sitting, crawling,
  walking, splashing, clapping…) and her **clothes** (blue is her signature colour,
  but outfits may vary to suit the scene).
- **How:** every new image is generated with `june-master.jpg` passed as the primary
  reference, instructing the model to keep face/hair identical and only change
  pose/outfit/setting.
- Retired: earlier character variations (v1/v2/v3, the no-hair/extra-hair takes) —
  ignore them; only `june-master.jpg` is canonical.

---

## 🎨 Art & motion

- **Style:** soft glossy 3D, Pixar-ish — big expressive eyes, subsurface skin,
  cinematic soft light, wholesome and magical. No text/logos baked into images.
- **Responsive art direction:** every scene generated in BOTH 9:16 (phone) and 16:9
  (desktop); the page serves the right one per screen.
- **Variety rule:** different place + active pose every scene — never just sitting,
  never repeat a setting.
- **Scroll = camera:** Lenis smooth scroll + Framer Motion (parallax / push-in / pan).
  Guided-cinematic feel. GSAP + FFmpeg frame-scrub reserved for hero moments.

## 🎙️ Narration & subtitles (ElevenLabs)

- **Voice:** Kylee — NZ female storyteller (`voice_id pcKdPWtbF6bM9o7NHjCI`).
- **Settings:** model `eleven_multilingual_v2`, stability ~0.55, similarity 0.75,
  style 0.3, speaker_boost on, **speed = TBD (1.10 vs 1.18 — awaiting pick)**.
- **Subtitles** along the bottom, synced from ElevenLabs timestamps.
- **June's name is always coloured BLUE** wherever it appears (titles + subtitles).
- **Māori pronunciation** — subtitles keep correct macrons; the SPOKEN text uses
  respellings so Kylee says them right:
  | Word | Respelling |
  |---|---|
  | Aotearoa | Ah-oh-teh-ah-roh-ah |
  | pīwakawaka | pee-wah-kah-wah-kah |
  | kea | keh-ah |
  | pūkeko | poo-keh-koh |
  | kiwi | kee-wee |
  | kia ora | kee-ah or-ah |
  | whānau | fah-noh |
  | maunga | mow-ngah |
- API key supplied by user — use via env var only, NEVER commit it.

## 📚 Architecture

- **Bookshelf / Library** is the landing (`/surprise` → `SurpriseClient` → `Library`):
  an animated wooden shelf of "books" (stories). Add stories via
  `app/surprise/stories/registry.ts` (id, title, spine colours, status). Flip a
  story to `status:"published"` and it becomes a clickable book.
- June's story = first book (`id: "june"`), rendered by `app/surprise/Story.tsx`.
- Passcode gate: code `JuniperRaine`, server-checked at `/surprise/unlock`.
  **ENABLED** (launched).

## ⚙️ Working rules (workflow)

- **DO NOT push/merge/deploy to GitHub unless the user explicitly asks.** Work
  locally; preview via `npm run dev` (http://localhost:3000/surprise).
- `.env.local` holds public Convex URLs for local dev (gitignored).
- Deadline: **10 June 2026 (June's 1st birthday).**

## 📖 STORYLINE (NEW — real first-year memories, replaces the Kiwi adventure)

Working title: *Juniper's First Year — from a Strawberry Moon to Aotearoa*.
Tone: warm, spoken **to** June ("the night you were born…"), a keepsake. Real
memories across NZ + USA. 10 slides:

1. **Born under a Strawberry Moon** (USA, night) — newborn, the 10th of June.
2. **FaceTime with whānau** — NZ family round a screen ↔ June + parents in the US.
3. **Six months / daycare** — crawling, giggling, happy daycare days.
4. **First flight** — Air New Zealand, parents wheeling her in the pram.
5. **Meeting whānau in NZ** — lounge: Mum, Dad, Aunty Sammi, Uncle Tane, Sammi's parents.
6. **First Christmas** — Kiwi summer, presents on the deck in wicker chairs.
7. **Bath in the kitchen sink** — three primary-colour toy fish.
8. **Picnic at Tomarata** — their 2 ha bare land, big green views.
9. **Family photos at Browns Bay** — pōhutukawa, toes in the water, laughing.
10. **Goodbye at the airport** — the whole family farewell.

Extra Māori for the pronunciation map: pōhutukawa → `paw-hoo-too-KAH-wah`;
haere rā → `high-reh RAH`.

## ✅ Locked decisions

- **Family names:** Mum = **Beks**, Dad = **Jacob**, Nana = **Shelly**, Poppa = **Scott**,
  plus Aunty Sammi & Uncle Tane.
- **Script style:** bouncy RHYMING nursery-book verse, third person. ENGLISH ONLY —
  no Māori words in audio or subtitles (pronunciation was off). NO em dashes or
  ellipses (they cause pauses + user dislikes them).
- **Her name:** written **"June"** (no y) everywhere on screen; SPOKEN as "Junie"
  (feed the voice the spelling "Junie"). Full name Juniper Raine.
- **Narration:** Voice **Kylee NZ** (`pcKdPWtbF6bM9o7NHjCI`), **speed 1.0** (natural,
  relaxed — user picked this after trying 1.10 and several other voices).
  Spoken respellings: "Junie" (for June), "Tah-neh" (for Tane).
- **Adults = Pixar recreations** from the family's photos (photos are INSPIRATION ONLY,
  never shown in the book). **Locked cast designs** (use as the reference per person):
  `public/surprise/characters/cast-{mum,dad,nana,poppa,sammi,tane}.jpg`.
  Real source photos live in git-ignored `.people-refs/` (never committed/public).
- **Places:** stylised — no real-location matching needed.
- **June:** master face/hair throughout, age-appropriate per slide.
- All art generated from `june-master.jpg` + each person's locked design.

## 🎬 Video production pipeline (how we make the short "movie")

Each story is ALSO compiled into a short narrated video (not only the
scroll-web experience). The web stills double as the video's keyframes.

**Pipeline (still → motion → film):**
1. **Stills** — generate each scene with Nano Banana Pro (`image-gen` skill /
   `generate.sh`), June locked to `june-master.jpg` (pass it as the reference).
   Both 9:16 + 16:9. These are the keyframes.
2. **Motion** — animate each still into a short clip with **fal.ai** (user has it
   connected). Use the global **`genvid`** CLI (`genvid` skill → fal.ai Seedance,
   image-to-video; defaults Pro/1080p). One short clip per scene/frame; describe
   the camera move + gentle subject motion in the prompt.
3. **Stitch** — concatenate the per-scene clips in order, lay the ElevenLabs
   narration (Kylee NZ) over the top, burn/sync the subtitles, and add gentle
   crossfades, into one short film (ffmpeg).

**Notes / conventions:**
- "Lots of little frame shots, made together" = generate many short scene clips,
  then assemble — don't try to one-shot a long video.
- Keep character consistency: motion clips inherit the still's locked June face;
  don't let the video model drift her features.
- fal.ai usage is via the user's connected account — never hard-code keys.
- Book 2 (`flight`) is the current pilot for this pipeline; the same steps apply
  to every book on the shelf.
