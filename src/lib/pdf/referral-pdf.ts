import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ApplicantProfile, EmiResult, RankedPartner, RankedScheme, Scheme } from "../types";
import { DEMO_DATA_LABEL, REFERRAL_DISCLAIMER } from "../types";

export interface ReferralPayload {
  profile: ApplicantProfile;
  scheme: Scheme;
  recommendation: RankedScheme;
  recommendationSource: "gemini" | "deterministic";
  finance: EmiResult | null;
  partners: RankedPartner[];
  generatedAt: string;
  referenceId: string;
}

// Standard PDF fonts (WinAnsi) do not include the rupee glyph, so we print "Rs."
const inr = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-IN");

const BLUE = rgb(0.09, 0.35, 0.78);
const GREEN = rgb(0.09, 0.55, 0.33);
const GREY = rgb(0.35, 0.38, 0.45);
const DARK = rgb(0.1, 0.12, 0.18);

export async function generateReferralPdf(payload: ReferralPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Saarthi - Secure Referral Summary");
  doc.setProducer("Saarthi Prototype");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const margin = 48;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 40) {
      page = doc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  };

  const text = (s: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const size = opts.size ?? 10.5;
    const f = opts.font ?? font;
    const lines = wrap(s, f, size, width - ((opts.x ?? margin) - margin));
    for (const line of lines) {
      ensureSpace(size + 6);
      page.drawText(line, { x: opts.x ?? margin, y, size, font: f, color: opts.color ?? DARK });
      y -= size + 5;
    }
  };

  const heading = (s: string) => {
    ensureSpace(30);
    y -= 8;
    page.drawText(s.toUpperCase(), { x: margin, y, size: 9.5, font: bold, color: BLUE });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.8, color: BLUE });
    y -= 14;
  };

  const kv = (k: string, v: string) => {
    ensureSpace(16);
    page.drawText(k, { x: margin, y, size: 10, font: bold, color: GREY });
    const lines = wrap(v, font, 10, width - 180);
    lines.forEach((line, i) => {
      if (i > 0) { y -= 13; ensureSpace(13); }
      page.drawText(line, { x: margin + 180, y, size: 10, font, color: DARK });
    });
    y -= 15;
  };

  // Header band
  page.drawRectangle({ x: 0, y: page.getHeight() - 90, width: page.getWidth(), height: 90, color: BLUE });
  page.drawText("Saarthi", { x: margin, y: page.getHeight() - 42, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Secure Referral Summary", { x: margin, y: page.getHeight() - 64, size: 13, font, color: rgb(0.9, 0.94, 1) });
  page.drawText(`Ref: ${payload.referenceId}`, { x: margin + width - 190, y: page.getHeight() - 42, size: 9, font, color: rgb(0.9, 0.94, 1) });
  page.drawText(`Generated: ${payload.generatedAt}`, { x: margin + width - 190, y: page.getHeight() - 56, size: 9, font, color: rgb(0.9, 0.94, 1) });
  y = page.getHeight() - 90 - 26;

  text(`${DEMO_DATA_LABEL} - AI-assisted, rule-based referral. Figures are indicative only.`, { size: 9, color: GREY });

  heading("Applicant Summary");
  const p = payload.profile;
  kv("Category / Gender", `${p.category} / ${p.gender}`);
  kv("Location", `${p.district}, ${p.state} (PIN ${p.pincode})`);
  kv("Age", String(p.age));
  kv("Annual family income", inr(p.annualIncome));
  kv("Business status", p.businessStatus);
  kv("Requested loan", `${inr(p.loanAmount)} for ${p.loanPurpose}`);

  heading("Recommended Scheme");
  const s = payload.scheme;
  kv("Scheme", `${s.schemeName} (${s.schemeId})`);
  kv("Implementing agency", s.implementingAgency);
  kv("Recommendation basis", payload.recommendationSource === "gemini" ? "Rule engine + AI-assisted ranking (Gemini)" : "Deterministic rule engine");
  kv("Reason", payload.recommendation.reason);
  if (payload.recommendation.matchedConditions.length) {
    kv("Matched conditions", payload.recommendation.matchedConditions.map((c) => "- " + c).join("\n"));
  }

  heading("Indicative Loan Terms");
  const f = payload.finance;
  kv("Loan amount", inr(f ? f.input.principal : p.loanAmount));
  kv("Interest rate", `${f ? f.input.annualRate : s.interestRateAnnual}% p.a. (indicative)`);
  kv("Moratorium", `${f ? f.input.moratoriumMonths : s.moratoriumMonths} month(s)${f && f.input.moratoriumMonths > 0 ? ` (${f.input.moratoriumType === "interest_only" ? "interest-only" : "capitalised"})` : ""}`);
  if (f) {
    kv("Tenure", `${f.input.tenureMonths} months repayment (${f.totalMonths} months total)`);
    kv("Indicative EMI", `${inr(f.emi)} per month`);
    kv("Total interest", inr(f.totalInterest));
    kv("Total repayment", inr(f.totalRepayment));
  } else {
    kv("Indicative EMI", "Not calculated in this session");
  }

  heading("Top Channel Partners (nearest, configured health criterion)");
  if (payload.partners.length === 0) {
    text("No suitable channel partner was found for the applicant location in the demo dataset.", { color: GREY });
  } else {
    payload.partners.forEach((cp) => {
      ensureSpace(44);
      page.drawText(`${cp.rank}. ${cp.partnerName}`, { x: margin, y, size: 10.5, font: bold, color: DARK });
      page.drawText(cp.healthStatus, { x: margin + width - 60, y, size: 9, font: bold, color: GREEN });
      y -= 13;
      text(`${cp.partnerType} | ${cp.addressLine}, ${cp.district}, ${cp.state} - ${cp.pincode}`, { size: 9.5, color: GREY, x: margin + 14 });
      text(`Distance: ${cp.distanceKm} km | Demo NPA ratio: ${cp.npaRatioPercent}% | Contact: ${cp.contactPhone}`, { size: 9.5, color: GREY, x: margin + 14 });
      y -= 4;
    });
  }

  heading("Important");
  text(REFERRAL_DISCLAIMER, { font: bold, size: 10 });
  text("Scheme terms, interest rates, NPA indicators and partner details in this prototype are synthetic demo data configured for demonstration purposes and do not represent official government data. Final eligibility, pricing and sanction are determined solely by the lending institution.", { size: 9.5, color: GREY });
  text("Designed for privacy-conscious in-memory processing: applicant details are not stored by Saarthi after the session is cleared.", { size: 9.5, color: GREY });

  // Footer on each page
  const pages = doc.getPages();
  pages.forEach((pg: PDFPage, i: number) => {
    pg.drawText(`Saarthi Prototype - SIH 2026 | Page ${i + 1} of ${pages.length}`, { x: margin, y: 24, size: 8, font, color: GREY });
  });

  return doc.save();
}

function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}
