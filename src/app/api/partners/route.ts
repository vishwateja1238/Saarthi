import { DatasetError, loadLocations, loadPartners } from "@/lib/data/datasets";
import { routePartners } from "@/lib/engines/geo-router";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { state?: string; district?: string; schemeId?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!body.state || !body.district) {
    return Response.json({ ok: false, error: "State and district are required." }, { status: 400 });
  }

  try {
    const [locations, partners] = await Promise.all([loadLocations(), loadPartners()]);
    const loc = locations.find((l) => l.state === body.state && l.district === body.district) ?? null;
    const result = routePartners(loc, partners, body.schemeId ?? null);
    // Also return all active partners for the map context (no ranking), so the UI can show the wider network.
    const network = partners
      .filter((p) => p.isActive)
      .map((p) => ({
        partnerId: p.partnerId,
        partnerName: p.partnerName,
        latitude: p.latitude,
        longitude: p.longitude,
        npaRatioPercent: p.npaRatioPercent,
        healthy: p.npaRatioPercent <= result.healthThresholdPercent,
      }));
    return Response.json({ ok: true, result, network });
  } catch (err) {
    const message = err instanceof DatasetError ? err.message : "Geo router error.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
