"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Alert, Badge, Button, Card, DemoDataBadge, EmptyState, Field, LinkButton, SectionTitle, Stat, inputClass, inr, inr2 } from "@/components/ui";
import { FinanceInputError, buildRepaymentPlan } from "@/lib/engines/finance-engine";
import type { EmiResult, MoratoriumType, Scheme } from "@/lib/types";

export default function CalculatorPage() {
  const router = useRouter();
  const { session, hydrated, update } = useSession();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [schemeId, setSchemeId] = useState<string>("");
  const [principal, setPrincipal] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [tenure, setTenure] = useState<string>("");
  const [moratorium, setMoratorium] = useState<string>("0");
  const [moratoriumType, setMoratoriumType] = useState<MoratoriumType>("none");
  const [result, setResult] = useState<EmiResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    fetch("/api/schemes")
      .then((r) => r.json())
      .then((d: { ok: boolean; schemes?: Scheme[]; error?: string }) => (d.ok && d.schemes ? setSchemes(d.schemes) : setLoadError(d.error ?? "Scheme dataset unavailable.")))
      .catch(() => setLoadError("Scheme dataset unavailable."));
  }, []);

  const eligibleIds = useMemo(() => new Set(session.recommendation?.ranked.map((r) => r.schemeId) ?? []), [session.recommendation]);
  const selectable = useMemo(() => (schemes ?? []).filter((s) => s.isActive && (eligibleIds.size === 0 || eligibleIds.has(s.schemeId))), [schemes, eligibleIds]);

  // Initialise from session (selected scheme + requested loan) once schemes are loaded.
  useEffect(() => {
    if (!hydrated || !schemes) return;
    if (session.finance) {
      const f = session.finance.input;
      setSchemeId(session.selectedSchemeId ?? "");
      setPrincipal(String(f.principal));
      setRate(String(f.annualRate));
      setTenure(String(f.tenureMonths));
      setMoratorium(String(f.moratoriumMonths));
      setMoratoriumType(f.moratoriumType);
      setResult(session.finance);
      return;
    }
    const s = schemes.find((x) => x.schemeId === session.selectedSchemeId) ?? selectable[0];
    if (s) applyScheme(s, session.profile?.loanAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, schemes]);

  const applyScheme = (s: Scheme, loanAmount?: number) => {
    setSchemeId(s.schemeId);
    setRate(String(s.interestRateAnnual));
    setTenure(String(s.tenureMonthsMax));
    setMoratorium(String(s.moratoriumMonths));
    setMoratoriumType(s.moratoriumMonths > 0 ? s.moratoriumType : "none");
    const amt = loanAmount ?? Number(principal) ?? s.minLoan;
    setPrincipal(String(Math.min(Math.max(amt || s.minLoan, s.minLoan), s.maxLoan)));
    setResult(null);
    setCalcError(null);
  };

  const scheme = schemes?.find((s) => s.schemeId === schemeId) ?? null;

  const calculate = () => {
    setCalcError(null);
    try {
      const r = buildRepaymentPlan({
        principal: Number(principal),
        annualRate: Number(rate),
        tenureMonths: Number(tenure),
        moratoriumMonths: Number(moratorium),
        moratoriumType,
      });
      if (scheme && (r.input.principal < scheme.minLoan || r.input.principal > scheme.maxLoan)) {
        setCalcError(`Loan amount is outside this scheme's configured band (${inr(scheme.minLoan)}–${inr(scheme.maxLoan)}).`);
        return;
      }
      if (scheme && r.input.tenureMonths > scheme.tenureMonthsMax) {
        setCalcError(`Tenure exceeds this scheme's configured maximum of ${scheme.tenureMonthsMax} months.`);
        return;
      }
      setResult(r);
      update({ finance: r, selectedSchemeId: schemeId || null });
    } catch (e) {
      setCalcError(e instanceof FinanceInputError ? e.message : "Calculation failed.");
    }
  };

  if (!hydrated) return <AppShell><div className="py-20 text-center text-sm text-slate-500">Loading session…</div></AppShell>;

  if (!session.profile) {
    return (
      <AppShell>
        <SectionTitle eyebrow="Step 3 of 5" title="Indicative EMI calculator" />
        <EmptyState title="No applicant profile yet" description="Start with the applicant profile so the calculator can pre-fill the requested loan amount and recommended scheme." action={<LinkButton href="/profile">Go to profile</LinkButton>} />
      </AppShell>
    );
  }

  const rows = result ? (showFull ? result.schedule : result.schedule.slice(0, 12)) : [];

  return (
    <AppShell>
      <SectionTitle
        eyebrow="Step 3 of 5"
        title="Indicative EMI calculator"
        description="Deterministic calculation using the standard reducing-balance EMI formula. Interest rate, tenure cap and moratorium behaviour come from the selected scheme's configuration."
      />

      {loadError && <div className="mb-4"><Alert tone="error" title="Application error">{loadError}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <div className="space-y-4">
            <Field label="Scheme (configured terms)">
              <select className={inputClass} value={schemeId} onChange={(e) => { const s = schemes?.find((x) => x.schemeId === e.target.value); if (s) applyScheme(s, Number(principal) || session.profile?.loanAmount); }}>
                {selectable.length === 0 && <option value="">No eligible scheme in session</option>}
                {selectable.map((s) => <option key={s.schemeId} value={s.schemeId}>{s.schemeName}{session.recommendation?.recommended?.schemeId === s.schemeId ? " (recommended)" : ""}</option>)}
              </select>
            </Field>
            {scheme && (
              <p className="text-xs text-slate-500">
                Band {inr(scheme.minLoan)}–{inr(scheme.maxLoan)} · max tenure {scheme.tenureMonthsMax} mo · moratorium {scheme.moratoriumMonths} mo ({scheme.moratoriumType.replace("_", "-")})
              </p>
            )}
            <Field label="Loan amount (₹)">
              <input className={inputClass} type="number" min={1000} step={1000} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Interest rate (% p.a.)">
                <input className={inputClass} type="number" min={0} step={0.1} value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
              <Field label="Repayment tenure (months)">
                <input className={inputClass} type="number" min={1} step={1} value={tenure} onChange={(e) => setTenure(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Moratorium (months)">
                <input className={inputClass} type="number" min={0} step={1} value={moratorium} onChange={(e) => setMoratorium(e.target.value)} />
              </Field>
              <Field label="Moratorium type">
                <select className={inputClass} value={moratoriumType} onChange={(e) => setMoratoriumType(e.target.value as MoratoriumType)} disabled={Number(moratorium) <= 0}>
                  <option value="none">None</option>
                  <option value="interest_only">Interest-only</option>
                  <option value="capitalized">Capitalised interest</option>
                </select>
              </Field>
            </div>
            {calcError && <Alert tone="error">{calcError}</Alert>}
            <Button onClick={calculate} className="w-full">Calculate indicative EMI</Button>
            <p className="text-xs text-slate-500">
              r = annual rate ÷ 12 ÷ 100 · EMI = P·r·(1+r)ⁿ ÷ ((1+r)ⁿ − 1). Zero-interest loans use P ÷ n.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          {!result ? (
            <EmptyState title="No calculation yet" description="Set the loan parameters and calculate to see the indicative EMI and month-by-month repayment schedule." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">Indicative Calculation</Badge>
                <DemoDataBadge />
                {scheme && <Badge tone="blue">{scheme.schemeName}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Loan amount" value={inr(result.input.principal)} />
                <Stat label="Interest rate" value={`${result.input.annualRate}% p.a.`} hint="Indicative" />
                <Stat label="Moratorium" value={`${result.input.moratoriumMonths} mo`} hint={result.input.moratoriumMonths > 0 ? (result.input.moratoriumType === "interest_only" ? `Interest-only: ${inr2(result.moratoriumMonthlyPayment)}/mo` : `Capitalised → ${inr(result.effectivePrincipal)}`) : "Repayment starts month 1"} />
                <Stat label="Estimated EMI" value={inr2(result.emi)} hint={`${result.input.tenureMonths} months`} />
                <Stat label="Total interest" value={inr(result.totalInterest)} />
                <Stat label="Total repayment" value={inr(result.totalRepayment)} hint={`${result.totalMonths} months overall`} />
              </div>

              <Card className="p-0">
                <div className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm font-semibold text-slate-800">Monthly repayment schedule</p>
                  <button className="text-xs font-medium text-blue-700 hover:underline" onClick={() => setShowFull((s) => !s)}>
                    {showFull ? "Show first 12" : `Show all ${result.schedule.length} months`}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-left">Phase</th>
                        <th className="px-3 py-2">Opening</th>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Interest</th>
                        <th className="px-3 py-2">Principal</th>
                        <th className="px-3 py-2">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.month} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-left font-medium text-slate-800">{r.month}</td>
                          <td className="px-3 py-1.5 text-left">{r.phase === "Moratorium" ? <Badge tone="amber">Moratorium</Badge> : <span className="text-slate-500">Repayment</span>}</td>
                          <td className="px-3 py-1.5 tabular-nums">{inr2(r.openingBalance)}</td>
                          <td className="px-3 py-1.5 tabular-nums font-medium">{inr2(r.payment)}</td>
                          <td className="px-3 py-1.5 tabular-nums">{inr2(r.interest)}</td>
                          <td className="px-3 py-1.5 tabular-nums">{inr2(r.principal)}</td>
                          <td className="px-3 py-1.5 tabular-nums">{inr2(r.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Alert tone="warn">These figures are an indicative calculation for guidance only. Actual terms, rates and schedules are determined by the lending institution; this is not a loan sanction or guarantee.</Alert>

              <div className="flex justify-end">
                <Button onClick={() => router.push("/geo-router")} className="px-6">Find nearest healthy partners →</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
