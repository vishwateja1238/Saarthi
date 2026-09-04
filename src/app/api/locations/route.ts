import { DatasetError, loadLocations } from "@/lib/data/datasets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const locations = await loadLocations();
    const byState: Record<string, string[]> = {};
    for (const l of locations) {
      byState[l.state] = byState[l.state] ?? [];
      if (!byState[l.state].includes(l.district)) byState[l.state].push(l.district);
    }
    return Response.json({ ok: true, states: Object.keys(byState).sort(), districts: byState });
  } catch (err) {
    const message = err instanceof DatasetError ? err.message : "Location dataset could not be loaded.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
