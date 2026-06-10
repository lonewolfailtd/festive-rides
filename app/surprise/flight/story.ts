// "The Fantail Who Flew Her Home" — book 2 (story codename: flight).
//
// Single source of truth for the 15-frame story. Each STOP has three frames:
//   A = arriving at the new place, B = meeting the friend, C = the big moment.
// The verse doubles as the ElevenLabs narration AND the on-screen subtitles
// (revealed two lines at a time). Art is placeholder for now — the 30
// art-directed images (portrait + landscape) and 15 narration clips drop in
// later. This file never imports anything from book 1.

export type MotionKind = "pan" | "push-in" | "parallax" | "finale";

export interface Frame {
  /** Frame id from the storyline, e.g. "1A". */
  id: string;
  /** Which stop this frame belongs to (place name). */
  stop: string;
  /** Short scene label shown as a chip, e.g. "the orchard". */
  title: string;
  /** Camera recipe for this frame. */
  motion: MotionKind;
  /** Four-line quatrain. Lines 0–1 = subtitle pair A, lines 2–3 = pair B. */
  verse: [string, string, string, string];
  /** Narration clip (stub path — file added in the audio phase). */
  audio: string;
  /** Fallback pacing for read-along mode while audio is still silent (ms). */
  durationMs: number;
  /** Art-directed placeholders: portrait (phones) + landscape (desktop). */
  portrait: string;
  landscape: string;
}

// Scene art: portrait (9:16, phones) + landscape (16:9, desktop) per frame,
// generated on-model from june-master.jpg. Files in public/surprise/flight/scenes/.
const art = (id: string) => ({
  portrait: `/surprise/flight/scenes/${id}-portrait.jpg`,
  landscape: `/surprise/flight/scenes/${id}-wide.jpg`,
});

// Locked character descriptors (for the art phase — paste word-for-word into
// each frame's prompt). Kept here so the story and its art stay in one place.
export const CHARACTERS = {
  piwakawaka:
    "tiny round New Zealand fantail bird, charcoal-brown head, cream-yellow chest, white eyebrow stripe, long black-and-white tail spread like a hand fan, big glossy black eyes, cheerful expression",
  caterpillar:
    "plump friendly caterpillar, bright green segmented body, friendly green rounded face with soft rosy cheeks (green face, not red), big happy eyes, tiny feet",
  cocoon: "small brown cocoon strapped to the fantail's back",
  butterfly:
    "friendly butterfly with large emerald-and-teal wings patterned with koru swirls, big happy eyes",
  sparkleFish:
    "beautiful ocean-blue fish with soft violet flowing fins, pearly iridescent scales, one oversized glittering rainbow scale, long gentle lashes",
  jar: "round clear glass jar of seawater with a cork lid and rope handle",
  gecko: "small bright-green gecko with turquoise spots",
  crab: "orange-red coconut crab with one oversized claw",
  tern: "white tern seabird with a black eye-mask",
  dogs: [
    "small wiry black terrier with flyaway scruffy fur (the leader)",
    "huge gentle brown mastiff",
    "white dalmatian covered in black spots",
    "shaggy grey sheepdog like a walking mop",
    "low long dachshund with a round saggy tummy",
  ],
  digger:
    "small cheerful cartoon yellow excavator with tracks, bucket arm, friendly headlight eyes, mud freckles",
  kiwi:
    "round fluffy brown kiwi bird, shaggy streaked feathers, long pale beak, warm gentle eyes (plain head, no leaf or fern)",
  tree: "tiny pōhutukawa sapling in fresh soil with a red ribbon bow",
} as const;

export const STOPS = [
  "America",
  "Hawai'i",
  "Rarotonga",
  "Northland",
  "Tomarata",
] as const;

export const FRAMES: Frame[] = [
  // ── STOP 1 · America ────────────────────────────────────────────────
  {
    id: "1A",
    stop: "America",
    title: "the window",
    motion: "pan",
    verse: [
      "Tap, tap, tap! The sun peeks through —",
      "a little bird has come for you!",
      "“Happy birthday, Juniper dear!",
      "Your friends are waiting — far from here!”",
    ],
    audio: "/surprise/flight/audio/1A.mp3",
    durationMs: 8000,
    ...art("1A"),
  },
  {
    id: "1B",
    stop: "America",
    title: "the orchard",
    motion: "push-in",
    verse: [
      "Munch, munch, munch! What’s that sound?",
      "A caterpillar, green and round!",
      "One apple, two plums, three pears more —",
      "“I’m still hungry! More, more, more!”",
    ],
    audio: "/surprise/flight/audio/1B.mp3",
    durationMs: 8000,
    ...art("1B"),
  },
  {
    id: "1C",
    stop: "America",
    title: "the strawberry & takeoff",
    motion: "parallax",
    verse: [
      "Juniper shares her strawberry — yum!",
      "“Thank you, friend! Yum, yum, yum!”",
      "He spins himself a sleepy bed,",
      "and off they fly, straight ahead!",
    ],
    audio: "/surprise/flight/audio/1C.mp3",
    durationMs: 8000,
    ...art("1C"),
  },

  // ── STOP 2 · Hawai'i ────────────────────────────────────────────────
  {
    id: "2A",
    stop: "Hawai'i",
    title: "the lagoon",
    motion: "pan",
    verse: [
      "Fly, fly, over the blue,",
      "the sea below, the sky so new!",
      "Down they swoop to a warm little bay —",
      "Hawai’i! What a place to play!",
    ],
    audio: "/surprise/flight/audio/2A.mp3",
    durationMs: 8000,
    ...art("2A"),
  },
  {
    id: "2B",
    stop: "Hawai'i",
    title: "the lonely fish",
    motion: "push-in",
    verse: [
      "Splish, splash! Who swims alone?",
      "A sparkly fish with no friends of her own.",
      "Juniper waves: “Come play with me!”",
      "The fish lights up, so happy — whee!",
    ],
    audio: "/surprise/flight/audio/2B.mp3",
    durationMs: 8500,
    ...art("2B"),
  },
  {
    id: "2C",
    stop: "Hawai'i",
    title: "the gift & the jar",
    motion: "parallax",
    verse: [
      "“Here’s my sparkle, just for you —",
      "a birthday gift, all shiny and new!”",
      "They scoop her up in a jar of sea —",
      "“Now we’re friends! Come home with me!”",
    ],
    audio: "/surprise/flight/audio/2C.mp3",
    durationMs: 8500,
    ...art("2C"),
  },

  // ── STOP 3 · Rarotonga ──────────────────────────────────────────────
  {
    id: "3A",
    stop: "Rarotonga",
    title: "the green island",
    motion: "pan",
    verse: [
      "Fly, fly, friends side by side,",
      "over the waves where dolphins glide!",
      "A green, green island, tall and steep —",
      "“Let’s climb the mountain! Up we creep!”",
    ],
    audio: "/surprise/flight/audio/3A.mp3",
    durationMs: 8000,
    ...art("3A"),
  },
  {
    id: "3B",
    stop: "Rarotonga",
    title: "friends join the climb",
    motion: "push-in",
    verse: [
      "Up, up, up the mountain track,",
      "new friends following at the back!",
      "A gecko, a crab, a bird so white —",
      "holding hands and holding tight!",
    ],
    audio: "/surprise/flight/audio/3B.mp3",
    durationMs: 8000,
    ...art("3B"),
  },
  {
    id: "3C",
    stop: "Rarotonga",
    title: "the summit & the butterfly",
    motion: "parallax",
    verse: [
      "POP! The sleepy bed bursts wide —",
      "a butterfly comes out to glide!",
      "And from the top, what do they see?",
      "“AOTEAROA! Across the sea!”",
    ],
    audio: "/surprise/flight/audio/3C.mp3",
    durationMs: 8500,
    ...art("3C"),
  },

  // ── STOP 4 · Northland ──────────────────────────────────────────────
  {
    id: "4A",
    stop: "Northland",
    title: "landfall",
    motion: "pan",
    verse: [
      "Fly, fly, nearly there!",
      "Green, green hills and salty air.",
      "Down they land on a muddy track —",
      "“Welcome home! Welcome back!”",
    ],
    audio: "/surprise/flight/audio/4A.mp3",
    durationMs: 8000,
    ...art("4A"),
  },
  {
    id: "4B",
    stop: "Northland",
    title: "the stuck digger & the dogs",
    motion: "push-in",
    verse: [
      "Stuck, stuck, stuck in the goo —",
      "a little digger! What to do?",
      "Here come doggies — one, two, three,",
      "four and five — a family!",
    ],
    audio: "/surprise/flight/audio/4B.mp3",
    durationMs: 8500,
    ...art("4B"),
  },
  {
    id: "4C",
    stop: "Northland",
    title: "the big TUG",
    motion: "parallax",
    verse: [
      "Tug, tug, TUG! One, two, three!",
      "Pulling together — a family!",
      "POP! goes the digger! SPLAT! goes the mud!",
      "Muddy kisses — splud, splud, splud!",
    ],
    audio: "/surprise/flight/audio/4C.mp3",
    durationMs: 8500,
    ...art("4C"),
  },

  // ── STOP 5 · Tomarata (finale) ──────────────────────────────────────
  {
    id: "5A",
    stop: "Tomarata",
    title: "the farm",
    motion: "pan",
    verse: [
      "Fly, fly, one last mile,",
      "down a driveway, single file!",
      "Under a tree with flowers red,",
      "a little kiwi pops up her head!",
    ],
    audio: "/surprise/flight/audio/5A.mp3",
    durationMs: 8000,
    ...art("5A"),
  },
  {
    id: "5B",
    stop: "Tomarata",
    title: "welcome home, whānau",
    motion: "push-in",
    verse: [
      "“Haere mai! Welcome, dear!",
      "All your whānau’s gathered here!”",
      "SPLASH! The fish swims in the stream —",
      "home at last, just like a dream!",
    ],
    audio: "/surprise/flight/audio/5B.mp3",
    durationMs: 8500,
    ...art("5B"),
  },
  {
    id: "5C",
    stop: "Tomarata",
    title: "Juniper's tree",
    motion: "finale",
    verse: [
      "They plant a little birthday tree,",
      "to grow up tall — just like she!",
      "One small candle, shining bright —",
      "“We love you, Juniper! Goodnight!”",
    ],
    audio: "/surprise/flight/audio/5C.mp3",
    durationMs: 10000,
    ...art("5C"),
  },
];

/** Subtitle pairs for a frame: [[line0, line1], [line2, line3]]. */
export function subtitlePairs(frame: Frame): [string, string][] {
  return [
    [frame.verse[0], frame.verse[1]],
    [frame.verse[2], frame.verse[3]],
  ];
}
