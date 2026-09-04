"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession } from "./session-provider";
import { Button } from "./ui";
import { DEMO_DATA_LABEL } from "@/lib/types";

export const STEPS = [
  { href: "/profile", label: "Profile", short: "1" },
  { href: "/recommendation", label: "AI Recommendation", short: "2" },
  { href: "/calculator", label: "EMI Calculator", short: "3" },
  { href: "/geo-router", label: "Geo Router", short: "4" },
  { href: "/referral", label: "Secure Referral", short: "5" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, startNewSession, hydrated } = useSession();
  const [confirming, setConfirming] = useState(false);

  const stepDone = (href: string) => {
    switch (href) {
      case "/profile": return Boolean(session.profile);
      case "/recommendation": return Boolean(session.recommendation);
      case "/calculator": return Boolean(session.finance);
      case "/geo-router": return Boolean(session.geo);
      default: return false;
    }
  };

  const handleReset = () => {
    startNewSession();
    setConfirming(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-700 text-white shadow-sm">
              <ShieldIcon />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight tracking-tight text-slate-900">Saarthi</span>
              <span className="block text-[11px] leading-tight text-slate-500">AI-assisted loan referral · SIH 2026 prototype</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {hydrated && session.profile && (
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Secure session active
              </span>
            )}
            {confirming ? (
              <div className="flex items-center gap-1.5">
                <Button variant="danger" onClick={handleReset} className="px-3 py-2 text-xs">Confirm clear</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)} className="px-3 py-2 text-xs">Cancel</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)} className="px-3 py-2 text-xs sm:text-sm">
                <ResetIcon /> Start New Session
              </Button>
            )}
          </div>
        </div>
        <nav className="border-t border-slate-100 bg-white">
          <ol className="mx-auto flex max-w-6xl items-stretch overflow-x-auto px-2 sm:px-6">
            {STEPS.map((s, i) => {
              const active = pathname === s.href;
              const done = stepDone(s.href);
              return (
                <li key={s.href} className="flex-1 min-w-[6.5rem]">
                  <Link
                    href={s.href}
                    className={`flex h-full items-center justify-center gap-2 border-b-2 px-2 py-2.5 text-xs font-medium sm:text-sm ${
                      active ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        done ? "bg-emerald-500 text-white" : active ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <p className="mx-auto max-w-6xl px-4 py-1.5 text-center text-[11px] font-medium text-amber-800 sm:px-6 sm:text-xs">
          {DEMO_DATA_LABEL} — scheme terms, partner details and NPA indicators are synthetic and for demonstration only. Not official government data.
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-slate-500 sm:px-6">
        Saarthi prototype · Designed for privacy-conscious in-memory processing · Outputs are indicative referrals, not loan sanctions.
      </footer>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
