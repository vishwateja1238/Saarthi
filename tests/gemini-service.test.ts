import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPrompt, buildRecommendation, minimalProfileForAi, validateGeminiRanking } from "@/lib/ai/gemini-service";
import { evaluateAll, getCandidates } from "@/lib/engines/scheme-engine";
import { baseProfile, scheme } from "./fixtures";

const schemes = [
  scheme({ schemeId: "A", schemeName: "Alpha", interestRateAnnual: 10 }),
  scheme({ schemeId: "B", schemeName: "Beta", categoryEligibility: ["SC"], interestRateAnnual: 7 }),
  scheme({ schemeId: "Z", schemeName: "Zeta (ineligible)", maxLoan: 1000 }),
];
const evaluations = evaluateAll(schemes, baseProfile);
const candidates = getCandidates(evaluations);

afterEach(() => vi.restoreAllMocks());

describe("Gemini assistance layer", () => {
  it("uses a valid Gemini response to rank and explain candidates", async () => {
    const caller = vi.fn().mockResolvedValue(JSON.stringify({ ranked: [{ scheme_id: "A", reason: "May fit; general purpose." }, { scheme_id: "B", reason: "Targeted." }], summary: "Two options." }));
    const r = await buildRecommendation(baseProfile, evaluations, candidates, { caller, geminiEnabled: true });
    expect(r.source).toBe("gemini");
    expect(r.recommended?.schemeId).toBe("A");
    expect(r.ranked.map((x) => x.schemeId)).toEqual(["A", "B"]);
    expect(r.aiSummary).toBe("Two options.");
  });

  it("falls back to deterministic ranking on invalid JSON", async () => {
    const caller = vi.fn().mockResolvedValue("Sure! Here is my answer: not json at all");
    const r = await buildRecommendation(baseProfile, evaluations, candidates, { caller, geminiEnabled: true });
    expect(r.source).toBe("deterministic");
    expect(r.recommended?.schemeId).toBe("B");
    expect(r.fallbackReason).toBeTruthy();
  });

  it("rejects responses that reference an unknown scheme (hallucination guard)", async () => {
    const caller = vi.fn().mockResolvedValue(JSON.stringify({ ranked: [{ scheme_id: "FAKE-999", reason: "Invented" }] }));
    const r = await buildRecommendation(baseProfile, evaluations, candidates, { caller, geminiEnabled: true });
    expect(r.source).toBe("deterministic");
    expect(r.ranked.every((x) => ["A", "B"].includes(x.schemeId))).toBe(true);
  });

  it("never lets Gemini promote an ineligible scheme", () => {
    expect(validateGeminiRanking({ ranked: [{ scheme_id: "Z", reason: "x" }] }, candidates)).toBeNull();
  });

  it("falls back when Gemini is unavailable (network error / timeout)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const caller = vi.fn().mockRejectedValue(new Error("Gemini HTTP 503"));
    const r = await buildRecommendation(baseProfile, evaluations, candidates, { caller, geminiEnabled: true });
    expect(r.source).toBe("deterministic");
    expect(r.recommended?.schemeId).toBe("B");
    expect(warn).toHaveBeenCalled();
    const logged = String(warn.mock.calls[0][0]);
    expect(logged).not.toContain("SC");
    expect(logged).not.toContain("240000");
  });

  it("uses deterministic ranking when Gemini is not configured", async () => {
    const caller = vi.fn();
    const r = await buildRecommendation(baseProfile, evaluations, candidates, { caller, geminiEnabled: false });
    expect(r.source).toBe("deterministic");
    expect(caller).not.toHaveBeenCalled();
    expect(r.ranked).toHaveLength(2);
  });

  it("returns a clear no-match result when there are no candidates", async () => {
    const caller = vi.fn();
    const r = await buildRecommendation(baseProfile, evaluations, [], { caller, geminiEnabled: true });
    expect(r.recommended).toBeNull();
    expect(caller).not.toHaveBeenCalled();
    expect(r.fallbackReason).toMatch(/No configured scheme matched/);
  });

  it("sends only minimal, banded, non-identifying applicant data", () => {
    const m = minimalProfileForAi(baseProfile);
    expect(m).not.toHaveProperty("pincode");
    expect(m).not.toHaveProperty("district");
    expect(m).not.toHaveProperty("state");
    expect(m.age_band).toBe("25-34");
    const prompt = buildPrompt(baseProfile, candidates);
    expect(prompt).not.toContain("411001");
    expect(prompt).not.toContain("Pune");
    expect(prompt).toContain("Never invent schemes");
  });
});
