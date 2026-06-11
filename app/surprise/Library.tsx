"use client";

// Library — the bookshelf. Selecting a published book navigates to that
// book's own page (/surprise/<id>), so every story is bookmarkable and the
// browser back button returns to the shelf. New stories slot in via the
// registry + StoryPlayer.tsx with no changes here.

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Bookshelf from "./Bookshelf";
import FullscreenButton from "./FullscreenButton";

export default function Library() {
  const router = useRouter();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <FullscreenButton />
      <Bookshelf onOpen={(id) => router.push(`/surprise/${id}`)} />
    </motion.div>
  );
}
