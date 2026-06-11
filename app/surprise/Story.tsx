"use client";

// "Juniper's First Year" — a real-memory storybook told as a vertical movie.
// Each scene: pinned full-screen art (portrait on phones, landscape on
// desktop), a scroll-driven camera move, a subtitle (June's name in blue),
// and Kylee's narration which plays as the scene comes into view.
//
// Audio needs a user gesture, so the cover shows "tap to begin" which
// unlocks sound; from then on each scene's clip plays once when entered.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import BirthdayCake from "./BirthdayCake";
import AmbientVideo, { useIsDesktop } from "./AmbientVideo";
import { JuneControls, useJunePlayback } from "./JunePlayback";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

const FONT = { fontFamily: "var(--font-fredoka), system-ui, sans-serif" } as const;

/** June's name, always in blue. */
const N = ({ children = "June" }: { children?: ReactNode }) => (
  <span className="font-semibold text-sky-300">{children}</span>
);

type Variant = "push" | "pan" | "drift";

interface SceneDef {
  key: string;
  img: string; // base name in /surprise/scenes/, expects -portrait + -wide
  audio: string; // file in /surprise/audio/story/
  line: ReactNode; // subtitle (macrons kept, name in blue)
  variant: Variant;
  /** Keep the subtitle up for the whole scene (e.g. to mask a video artifact). */
  pinSubtitle?: boolean;
}

const SCENES: SceneDef[] = [
  {
    key: "born",
    img: "02-born",
    audio: "n01-born.mp3",
    line: (
      <>
        Under a big strawberry moon, on a warm June night, a little girl called <N>Juniper Raine</N> came into the light. The stars all twinkled brighter, the moon gave out a cheer, for little <N /> had begun her very first year.
      </>
    ),
    variant: "push",
  },
  {
    key: "facetime",
    img: "03-v3-facetime",
    audio: "n02-facetime.mp3",
    line: (
      <>
        Far away in New Zealand, her family gathered round, waving at a little screen, blowing kisses through the sound. Hello little <N />, they cheered, from oceans far apart, for even through a screen she filled up every heart.
      </>
    ),
    variant: "drift",
  },
  {
    key: "daycare",
    img: "04-daycare",
    audio: "n03-daycare.mp3",
    line: (
      <>
        <N /> grew and grew and grew, to six months old one day, with daycare friends and giggles and lots of time to play. She wriggled and she rolled, she babbled and she smiled, and everybody said, what a happy little child!
      </>
    ),
    variant: "pan",
  },
  {
    key: "flight",
    img: "05-flight",
    audio: "n04-flight.mp3",
    line: (
      <>
        Then came a great adventure, her very first big flight, off to meet her family, zooming through the night. With Mum and Dad beside her, high above the sea, <N /> flew to New Zealand, as happy as can be.
      </>
    ),
    variant: "push",
  },
  {
    key: "lounge",
    img: "06-v2-lounge",
    audio: "n05-lounge.mp3",
    line: (
      <>
        At last they all were together, the family and wee <N />, with Nana's happy tears and cuddles all afternoon. Aunty Sammi, Uncle Tane, and Poppa beaming wide, the whole family's hearts were bursting full of pride.
      </>
    ),
    variant: "drift",
  },
  {
    key: "christmas",
    img: "07-v3-christmas",
    audio: "n06-christmas.mp3",
    line: (
      <>
        Her first ever Christmas came in the summer sun, with presents on the deck and wrapping paper fun. She tore the paper, threw it high, and giggled with delight, a Kiwi summer Christmas is a very merry sight!
      </>
    ),
    variant: "pan",
  },
  {
    key: "bath",
    img: "07-bath",
    audio: "n07-bath.mp3",
    line: (
      <>
        Then it's bath time in the kitchen sink, with bubbles to her chin, three little wind-up fishies go swim, swim, swim. One red, one blue, one yellow, splashing round and round, and <N />'s bath time giggles are the very best of sounds.
      </>
    ),
    variant: "push",
  },
  {
    key: "tomarata",
    img: "08-v3-tomarata",
    audio: "n08-tomarata.mp3",
    line: (
      <>
        They picnicked on the family land, beneath the great big sky, with sandwiches and yummy treats all piled extra high. <N /> crawled across the rug, the grass between her toes, while Uncle Tane gobbled up the food, as everybody knows!
      </>
    ),
    variant: "pan",
  },
  {
    key: "beach",
    img: "09-beach",
    audio: "n09-beach.mp3",
    line: (
      <>
        Down at the beach they took photos, beneath the summer trees, and <N /> dipped her tiny toes into the sparkly sea. She laughed and laughed and laughed, as the waves went splishy splash, a perfect happy memory that will forever last.
      </>
    ),
    variant: "drift",
  },
  {
    key: "airport",
    img: "10-v2-airport",
    audio: "n10-airport.mp3",
    line: (
      <>
        Then came the day for goodbyes, with hugs and one more squeeze. Goodbye little <N />, we love you, come back across the seas. From here to far America, wherever you may roam, our love goes with you always, from your family back home.
      </>
    ),
    variant: "push",
  },
];

function usePinned(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  return scrollYProgress;
}

/* ------------------------------------------------------------------ Scene */
function Scene({ def, index }: { def: SceneDef; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const isDesktop = useIsDesktop();
  const { reportActive, registerSection, armed, muted, narratingIndex } = useJunePlayback();
  const [inView, setInView] = useState(false);

  // Register this section so play mode can glide to it.
  useEffect(() => {
    registerSection(index, ref.current);
    return () => registerSection(index, null);
  }, [index, registerSection]);

  // Camera moves per variant.
  const pushScale = useTransform(p, [0, 1], [1, 1.45]);
  const pushY = useTransform(p, [0, 1], ["0%", "-6%"]);
  const panX = useTransform(p, [0, 1], ["3.5%", "-3.5%"]);
  const panScale = useTransform(p, [0, 1], [1.22, 1.22]);
  const driftScale = useTransform(p, [0, 1], [1.28, 1.08]);
  const driftY = useTransform(p, [0, 1], ["-4%", "4%"]);

  const style =
    def.variant === "push"
      ? { scale: pushScale, y: pushY }
      : def.variant === "pan"
        ? { x: panX, scale: panScale }
        : { scale: driftScale, y: driftY };

  // Subtitle visibility: while the verse is being SPOKEN it stays up, then
  // fades away so the art isn't blocked. Silent/muted readers keep it for the
  // whole scene (the text is the story for them).
  const showSub = inView && (def.pinSubtitle || !armed || muted || narratingIndex === index);

  // Tell the playback brain when this scene is the one on screen — it
  // handles narration (and stays quiet until the reader's first tap).
  useMotionValueEvent(p, "change", (v) => {
    if (v > 0.05 && v < 0.9) reportActive(index);
    setInView(v > 0.06 && v < 0.88);
  });

  return (
    <section ref={ref} className="relative" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={style} className="absolute inset-0">
          {/* Ambient film — plays by itself like the moon cover. Only the
              current orientation's clip is mounted (halves the download);
              stills render until the breakpoint is known on first paint. */}
          {isDesktop === null ? (
            <>
              <Image src={`/surprise/scenes/${def.img}-portrait.jpg`} alt="" fill sizes="100vw" className="object-cover md:hidden" />
              <Image src={`/surprise/scenes/${def.img}-wide.jpg`} alt="" fill sizes="100vw" className="hidden object-cover md:block" />
            </>
          ) : (
            <AmbientVideo
              src={`/surprise/video/${def.img}-${isDesktop ? "wide" : "portrait"}.mp4`}
              poster={`/surprise/scenes/${def.img}-${isDesktop ? "wide" : "portrait"}.jpg`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/30" />
        </motion.div>

        {/* Subtitle — slides up as the verse starts, fades once it's said */}
        <motion.div
          initial={false}
          animate={{ opacity: showSub ? 1 : 0, y: showSub ? 0 : 24 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-x-0 bottom-[8%] mx-auto max-w-2xl px-6 text-center"
        >
          <p
            className="text-xl font-medium leading-snug text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] sm:text-2xl lg:text-3xl"
            style={FONT}
          >
            {def.line}
          </p>
        </motion.div>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Cover */
function Cover() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const isDesktop = useIsDesktop();
  const scale = useTransform(p, [0, 1], [1.06, 1.3]);
  const titleOpacity = useTransform(p, [0, 0.5, 0.8], [1, 1, 0]);
  const titleY = useTransform(p, [0, 0.6], ["0%", "-35%"]);

  return (
    <section ref={ref} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <motion.div style={{ scale }} className="absolute inset-0">
          {/* Living cover: ambient moon loop, priority-loaded so it starts
              the moment the page opens. Single orientation mounted only. */}
          {isDesktop === null ? (
            <>
              <Image src="/surprise/scenes/01-moon-portrait.jpg" alt="" fill priority sizes="100vw" className="object-cover md:hidden" />
              <Image src="/surprise/scenes/01-moon-wide.jpg" alt="" fill priority sizes="100vw" className="hidden object-cover md:block" />
            </>
          ) : (
            <AmbientVideo
              src={`/surprise/video/cover-${isDesktop ? "wide" : "portrait"}.mp4`}
              poster={`/surprise/scenes/01-moon-${isDesktop ? "wide" : "portrait"}.jpg`}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
        </motion.div>

        <motion.div
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 top-[12%] flex flex-col items-center px-6 text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-white/75 sm:text-sm" style={FONT}>
            A true story, for her first birthday
          </p>
          <h1
            className="mt-3 text-5xl font-bold leading-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-6xl lg:text-8xl"
            style={FONT}
          >
            <span className="bg-gradient-to-b from-sky-200 to-sky-500 bg-clip-text text-transparent">
              Juniper
            </span>{" "}
            <span className="text-white">Raine</span>
          </h1>
          <p className="mt-2 text-xl text-white/90 sm:text-2xl" style={FONT}>
            Her First Year — from a Strawberry Moon to Aotearoa
          </p>
        </motion.div>

        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center text-white/75">
          <span className="text-sm" style={FONT}>
            tap ▶ to begin June&apos;s story
          </span>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- Finale */
function Finale() {
  const ref = useRef<HTMLElement>(null);
  const p = usePinned(ref);
  const { unlocked, replay } = useJunePlayback();
  const opacity = useTransform(p, [0.05, 0.3], [0, 1]);
  const scale = useTransform(p, [0.05, 0.5], [0.85, 1]);

  return (
    <section ref={ref} className="relative" style={{ height: "190vh" }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-start overflow-hidden bg-gradient-to-b from-[#0b1020] to-[#1a1033] px-6 pb-8 pt-[5svh] text-center">
        <motion.div style={{ opacity, scale }} className="flex w-full flex-col items-center">
          <BirthdayCake />
          {unlocked && (
            <button
              type="button"
              onClick={replay}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              style={FONT}
            >
              ↻ Play the story again
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export default function Story() {
  return (
    <div className="bg-black" style={FONT}>
      <JuneControls />
      <Cover />
      {SCENES.map((s, i) => (
        <Scene key={s.key} def={s} index={i} />
      ))}
      <Finale />
    </div>
  );
}
