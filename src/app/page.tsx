"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Button, Card, DemoDataBadge, LinkButton } from "@/components/ui";

const JOURNEY = [
  { step: "01", title: "Applicant profile", text: "Minimal inputs, held only in this browser session." },
  { step: "02", title: "Rule-based + AI-assisted match", text: "Deterministic rule engine filters schemes; Gemini explains and ranks — never overrides." },
  { step: "03", title: "Indicative EMI", text: "Transparent EMI, moratorium handling and month-by-month schedule." },
  { step: "04", title: "Healthy partner routing", text: "Nearest active channel partners passing the configured health criterion." },
  { step: "05", title: "Secure referral PDF", text: "A decision-support summary — not a sanction — ready to hand over." },
];

export default function HomePage() {
  const router = useRouter();
  const { session, hydrated, startNewSession } = useSession();
  const hasSession = hydrated && Boolean(session.profile);

  const startSecure = () => {
    startNewSession();
    router.push("/profile");
  };

  return (
    <AppShell>
      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">SIH 2026 Prototype</span>
            <DemoDataBadge />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Match applicants to the right loan scheme — <span className="text-blue-700">explainably</span> and <span className="text-emerald-600">privately</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            Saarthi combines a deterministic rule engine with AI-assisted explanations, an indicative EMI calculator and
            geo-routing to healthy channel partners — then produces a secure referral summary and clears the session.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={startSecure} className="px-6 py-3 text-base">
              <LockIcon /> Start Secure Session
            </Button>
            {hasSession && (
              <LinkButton href="/recommendation" variant="secondary" className="px-6 py-3 text-base">
                Resume current session →
              </LinkButton>
            )}
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <li className="flex items-center gap-2"><Dot /> No applicant database</li>
            <li className="flex items-center gap-2"><Dot /> AI never overrides rules</li>
            <li className="flex items-center gap-2"><Dot /> Works without Gemini</li>
          </ul>
        </div>

        <Card className="bg-gradient-to-br from-white to-blue-50/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Primary journey</p>
          <ol className="mt-3 space-y-3">
            {JOURNEY.map((j) => (
              <li key={j.step} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-700 text-xs font-bold text-white">{j.step}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{j.title}</p>
                  <p className="text-xs text-slate-600">{j.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-white/80 p-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
            <span className="font-semibold text-slate-800">Then:</span> Start New Session → all applicant data cleared from this browser.
          </div>
        </Card>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-slate-900">Deterministic first</p>
          <p className="mt-1 text-sm text-slate-600">The scheme dataset is the source of truth. Every match shows which configured conditions passed.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Indicative, never guaranteed</p>
          <p className="mt-1 text-sm text-slate-600">EMI and terms are labelled indicative. Referrals are decision support, not sanctions or approvals.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Privacy by design</p>
          <p className="mt-1 text-sm text-slate-600">Designed for privacy-conscious in-memory processing. Only minimal, non-identifying fields reach the AI layer.</p>
        </Card>
      </section>
    </AppShell>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />;
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
