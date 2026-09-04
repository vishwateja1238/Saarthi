import { buildRecommendation } from "@/lib/ai/gemini-service";
import { DatasetError, loadSchemes } from "@/lib/data/datasets";
import { evaluateAll, getCandidates } from "@/lib/engines/scheme-engine";
import { isValidProfile } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Applicant profile is processed in memory for this request only. Nothing is persisted or logged.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const profile = (body as { profile?: unknown })?.profile;
  if (!isValidProfile(profile)) {
    return Response.json({ ok: false, error: "Applicant profile failed validation." }, { status: 400 });
  }

  try {
    const schemes = await loadSchemes();
    const evaluations = evaluateAll(schemes, profile);
    const candidates = getCandidates(evaluations);
    const result = await buildRecommendation(profile, evaluations, candidates);
    return Response.json({ ok: true, result, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  } catch (err) {
    const message = err instanceof DatasetError ? err.message : "Recommendation engine error.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
