import { DatasetError, loadSchemes } from "@/lib/data/datasets";
import { generateReferralPdf } from "@/lib/pdf/referral-pdf";
import type { EmiResult, RankedPartner, RankedScheme } from "@/lib/types";
import { isValidProfile } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface Body {
  profile?: unknown;
  recommendation?: RankedScheme;
  recommendationSource?: "gemini" | "deterministic";
  finance?: EmiResult | null;
  partners?: RankedPartner[];
}

// The PDF is generated in memory and streamed back. Nothing is written to disk or a database.
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidProfile(body.profile)) {
    return Response.json({ ok: false, error: "Applicant profile is missing or invalid." }, { status: 400 });
  }
  if (!body.recommendation?.schemeId) {
    return Response.json({ ok: false, error: "A recommended scheme is required before generating a referral." }, { status: 400 });
  }

  try {
    const schemes = await loadSchemes();
    const scheme = schemes.find((s) => s.schemeId === body.recommendation!.schemeId);
    if (!scheme) {
      return Response.json({ ok: false, error: "Recommended scheme not found in configured dataset." }, { status: 400 });
    }

    const now = new Date();
    const referenceId = `SS-${now.getTime().toString(36).toUpperCase()}`;
    const pdf = await generateReferralPdf({
      profile: body.profile,
      scheme,
      recommendation: body.recommendation,
      recommendationSource: body.recommendationSource ?? "deterministic",
      finance: body.finance ?? null,
      partners: (body.partners ?? []).slice(0, 3),
      generatedAt: now.toISOString().replace("T", " ").slice(0, 16) + " UTC",
      referenceId,
    });

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Saarthi-Referral-${referenceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof DatasetError ? err.message : "PDF generation failed. Your session is preserved; please retry.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
