"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Alert, Badge, Button, Card, DemoDataBadge, EmptyState, LinkButton, SectionTitle, Spinner, inr, inr2 } from "@/components/ui";
import { REFERRAL_DISCLAIMER } from "@/lib/types";

export default function ReferralPage() {
  const router = useRouter();
  const { session, hydrated, startNewSession } = useSession();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [cleared, setCleared] = useState(false);

  if (!hydrated) return <AppShell><div className="py-20 text-center text-sm text-slate-500">Loading session…</div></AppShell>;

  const { profile, recommendation, finance, geo } = session;
  const rec = recommendation?.ranked.find((r) => r.schemeId === (session.selectedSchemeId ?? recommendation?.recommended?.schemeId)) ?? recommendation?.recommended ?? null;

  if (cleared) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-10">
          <Card className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</span>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">Session cleared</h2>
            <p className="mt-2 text-sm text-slate-600">Applicant profile, recommendation, EMI results and partner routing have been removed from this browser. The next applicant starts from a clean session.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={() => router.push("/profile")}>Start next applicant</Button>
              <LinkButton href="/" variant="secondary">Home</LinkButton>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!profile || !rec) {
    return (
      <AppShell>
        <SectionTitle eyebrow="Step 5 of 5" title="Secure referral summary" />
        <EmptyState
          title={!profile ? "No applicant profile yet" : "No recommended scheme yet"}
          description={!profile ? "Complete the applicant profile and recommendation steps to generate a referral." : "Run the recommendation step first — a referral needs a matched scheme."}
          action={<LinkButton href={!profile ? "/profile" : "/recommendation"}>{!profile ? "Go to profile" : "Go to recommendation"}</LinkButton>}
        />
      </AppShell>
    );
  }

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/referral-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          recommendation: rec,
          recommendationSource: recommendation?.source ?? "deterministic",
          finance,
          partners: geo?.partners ?? [],
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "PDF generation failed. Your session is preserved; please retry.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? "Saarthi-Referral.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDownloaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed. Your session is preserved; please retry.");
    } finally {
      setGenerating(false);
    }
  };

  const clear = () => {
    startNewSession();
    setCleared(true);
  };

  return (
    <AppShell>
      <SectionTitle
        eyebrow="Step 5 of 5"
        title="Secure referral summary"
        description="Review the summary, download the referral PDF, then clear the session. The PDF is generated in memory and is not stored by Saarthi."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Referral preview</h2>
            <div className="flex gap-2">
              {recommendation?.source === "gemini" ? <Badge tone="blue">AI-assisted</Badge> : <Badge>Rule-based</Badge>}
              <DemoDataBadge />
            </div>
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row k="Applicant" v={`${profile.category} · ${profile.gender} · Age ${profile.age}`} />
            <Row k="Location" v={`${profile.district}, ${profile.state} (${profile.pincode})`} />
            <Row k="Income / business" v={`${inr(profile.annualIncome)} · ${profile.businessStatus}`} />
            <Row k="Requested" v={`${inr(profile.loanAmount)} · ${profile.loanPurpose}`} />
          </dl>

          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Recommended scheme</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{rec.schemeName} <span className="text-xs font-normal text-slate-500">({rec.schemeId})</span></p>
            <p className="mt-1 text-sm text-blue-900">{rec.reason}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Indicative terms</p>
              {finance ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li>Loan amount: <b>{inr(finance.input.principal)}</b></li>
                  <li>Interest rate: <b>{finance.input.annualRate}% p.a.</b></li>
                  <li>Moratorium: <b>{finance.input.moratoriumMonths} mo</b></li>
                  <li>Indicative EMI: <b>{inr2(finance.emi)}</b> × {finance.input.tenureMonths}</li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">EMI not calculated. <LinkButton href="/calculator" variant="ghost" className="px-1 py-0 text-xs">Calculate</LinkButton></p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top channel partners</p>
              {geo && geo.partners.length > 0 ? (
                <ol className="mt-2 space-y-1 text-sm text-slate-700">
                  {geo.partners.map((p) => (
                    <li key={p.partnerId}>{p.rank}. {p.partnerName} <span className="text-xs text-slate-500">· {p.distanceKm} km · <span className="text-emerald-700">{p.healthStatus}</span></span></li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No partner routed. <LinkButton href="/geo-router" variant="ghost" className="px-1 py-0 text-xs">Run geo router</LinkButton></p>
              )}
            </div>
          </div>

          <Alert tone="warn">
            <span className="font-semibold">{REFERRAL_DISCLAIMER}</span>
          </Alert>

          {error && <div className="mt-3"><Alert tone="error" title="PDF error">{error}</Alert></div>}
          {downloaded && !error && <div className="mt-3"><Alert tone="success">Referral PDF downloaded. You can now clear the session.</Alert></div>}

          <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <Button onClick={generate} disabled={generating} className="px-6">
              {generating && <Spinner />} {generating ? "Generating…" : downloaded ? "Download again" : "Download referral PDF"}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-emerald-200">
            <p className="text-sm font-semibold text-slate-900">Finish securely</p>
            <p className="mt-1 text-sm text-slate-600">Clearing the session removes the applicant profile, recommendation, EMI results and geo results from this browser.</p>
            <Button variant="danger" onClick={clear} className="mt-4 w-full">Start New Session — clear all applicant data</Button>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-slate-900">What the PDF contains</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• Applicant summary (no identifiers)</li>
              <li>• Recommended scheme + reason</li>
              <li>• Loan amount, rate, moratorium, indicative EMI</li>
              <li>• Top 3 channel partners</li>
              <li>• Referral / not-a-sanction disclaimer</li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="text-slate-800">{v}</dd>
    </div>
  );
}
