"use client";

import { useEffect, useState } from "react";
import Gate from "./Gate";
import SmoothScroll from "./SmoothScroll";
import Story from "./Story";

export default function SurpriseClient() {
  // `null` = still checking localStorage (avoids a flash of the gate for
  // family who already unlocked on this device).
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let ok = false;
    try {
      ok = window.localStorage.getItem("surprise-unlocked-v1") === "1";
    } catch {}
    setUnlocked(ok);
  }, []);

  if (unlocked === null) {
    return <div className="min-h-screen bg-[#0b1020]" />;
  }

  if (!unlocked) {
    return <Gate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <SmoothScroll>
      <Story />
    </SmoothScroll>
  );
}
