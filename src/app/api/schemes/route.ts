import { DatasetError, loadSchemes } from "@/lib/data/datasets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const schemes = await loadSchemes();
    return Response.json({ ok: true, schemes });
  } catch (err) {
    const message = err instanceof DatasetError ? err.message : "Scheme dataset could not be loaded.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
