import type {
  ApplicantProfile,
  RankedScheme,
  RuleCheck,
  Scheme,
  SchemeEvaluation,
} from "../types";

// Deterministic rule engine. The scheme dataset is the single source of truth;
// no scheme-specific rules are hard-coded here or in the UI.

export function formatInr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function categoryMatches(scheme: Scheme, p: ApplicantProfile): boolean {
  const tokens = scheme.categoryEligibility.map((t) => t.toLowerCase());
  if (tokens.includes("all")) return true;
  if (tokens.includes(p.category.toLowerCase())) return true;
  if (tokens.includes("women") && p.gender === "Female") return true;
  return false;
}

export function evaluateScheme(scheme: Scheme, p: ApplicantProfile): SchemeEvaluation {
  const checks: RuleCheck[] = [];

  checks.push({
    rule: "Scheme active",
    passed: scheme.isActive,
    detail: scheme.isActive ? "Scheme is active in configuration" : "Scheme is inactive/discontinued",
  });

  const catOk = categoryMatches(scheme, p);
  checks.push({
    rule: "Category",
    passed: catOk,
    detail: catOk
      ? `Category matches (${scheme.categoryEligibility.join(", ")})`
      : `Scheme targets ${scheme.categoryEligibility.join(", ")}; applicant is ${p.category}${
          p.gender === "Female" ? " (Female)" : ""
        }`,
  });

  const ageOk = p.age >= scheme.minAge && p.age <= scheme.maxAge;
  checks.push({
    rule: "Age",
    passed: ageOk,
    detail: ageOk
      ? `Age ${p.age} within ${scheme.minAge}–${scheme.maxAge}`
      : `Age ${p.age} outside ${scheme.minAge}–${scheme.maxAge}`,
  });

  const incomeOk = p.annualIncome >= scheme.minIncome && p.annualIncome <= scheme.maxIncome;
  checks.push({
    rule: "Income",
    passed: incomeOk,
    detail: incomeOk
      ? `Income within configured range (${formatInr(scheme.minIncome)}–${formatInr(scheme.maxIncome)})`
      : `Income ${formatInr(p.annualIncome)} outside ${formatInr(scheme.minIncome)}–${formatInr(scheme.maxIncome)}`,
  });

  const loanOk = p.loanAmount >= scheme.minLoan && p.loanAmount <= scheme.maxLoan;
  checks.push({
    rule: "Loan amount",
    passed: loanOk,
    detail: loanOk
      ? `Loan amount within configured range (${formatInr(scheme.minLoan)}–${formatInr(scheme.maxLoan)})`
      : `Loan ${formatInr(p.loanAmount)} outside ${formatInr(scheme.minLoan)}–${formatInr(scheme.maxLoan)}`,
  });

  const purposeTokens = scheme.purposes.map((x) => x.toLowerCase());
  const purposeOk = purposeTokens.includes("all") || purposeTokens.includes(p.loanPurpose.toLowerCase());
  checks.push({
    rule: "Purpose",
    passed: purposeOk,
    detail: purposeOk
      ? `Purpose supported (${p.loanPurpose})`
      : `Purpose ${p.loanPurpose} not in supported list (${scheme.purposes.join(", ")})`,
  });

  const bizOk = scheme.businessStatus === "Any" || scheme.businessStatus === p.businessStatus;
  checks.push({
    rule: "Business status",
    passed: bizOk,
    detail: bizOk
      ? `Business status accepted (${scheme.businessStatus === "Any" ? "New or Existing" : scheme.businessStatus})`
      : `Scheme requires ${scheme.businessStatus} business; applicant is ${p.businessStatus}`,
  });

  const failedCount = checks.filter((c) => !c.passed).length;
  const eligible = failedCount === 0;

  // Deterministic score for ranking eligible schemes (higher is better):
  // targeted schemes (non-"All" category) get a specificity bonus, lower interest is better,
  // and a small bonus when the requested amount sits comfortably inside the loan band.
  const isTargeted = !scheme.categoryEligibility.map((t) => t.toLowerCase()).includes("all");
  const purposeTargeted = !purposeTokens.includes("all");
  const rateScore = Math.max(0, 15 - scheme.interestRateAnnual);
  const bandMid = (scheme.minLoan + scheme.maxLoan) / 2;
  const bandHalf = Math.max(1, (scheme.maxLoan - scheme.minLoan) / 2);
  const fitScore = 1 - Math.min(1, Math.abs(p.loanAmount - bandMid) / bandHalf);
  const score = (isTargeted ? 10 : 0) + (purposeTargeted ? 3 : 0) + rateScore + fitScore * 2;

  return { scheme, checks, eligible, failedCount, score: Number(score.toFixed(3)) };
}

export function evaluateAll(schemes: Scheme[], p: ApplicantProfile): SchemeEvaluation[] {
  return schemes.map((s) => evaluateScheme(s, p));
}

export function getCandidates(evaluations: SchemeEvaluation[]): SchemeEvaluation[] {
  return evaluations
    .filter((e) => e.eligible)
    .sort((a, b) => b.score - a.score || a.scheme.interestRateAnnual - b.scheme.interestRateAnnual);
}

export function matchedConditions(e: SchemeEvaluation): string[] {
  return e.checks.filter((c) => c.passed && c.rule !== "Scheme active").map((c) => c.detail);
}

export function deterministicReason(e: SchemeEvaluation, rank: number): string {
  const s = e.scheme;
  const bits: string[] = [];
  const targeted = !s.categoryEligibility.map((t) => t.toLowerCase()).includes("all");
  if (targeted) bits.push(`specifically configured for ${s.categoryEligibility.join("/")} applicants`);
  bits.push(`indicative rate of ${s.interestRateAnnual}% p.a.`);
  if (s.moratoriumMonths > 0) bits.push(`${s.moratoriumMonths}-month moratorium`);
  if (s.subsidyNote) bits.push(s.subsidyNote.toLowerCase());
  const lead = rank === 1 ? "Best fit based on configured rules" : "Also fits configured rules";
  return `${lead}: ${bits.join(", ")}.`;
}

export function deterministicRanking(candidates: SchemeEvaluation[]): RankedScheme[] {
  return candidates.map((e, i) => ({
    schemeId: e.scheme.schemeId,
    schemeName: e.scheme.schemeName,
    rank: i + 1,
    reason: deterministicReason(e, i + 1),
    matchedConditions: matchedConditions(e),
  }));
}
