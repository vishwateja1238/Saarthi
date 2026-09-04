"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Alert, Button, Card, Field, SectionTitle, Spinner, inputClass } from "@/components/ui";
import { BUSINESS_STATUSES, GENDERS, LOAN_PURPOSES, SOCIAL_CATEGORIES, type ApplicantProfile } from "@/lib/types";
import { EMPTY_FORM, validateProfile, type ProfileErrors, type ProfileFormValues } from "@/lib/validation";

interface LocationsResponse {
  ok: boolean;
  states?: string[];
  districts?: Record<string, string[]>;
  error?: string;
}

function profileToForm(p: ApplicantProfile | null): ProfileFormValues {
  if (!p) return EMPTY_FORM;
  return {
    category: p.category,
    gender: p.gender,
    state: p.state,
    district: p.district,
    pincode: p.pincode,
    age: String(p.age),
    annualIncome: String(p.annualIncome),
    businessStatus: p.businessStatus,
    loanAmount: String(p.loanAmount),
    loanPurpose: p.loanPurpose,
  };
}

export default function ProfilePage() {
  const { hydrated } = useSession();
  if (!hydrated) return <AppShell><div className="py-20 text-center text-sm text-slate-500">Loading session…</div></AppShell>;
  return <ProfileForm />;
}

function ProfileForm() {
  const router = useRouter();
  const { session, update } = useSession();
  const [form, setForm] = useState<ProfileFormValues>(() => profileToForm(session.profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [locations, setLocations] = useState<LocationsResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d: LocationsResponse) => setLocations(d))
      .catch(() => setLocations({ ok: false, error: "Location dataset could not be loaded." }));
  }, []);

  const districts = useMemo(() => (form.state && locations?.districts ? locations.districts[form.state] ?? [] : []), [form.state, locations]);

  const set = (k: keyof ProfileFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === "state" ? { district: "" } : {}) }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { errors: errs, profile } = validateProfile(form);
    setErrors(errs);
    if (!profile) return;
    setSubmitting(true);
    const changed = JSON.stringify(profile) !== JSON.stringify(session.profile);
    // A changed profile invalidates downstream results so nothing stale carries over.
    update(changed ? { profile, recommendation: null, selectedSchemeId: null, finance: null, geo: null } : { profile });
    router.push("/recommendation");
  };

  const loadDemo = () => {
    setForm({
      category: "SC",
      gender: "Female",
      state: "Maharashtra",
      district: "Pune",
      pincode: "411001",
      age: "29",
      annualIncome: "240000",
      businessStatus: "New",
      loanAmount: "400000",
      loanPurpose: "Manufacturing",
    });
    setErrors({});
  };

  return (
    <AppShell>
      <SectionTitle
        eyebrow="Step 1 of 5"
        title="Applicant profile"
        description="Only the fields needed for scheme matching are collected. Details stay in this browser session and are cleared when you start a new session."
      />

      {locations && !locations.ok && (
        <div className="mb-4">
          <Alert tone="error" title="Application error">{locations.error ?? "Location dataset unavailable."}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Social category" error={errors.category}>
                <select className={inputClass} value={form.category} onChange={set("category")}>
                  <option value="">Select…</option>
                  {SOCIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Gender" error={errors.gender}>
                <select className={inputClass} value={form.gender} onChange={set("gender")}>
                  <option value="">Select…</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="State" error={errors.state}>
                <select className={inputClass} value={form.state} onChange={set("state")} disabled={!locations?.ok}>
                  <option value="">{locations ? "Select…" : "Loading…"}</option>
                  {locations?.states?.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="District" error={errors.district}>
                <select className={inputClass} value={form.district} onChange={set("district")} disabled={!form.state}>
                  <option value="">Select…</option>
                  {districts.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Pincode" error={errors.pincode} hint="6 digits. Used only for display; routing uses the district centre.">
                <input className={inputClass} inputMode="numeric" maxLength={6} placeholder="e.g. 411001" value={form.pincode} onChange={set("pincode")} />
              </Field>
              <Field label="Age" error={errors.age}>
                <input className={inputClass} type="number" inputMode="numeric" min={16} max={100} placeholder="e.g. 29" value={form.age} onChange={set("age")} />
              </Field>
              <Field label="Annual family income (₹)" error={errors.annualIncome}>
                <input className={inputClass} type="number" inputMode="numeric" min={0} step={1000} placeholder="e.g. 240000" value={form.annualIncome} onChange={set("annualIncome")} />
              </Field>
              <Field label="Business status" error={errors.businessStatus}>
                <select className={inputClass} value={form.businessStatus} onChange={set("businessStatus")}>
                  <option value="">Select…</option>
                  {BUSINESS_STATUSES.map((b) => <option key={b} value={b}>{b === "New" ? "New / proposed business" : "Existing business"}</option>)}
                </select>
              </Field>
              <Field label="Loan amount required (₹)" error={errors.loanAmount}>
                <input className={inputClass} type="number" inputMode="numeric" min={1000} step={1000} placeholder="e.g. 400000" value={form.loanAmount} onChange={set("loanAmount")} />
              </Field>
              <Field label="Loan purpose" error={errors.loanPurpose}>
                <select className={inputClass} value={form.loanPurpose} onChange={set("loanPurpose")}>
                  <option value="">Select…</option>
                  {LOAN_PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <Button type="button" variant="ghost" onClick={loadDemo}>Load demo applicant</Button>
              <Button type="submit" disabled={submitting || !locations?.ok} className="px-6">
                {submitting && <Spinner />} Find matching schemes →
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <p className="text-sm font-semibold text-slate-900">Privacy note</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>• No name, phone, Aadhaar or bank details are requested.</li>
                <li>• Data is kept in browser session memory only — no applicant database.</li>
                <li>• Only banded, non-identifying fields are shared with the AI layer.</li>
                <li>• “Start New Session” wipes everything.</li>
              </ul>
            </Card>
            <Card>
              <p className="text-sm font-semibold text-slate-900">What happens next</p>
              <p className="mt-2 text-sm text-slate-600">
                A deterministic rule engine checks every active scheme in the configured dataset against your profile, then
                an AI layer (if available) explains and ranks the eligible candidates.
              </p>
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
