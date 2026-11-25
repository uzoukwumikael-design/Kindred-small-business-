const KEY = "kindling-shared-note";

/** Keeps text shared from another app until the studio is ready to show it. */
export function stashSharedNote(note: string) {
  try {
    sessionStorage.setItem(KEY, note);
  } catch {
    // if storage is blocked the person can paste the text instead
  }
}

export function takeSharedNote(): string {
  try {
    const note = sessionStorage.getItem(KEY) ?? "";
    if (note) sessionStorage.removeItem(KEY);
    return note;
  } catch {
    return "";
  }
}

export function hasSharedNote(): boolean {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}
