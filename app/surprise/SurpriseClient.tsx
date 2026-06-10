"use client";

import { useEffect, useState } from "react";
import Gate from "./Gate";
import Library from "./Library";

// Passcode gate toggle. OFF during testing so we go straight to the shelf.
// ⚠️ Set this back to `true` before sharing with family.
const GATE_ENABLED = false;

export default function SurpriseClient() {
  // When the gate is disabled, start "unlocked" so the shelf shows instantly.
  const [unlocked, setUnlocked] = useState<boolean | null>(GATE_ENABLED ? null : true);

  useEffect(() => {
    if (!GATE_ENABLED) return;
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

  return <Library />;
}
