// Passcode gate toggle, shared by the shelf page and every story page.
// OFF during testing so we go straight to the books.
// ⚠️ Set GATE_ENABLED back to `true` before sharing with family.
export const GATE_ENABLED = false;

// localStorage key remembering that this browser has unlocked the library.
export const UNLOCK_KEY = "surprise-unlocked-v1";
