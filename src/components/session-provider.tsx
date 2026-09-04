"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { EMPTY_SESSION, type SessionState } from "@/lib/types";
import { clearSession, readSession, writeSession } from "@/lib/session/session-store";

interface SessionContextValue {
  session: SessionState;
  hydrated: boolean;
  update: (patch: Partial<SessionState>) => void;
  startNewSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// --- Tiny external store backed by browser sessionStorage -------------------------------------
// Applicant data never leaves the browser tab except for the request in which it is processed.
const SERVER_SNAPSHOT: SessionState = { ...EMPTY_SESSION };
let snapshot: SessionState | null = null;
const listeners = new Set<() => void>();

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getSnapshot(): SessionState {
  if (snapshot === null) snapshot = readSession(getStorage());
  return snapshot;
}

function getServerSnapshot(): SessionState {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSnapshot(next: SessionState) {
  snapshot = next;
  listeners.forEach((l) => l());
}

const subscribeNoop = () => () => {};

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const update = useCallback((patch: Partial<SessionState>) => {
    const prev = getSnapshot();
    const next = { ...prev, ...patch, startedAt: prev.startedAt ?? new Date().toISOString() };
    writeSession(getStorage(), next);
    setSnapshot(next);
  }, []);

  const startNewSession = useCallback(() => {
    setSnapshot(clearSession(getStorage()));
  }, []);

  const value = useMemo(() => ({ session, hydrated, update, startNewSession }), [session, hydrated, update, startNewSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
