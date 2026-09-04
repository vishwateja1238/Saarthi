"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Alert, Badge, Button, Card, DemoDataBadge, EmptyState, LinkButton, SectionTitle, Spinner, inr } from "@/components/ui";
import type { RecommendationResult, SchemeEvaluation } from "@/lib/types";

export default function RecommendationPage() {
  const router = useRouter();
  const { session, hydrated, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const run = useCallback(async () => {
    if (!session.profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: session.profile }),
      });
      const data = (await res.json()) as { ok: boolean; result?: RecommendationResult; error?: string };
      if (!data.ok || !data.result) throw new Error(data.error ?? "Recommendation failed.");
      update({ recommendation: data.result, selectedSchemeId: data.result.recommended?.schemeId ?? null, finance: null, geo: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recommendation failed.");
    } finally {
      setLoading(false);
    }
  }, [session.profile, update]);

  useEffect(() => {
    if (hydrated && session.profile && !session.recommendation && !loading && !error) void run();
  }, [hydrated, session.profile, session.recommendation, loading, error, run]);

  if (!hydrated) return <AppShell><div className="py-20 text-center text-sm text-slate-500">Loading session…</div></AppShell>;

  if (!session.profile) {
    return (
      <AppShell>
        <SectionTitle eyebrow="Step 2 of 5" title="AI-assisted recommendation" />
        <EmptyState title="No applicant profile yet" description="Enter an applicant profile first so the rule engine has something to evaluate." action={<LinkButton href="/profile">Go to profile</LinkButton>} />
      </AppShell>
    );
  }

  const rec = session.recommendation;
  const evalById = new Map<string, SchemeEvaluation>(rec?.evaluations.map((e) => [e.scheme.schemeId, e]) ?? []);
  const top = rec?.recommended ? evalById.get(rec.recommended.schemeId) : undefined;
  const nearMisses = rec?.evaluations.filter((e) => !e.eligible && e.scheme.isActive && e.failedCount === 1).slice(0, 4) ?? [];

  const selectAndContinue = (schemeId: string) => {
    update({ selectedSchemeId: schemeId, finance: null });
    router.push("/calculator");
  };

  return (
    <AppShell>
      <SectionTitle
        eyebrow="Step 2 of 5"
        title="AI-assisted recommendation"
        description="Schemes are filtered by a deterministic rule engine using the configured dataset. The AI layer only explains and orders eligible candidates — it cannot add schemes or change rules."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Profile:</span>
        <Badge>{session.profile.category} · {session.profile.gender}</Badge>
        <Badge>Age {session.profile.age}</Badge>
        <Badge>Income {inr(session.profile.annualIncome)}</Badge>
        <Badge>{inr(session.profile.loanAmount)} · {session.profile.loanPurpose}</Badge>
        <Badge>{session.profile.businessStatus} business</Badge>
        <LinkButton href="/profile" variant="ghost" className="px-2 py-1 text-xs">Edit</LinkButton>
      </div>

      {loading && (
        <Card className="flex items-center gap-3 text-sm text-slate-700">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" /> Evaluating configured schemes and requesting AI explanation…
        </Card>
      )}

      {error && (
        <Alert tone="error" title="Could not produce a recommendation">
          {error}
          <div className="mt-2"><Button variant="secondary" onClick={() => { setError(null); void run(); }}>Retry</Button></div>
        </Alert>
      )}

      {rec && !loading && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {rec.source === "gemini" ? <Badge tone="blue">AI-assisted ranking (Gemini)</Badge> : <Badge tone="slate">Deterministic ranking</Badge>}
            <Badge tone="green">{rec.candidateCount} of {rec.totalActiveSchemes} active schemes may fit</Badge>
            <DemoDataBadge />
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => void run()}>Re-run</Button>
          </div>

          {rec.source === "deterministic" && rec.fallbackReason && rec.candidateCount > 0 && (
            <Alert tone="info" title="AI layer not used for this result">{rec.fallbackReason}</Alert>
          )}

          {rec.recommended && top ? (
            <Card className="border-blue-200 ring-1 ring-blue-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Best fit · recommended based on configured rules</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{top.scheme.schemeName}</h2>
                  <p className="text-sm text-slate-500">{top.scheme.implementingAgency} · {top.scheme.schemeId}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-700">{top.scheme.interestRateAnnual}%<span className="text-sm font-medium text-slate-500"> p.a. indicative</span></p>
                  <p className="text-xs text-slate-500">Up to {inr(top.scheme.maxLoan)} · {top.scheme.moratoriumMonths} mo moratorium</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-700">{top.scheme.description}</p>

              <div className="mt-4 rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Why this scheme</p>
                <p className="mt-1 text-sm text-blue-900">{rec.recommended.reason}</p>
                {rec.aiSummary && <p className="mt-2 text-xs text-blue-800/80">AI summary: {rec.aiSummary}</p>}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {top.checks.filter((c) => c.rule !== "Scheme active").map((c) => (
                  <div key={c.rule} className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <span className="mt-0.5 font-bold text-emerald-600">✓</span>
                    <span><span className="font-medium">{c.rule}:</span> {c.detail}</span>
                  </div>
                ))}
              </div>

              {top.scheme.subsidyNote && <p className="mt-3 text-xs text-slate-500">Configured note: {top.scheme.subsidyNote}</p>}

              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                <Button onClick={() => selectAndContinue(top.scheme.schemeId)} className="px-6">Calculate indicative EMI →</Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No configured scheme matched"
              description="None of the active schemes in the configured dataset satisfy all rule checks for this profile. Review the closest misses below or adjust the profile."
              action={<LinkButton href="/profile" variant="secondary">Adjust profile</LinkButton>}
            />
          )}

          {rec.ranked.length > 1 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Other schemes that may fit</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {rec.ranked.slice(1).map((r) => {
                  const ev = evalById.get(r.schemeId);
                  if (!ev) return null;
                  return (
                    <Card key={r.schemeId}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">#{r.rank}</p>
                          <p className="font-semibold text-slate-900">{ev.scheme.schemeName}</p>
                          <p className="text-xs text-slate-500">{ev.scheme.implementingAgency}</p>
                        </div>
                        <p className="text-lg font-bold text-slate-800">{ev.scheme.interestRateAnnual}%</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{r.reason}</p>
                      <p className="mt-2 text-xs text-slate-500">Up to {inr(ev.scheme.maxLoan)} · {ev.scheme.tenureMonthsMax} mo max tenure · {ev.scheme.moratoriumMonths} mo moratorium</p>
                      <Button variant="secondary" className="mt-3 px-3 py-1.5 text-xs" onClick={() => selectAndContinue(r.schemeId)}>Use this scheme</Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {nearMisses.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Close misses (failed exactly one rule)</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {nearMisses.map((e) => {
                  const failed = e.checks.find((c) => !c.passed);
                  return (
                    <Card key={e.scheme.schemeId} className="bg-slate-50">
                      <p className="font-semibold text-slate-800">{e.scheme.schemeName}</p>
                      <p className="mt-1 text-sm text-red-700">✗ {failed?.rule}: {failed?.detail}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <button className="text-sm font-medium text-blue-700 hover:underline" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Hide" : "Show"} full rule-engine audit ({rec.evaluations.length} schemes)
            </button>
            {showAll && (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Scheme</th>
                      {rec.evaluations[0]?.checks.map((c) => <th key={c.rule} className="px-3 py-2">{c.rule}</th>)}
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.evaluations.map((e) => (
                      <tr key={e.scheme.schemeId} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{e.scheme.schemeName}</td>
                        {e.checks.map((c) => (
                          <td key={c.rule} className="px-3 py-2" title={c.detail}>
                            {c.passed ? <span className="text-emerald-600">✓</span> : <span className="text-red-600">✗</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2">{e.eligible ? <Badge tone="green">May fit</Badge> : <Badge>Not matched</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
