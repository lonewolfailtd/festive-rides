// Reading progress, shared by the shelf and the story pages.
//
// We remember (in this browser) which books have been opened. Until the FIRST
// published book has been opened once, the other published books are locked
// on the shelf; after that, everything is open. Story pages record the visit
// on mount and use it to show first-time "press play" instructions.

export const PROGRESS_KEY = "june-library-played-v1";
export const COMPLETED_KEY = "june-library-completed-v1";

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

// "Completed" = watched a story through to the end at least once. Manual
// scrolling inside a book stays locked until then, and the shelf unlocks the
// other books once the FIRST book is completed.
export function getCompleted(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markCompleted(id: string) {
  try {
    const done = new Set(getCompleted());
    done.add(id);
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify([...done]));
  } catch {}
}
