import { describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { deterministicRanking, evaluateAll, evaluateScheme, getCandidates, matchedConditions } from "@/lib/engines/scheme-engine";
import { parseCsv } from "@/lib/data/csv";
import { mapScheme } from "@/lib/data/datasets";
import { baseProfile, scheme } from "./fixtures";

describe("scheme rule engine", () => {
  it("returns a valid match with explainable conditions", () => {
    const e = evaluateScheme(scheme(), baseProfile);
    expect(e.eligible).toBe(true);
    expect(e.failedCount).toBe(0);
    const conds = matchedConditions(e);
    expect(conds.some((c) => c.startsWith("Category matches"))).toBe(true);
    expect(conds.some((c) => c.startsWith("Income within"))).toBe(true);
    expect(conds.some((c) => c.startsWith("Loan amount within"))).toBe(true);
    expect(conds.some((c) => c.startsWith("Purpose supported"))).toBe(true);
  });

  it("rejects when income is outside range", () => {
    const e = evaluateScheme(scheme({ maxIncome: 200000 }), baseProfile);
    expect(e.eligible).toBe(false);
    expect(e.checks.find((c) => c.rule === "Income")?.passed).toBe(false);
  });

  it("rejects when loan amount is outside range", () => {
    const e = evaluateScheme(scheme({ maxLoan: 300000 }), baseProfile);
    expect(e.eligible).toBe(false);
    expect(e.checks.find((c) => c.rule === "Loan amount")?.passed).toBe(false);
  });

  it("rejects when category does not match", () => {
    const e = evaluateScheme(scheme({ categoryEligibility: ["OBC"] }), baseProfile);
    expect(e.eligible).toBe(false);
    expect(e.checks.find((c) => c.rule === "Category")?.passed).toBe(false);
  });

  it("matches Women schemes for female applicants regardless of social category", () => {
    const e = evaluateScheme(scheme({ categoryEligibility: ["Women"] }), baseProfile);
    expect(e.eligible).toBe(true);
    const male = evaluateScheme(scheme({ categoryEligibility: ["Women"] }), { ...baseProfile, gender: "Male" });
    expect(male.eligible).toBe(false);
  });

  it("rejects inactive schemes, unsupported purposes, age and business status mismatches", () => {
    expect(evaluateScheme(scheme({ isActive: false }), baseProfile).eligible).toBe(false);
    expect(evaluateScheme(scheme({ purposes: ["Transport"] }), baseProfile).eligible).toBe(false);
    expect(evaluateScheme(scheme({ maxAge: 25 }), baseProfile).eligible).toBe(false);
    expect(evaluateScheme(scheme({ businessStatus: "Existing" }), baseProfile).eligible).toBe(false);
  });

  it("returns no candidates when nothing matches", () => {
    const evals = evaluateAll([scheme({ maxLoan: 1000 }), scheme({ schemeId: "T-002", isActive: false })], baseProfile);
    expect(getCandidates(evals)).toHaveLength(0);
    expect(deterministicRanking(getCandidates(evals))).toEqual([]);
  });

  it("ranks targeted, lower-rate schemes first deterministically", () => {
    const evals = evaluateAll(
      [scheme({ schemeId: "GEN", interestRateAnnual: 10 }), scheme({ schemeId: "SC", categoryEligibility: ["SC", "ST"], interestRateAnnual: 7.5 })],
      baseProfile,
    );
    const ranked = deterministicRanking(getCandidates(evals));
    expect(ranked[0].schemeId).toBe("SC");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].reason).toContain("Best fit based on configured rules");
  });

  it("works against the real demo dataset (schemes.csv is the source of truth)", async () => {
    const text = await fs.readFile(path.join(process.cwd(), "data/schemes.csv"), "utf8");
    const schemes = parseCsv(text).map(mapScheme);
    expect(schemes.length).toBeGreaterThanOrEqual(12);
    const evals = evaluateAll(schemes, baseProfile);
    const candidates = getCandidates(evals);
    expect(candidates.length).toBeGreaterThan(0);
    // Inactive schemes never become candidates.
    expect(candidates.every((c) => c.scheme.isActive)).toBe(true);
    // SC female, new manufacturing business, 4L loan -> a targeted scheme (Women or SC/ST) must top the list,
    // ranked ahead of generic "All"-category schemes.
    expect(["SS-004", "SS-005"]).toContain(candidates[0].scheme.schemeId);
    const ids = candidates.map((c) => c.scheme.schemeId);
    expect(ids).toContain("SS-004");
    expect(ids).toContain("SS-005");
    const firstGeneric = candidates.findIndex((c) => c.scheme.categoryEligibility.includes("All"));
    expect(firstGeneric).toBeGreaterThan(1);
  });
});
