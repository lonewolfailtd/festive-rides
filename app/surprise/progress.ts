// Reading progress, shared by the shelf and the story pages.
//
// We remember (in this browser) which books have been opened. Until the FIRST
// published book has been opened once, the other published books are locked
// on the shelf; after that, everything is open. Story pages record the visit
// on mount and use it to show first-time "press play" instructions.

export const PROGRESS_KEY = "june-library-played-v1";

export function getPlayed(): string[] {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markPlayed(id: string) {
  try {
    const played = new Set(getPlayed());
    played.add(id);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify([...played]));
  } catch {}
}
