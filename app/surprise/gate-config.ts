// Passcode gate toggle, shared by the shelf page and every story page.
// ON for going live — every visitor needs the family passcode once per
// browser. (Set to false for local testing if needed.)
export const GATE_ENABLED = true;

// localStorage key remembering that this browser has unlocked the library.
export const UNLOCK_KEY = "surprise-unlocked-v1";
