"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session-provider";
import { Alert, Badge, Button, Card, DemoDataBadge, EmptyState, LinkButton, SectionTitle, Stat } from "@/components/ui";
import type { NetworkPoint } from "@/components/partner-map";
import type { GeoRouterResult } from "@/lib/types";

const PartnerMap = dynamic(() => import("@/components/partner-map"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-500">Loading map…</div>,
});

export default function GeoRouterPage() {
  const router = useRouter();
  const { session, hydrated, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkPoint[]>([]);

  const schemeId = session.selectedSchemeId ?? session.recommendation?.recommended?.schemeId ?? null;
  const schemeName = session.recommendation?.ranked.find((r) => r.schemeId === schemeId)?.schemeName;

  const run = useCallback(async () => {
    if (!session.profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: session.profile.state, district: session.profile.district, schemeId }),
      });
      const data = (await res.json()) as { ok: boolean; result?: GeoRouterResult; network?: NetworkPoint[]; error?: string };
      if (!data.ok || !data.result) throw new Error(data.error ?? "Geo router failed.");
      setNetwork(data.network ?? []);
      update({ geo: data.result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geo router failed.");
    } finally {
      setLoading(false);
    }
  }, [session.profile, schemeId, update]);

  useEffect(() => {
    if (hydrated && session.profile && !loading && !error && (!session.geo || network.length === 0)) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session.profile, session.geo]);

  if (!hydrated) return <AppShell><div className="py-20 text-center text-sm text-slate-500">Loading session…</div></AppShell>;

  if (!session.profile) {
    return (
      <AppShell>
        <SectionTitle eyebrow="Step 4 of 5" title="Geo router — nearest healthy partners" />
        <EmptyState title="No applicant location yet" description="Enter the applicant profile so the router knows the state and district." action={<LinkButton href="/profile">Go to profile</LinkButton>} />
      </AppShell>
    );
  }

  const geo = session.geo;

  return (
    <AppShell>
      <SectionTitle
        eyebrow="Step 4 of 5"
        title="Geo router — nearest healthy partners"
        description="Channel partners are filtered for active status and a configured health criterion (demo NPA ratio), then ranked by Haversine distance from the applicant's district. Top 3 are returned."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="blue">{session.profile.district}, {session.profile.state}</Badge>
        {schemeName && <Badge>Scheme filter: {schemeName}</Badge>}
        <DemoDataBadge />
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => void run()} disabled={loading}>Re-run</Button>
      </div>

      {error && (
        <Alert tone="error" title="Geo router error">
          {error}
          <div className="mt-2"><Button variant="secondary" onClick={() => { setError(null); void run(); }}>Retry</Button></div>
        </Alert>
      )}

      {loading && !geo && <Card className="text-sm text-slate-600">Resolving applicant location and ranking partners…</Card>}

      {geo && (
        <div className="space-y-5">
          {geo.error ? (
            <Alert tone="error" title="Location not resolved">{geo.error}</Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Partners in dataset" value={String(geo.stats.total)} />
                <Stat label="Inactive removed" value={String(geo.stats.inactiveRemoved)} />
                <Stat label="Failed health check" value={String(geo.stats.unhealthyRemoved)} hint={`Demo NPA > ${geo.healthThresholdPercent}%`} />
                <Stat label="Scheme not supported" value={String(geo.stats.schemeUnsupportedRemoved)} />
                <Stat label="Ranked by distance" value={String(geo.stats.considered)} hint="Top 3 shown" />
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <Card className="h-[360px] overflow-hidden p-0 sm:h-[440px]">
                  {geo.applicantLocation && <PartnerMap applicant={geo.applicantLocation} ranked={geo.partners} network={network} />}
                </Card>

                <div className="space-y-3">
                  {geo.partners.length === 0 ? (
                    <EmptyState title="No suitable partner nearby" description="No active channel partner passing the configured health criterion (and supporting the selected scheme) exists for this location in the demo dataset." />
                  ) : (
                    geo.partners.map((p) => (
                      <Card key={p.partnerId} className={p.rank === 1 ? "border-emerald-300 ring-1 ring-emerald-100" : ""}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-sm font-bold text-white">{p.rank}</span>
                            <div>
                              <p className="font-semibold text-slate-900">{p.partnerName}</p>
                              <p className="text-xs text-slate-500">{p.partnerType} · {p.addressLine}, {p.district} – {p.pincode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">{p.distanceKm} km</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone="green">● {p.healthStatus}</Badge>
                          <Badge>Demo NPA {p.npaRatioPercent}%</Badge>
                          <Badge>Active</Badge>
                          <span className="text-slate-500">{p.contactPhone}</span>
                        </div>
                      </Card>
                    ))
                  )}
                  <p className="text-xs text-slate-500">
                    Legend: <span className="font-semibold text-blue-700">● applicant</span> · <span className="font-semibold text-emerald-700">● healthy partner</span> · <span className="font-semibold text-amber-600">● watchlist (excluded)</span>. NPA indicators are static demo values — not a live feed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => router.push("/referral")} className="px-6">Generate secure referral →</Button>
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
