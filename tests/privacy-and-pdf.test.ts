import { describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { clearSession, isSessionEmpty, readSession, SESSION_KEY, writeSession, type StorageLike } from "@/lib/session/session-store";
import { generateReferralPdf } from "@/lib/pdf/referral-pdf";
import { buildRepaymentPlan } from "@/lib/engines/finance-engine";
import { EMPTY_SESSION, REFERRAL_DISCLAIMER } from "@/lib/types";
import { baseProfile, partner, scheme } from "./fixtures";

/** Extract drawn text from a pdf-lib document: inflate content streams and hex-decode Tj strings. */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { PDFDocument, PDFRawStream, PDFName } = await import("pdf-lib");
  const zlib = await import("zlib");
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filter = obj.dict.get(PDFName.of("Filter"));
    let content = Buffer.from(obj.contents);
    if (filter && String(filter).includes("FlateDecode")) {
      try {
        content = zlib.inflateSync(content);
      } catch {
        continue;
      }
    }
    const text = content.toString("latin1");
    for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      out += Buffer.from(m[1], "hex").toString("latin1") + "\n";
    }
  }
  return out;
}

function memoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

describe("privacy: session handling", () => {
  it("clears all applicant data on Start New Session", () => {
    const storage = memoryStorage();
    writeSession(storage, { ...EMPTY_SESSION, profile: baseProfile, selectedSchemeId: "X", startedAt: "now" });
    expect(readSession(storage).profile).toEqual(baseProfile);
    const next = clearSession(storage);
    expect(isSessionEmpty(next)).toBe(true);
    expect(storage.store.has(SESSION_KEY)).toBe(false);
    expect(readSession(storage)).toEqual(EMPTY_SESSION);
  });

  it("does not persist applicants in the database schema", async () => {
    const schema = await fs.readFile(path.join(process.cwd(), "src/db/schema.ts"), "utf8");
    expect(schema).not.toMatch(/pgTable\(/);
    expect(schema.toLowerCase()).not.toContain("applicant");
  });

  it("never hard-codes or logs the Gemini key", async () => {
    const src = await fs.readFile(path.join(process.cwd(), "src/lib/ai/gemini-service.ts"), "utf8");
    expect(src).toContain("process.env.GEMINI_API_KEY");
    expect(src).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(src).not.toMatch(/console\.(log|info|warn|error)\([^)]*apiKey/);
    // No console statements that print prompts, profiles or responses.
    expect(src).not.toMatch(/console\.\w+\([^)]*(prompt|profile|text)\b/);
  });
});

describe("secure referral PDF", () => {
  it("generates a valid PDF containing required sections and the disclaimer", async () => {
    const finance = buildRepaymentPlan({ principal: 400000, annualRate: 7.5, tenureMonths: 84, moratoriumMonths: 12, moratoriumType: "capitalized" });
    const bytes = await generateReferralPdf({
      profile: baseProfile,
      scheme: scheme({ schemeId: "SS-004", schemeName: "SC/ST Venture Term Loan (Demo)" }),
      recommendation: { schemeId: "SS-004", schemeName: "SC/ST Venture Term Loan (Demo)", rank: 1, reason: "Best fit.", matchedConditions: ["Category matches"] },
      recommendationSource: "deterministic",
      finance,
      partners: [
        { ...partner({ partnerId: "1", partnerName: "Partner One" }), distanceKm: 1.2, healthStatus: "Healthy", rank: 1 },
        { ...partner({ partnerId: "2", partnerName: "Partner Two" }), distanceKm: 4.5, healthStatus: "Healthy", rank: 2 },
        { ...partner({ partnerId: "3", partnerName: "Partner Three" }), distanceKm: 9.9, healthStatus: "Healthy", rank: 3 },
      ],
      generatedAt: "2026-01-01 00:00 UTC",
      referenceId: "SS-TEST",
    });
    expect(bytes.byteLength).toBeGreaterThan(1500);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");

    // Verify required text is embedded (content streams are inflated and hex-decoded).
    const raw = await extractPdfText(bytes);
    for (const needle of ["Saarthi", "Secure Referral Summary", "Applicant Summary", "Recommended Scheme", "Indicative Loan Terms", "Top Channel Partners", "Partner One", "Partner Three"]) {
      expect(raw.toUpperCase(), `missing: ${needle}`).toContain(needle.toUpperCase());
    }
    // The disclaimer is word-wrapped; check its distinctive phrases.
    expect(raw).toContain("not a loan sanction or approval");
    expect(REFERRAL_DISCLAIMER).toContain("not a loan sanction or approval");
  });

  it("still generates when EMI and partners are absent", async () => {
    const bytes = await generateReferralPdf({
      profile: baseProfile,
      scheme: scheme(),
      recommendation: { schemeId: "T-001", schemeName: "Test Scheme", rank: 1, reason: "Fits.", matchedConditions: [] },
      recommendationSource: "gemini",
      finance: null,
      partners: [],
      generatedAt: "2026-01-01 00:00 UTC",
      referenceId: "SS-EMPTY",
    });
    const raw = await extractPdfText(bytes);
    expect(raw).toContain("Not calculated in this session");
    expect(raw).toContain("No suitable channel partner");
  });
});
