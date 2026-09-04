import { EMPTY_SESSION, type SessionState } from "../types";

// Applicant data lives ONLY in the browser tab's session memory (sessionStorage).
// It is never sent to a database and is wiped on "Start New Session" or tab close.
export const SESSION_KEY = "saarthi.session.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readSession(storage: StorageLike | null): SessionState {
  if (!storage) return { ...EMPTY_SESSION };
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return { ...EMPTY_SESSION };
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return { ...EMPTY_SESSION, ...parsed };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function writeSession(storage: StorageLike | null, state: SessionState): void {
  if (!storage) return;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); the in-memory React state still works.
  }
}

export function clearSession(storage: StorageLike | null): SessionState {
  if (storage) {
    try {
      storage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
  return { ...EMPTY_SESSION };
}

export function isSessionEmpty(s: SessionState): boolean {
  return !s.profile && !s.recommendation && !s.finance && !s.geo && !s.selectedSchemeId;
}
