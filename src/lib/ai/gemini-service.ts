import type { ApplicantProfile, RankedScheme, RecommendationResult, SchemeEvaluation } from "../types";
import { deterministicRanking, matchedConditions } from "../engines/scheme-engine";

// Gemini is an ASSISTANCE layer only.
// Flow: deterministic candidates -> Gemini explanation/ranking -> validation -> recommendation.
// Gemini can never introduce a scheme, rate, limit or rule that is not in the candidate list.
// On any failure (no key, timeout, HTTP error, invalid JSON, unknown scheme) we fall back
// to the deterministic ranking. No secrets and no applicant data are ever logged.

const GEMINI_TIMEOUT_MS = 9000;

export interface GeminiRankingResponse {
  ranked: { scheme_id: string; reason: string }[];
  summary?: string;
}

/** Only the minimum, non-identifying fields are shared with the model. */
export function minimalProfileForAi(p: ApplicantProfile) {
  return {
    category: p.category,
    gender: p.gender,
    age_band: p.age < 25 ? "under-25" : p.age < 35 ? "25-34" : p.age < 50 ? "35-49" : "50+",
    annual_income_band:
      p.annualIncome < 200000 ? "under-2L" : p.annualIncome < 500000 ? "2L-5L" : p.annualIncome < 1000000 ? "5L-10L" : "10L+",
    business_status: p.businessStatus,
    loan_amount_inr: p.loanAmount,
    loan_purpose: p.loanPurpose,
  };
}

export function buildPrompt(profile: ApplicantProfile, candidates: SchemeEvaluation[]): string {
  const candidateList = candidates.map((c) => ({
    scheme_id: c.scheme.schemeId,
    scheme_name: c.scheme.schemeName,
    interest_rate_annual: c.scheme.interestRateAnnual,
    moratorium_months: c.scheme.moratoriumMonths,
    max_loan: c.scheme.maxLoan,
    subsidy_note: c.scheme.subsidyNote,
    matched_conditions: matchedConditions(c),
    rule_engine_rank: candidates.indexOf(c) + 1,
  }));

  return [
    "You are a decision-support assistant for a government-linked loan referral prototype.",
    "A deterministic rule engine has ALREADY filtered the eligible candidate schemes below.",
    "Your job: rank ONLY these candidates for the applicant and write a short plain-language reason for each.",
    "Strict rules:",
    "- Use ONLY scheme_ids from the candidate list. Never invent schemes, rates, limits or eligibility rules.",
    "- Do not state that the applicant is approved, sanctioned or guaranteed eligible. Use words like 'may fit' and 'indicative'.",
    "- Keep each reason under 40 words.",
    "- Respond with JSON only, matching: {\"ranked\":[{\"scheme_id\":string,\"reason\":string}],\"summary\":string}",
    "",
    `Applicant (minimal, non-identifying): ${JSON.stringify(minimalProfileForAi(profile))}`,
    `Candidate schemes: ${JSON.stringify(candidateList)}`,
  ].join("\n");
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * Validate a Gemini response against the deterministic candidate list.
 * Returns null if the response is unusable (invalid shape, or no valid scheme ids).
 * Unknown scheme ids are rejected outright (treated as a hallucination -> fallback).
 */
export function validateGeminiRanking(
  raw: unknown,
  candidates: SchemeEvaluation[],
): { ranked: RankedScheme[]; summary?: string; problem?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<GeminiRankingResponse>;
  if (!Array.isArray(obj.ranked) || obj.ranked.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.scheme.schemeId.toUpperCase(), c]));
  const seen = new Set<string>();
  const ranked: RankedScheme[] = [];

  for (const item of obj.ranked) {
    if (!item || typeof item.scheme_id !== "string") return null;
    const key = item.scheme_id.toUpperCase();
    const cand = byId.get(key);
    if (!cand) return null; // unknown scheme => reject entire response
    if (seen.has(key)) continue;
    seen.add(key);
    const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim().slice(0, 400) : "";
    ranked.push({
      schemeId: cand.scheme.schemeId,
      schemeName: cand.scheme.schemeName,
      rank: ranked.length + 1,
      reason: reason || `May fit based on configured rules (indicative rate ${cand.scheme.interestRateAnnual}% p.a.).`,
      matchedConditions: matchedConditions(cand),
    });
  }
  if (ranked.length === 0) return null;

  // Any candidates Gemini omitted are appended in deterministic order so nothing is hidden.
  for (const c of candidates) {
    if (!seen.has(c.scheme.schemeId.toUpperCase())) {
      ranked.push({
        schemeId: c.scheme.schemeId,
        schemeName: c.scheme.schemeName,
        rank: ranked.length + 1,
        reason: `Also fits configured rules (indicative rate ${c.scheme.interestRateAnnual}% p.a.).`,
        matchedConditions: matchedConditions(c),
      });
    }
  }

  const summary = typeof obj.summary === "string" ? obj.summary.trim().slice(0, 600) : undefined;
  return { ranked, summary };
}

export type GeminiCaller = (prompt: string) => Promise<string>;

export async function callGeminiApi(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Empty Gemini response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export interface BuildRecommendationOptions {
  caller?: GeminiCaller;
  geminiEnabled?: boolean;
}

/**
 * Produce the final recommendation. Deterministic candidates are authoritative;
 * Gemini may only re-order and explain them.
 */
export async function buildRecommendation(
  profile: ApplicantProfile,
  evaluations: SchemeEvaluation[],
  candidates: SchemeEvaluation[],
  opts: BuildRecommendationOptions = {},
): Promise<RecommendationResult> {
  const base: Omit<RecommendationResult, "source" | "ranked" | "recommended"> = {
    evaluations,
    candidateCount: candidates.length,
    totalActiveSchemes: evaluations.filter((e) => e.scheme.isActive).length,
  };

  const fallback = (reason: string): RecommendationResult => {
    const ranked = deterministicRanking(candidates);
    return { ...base, source: "deterministic", fallbackReason: reason, ranked, recommended: ranked[0] ?? null };
  };

  if (candidates.length === 0) return fallback("No configured scheme matched the applicant profile.");

  const geminiEnabled = opts.geminiEnabled ?? Boolean(process.env.GEMINI_API_KEY);
  if (!geminiEnabled) return fallback("Gemini not configured (GEMINI_API_KEY missing). Deterministic ranking used.");

  const caller = opts.caller ?? callGeminiApi;
  try {
    const text = await caller(buildPrompt(profile, candidates));
    const parsed = extractJson(text);
    const validated = validateGeminiRanking(parsed, candidates);
    if (!validated) return fallback("Gemini response failed validation against rule-engine candidates. Deterministic ranking used.");
    return { ...base, source: "gemini", aiSummary: validated.summary, ranked: validated.ranked, recommended: validated.ranked[0] };
  } catch (err) {
    const msg = err instanceof Error ? err.name === "AbortError" ? "Gemini timed out" : err.message : "Gemini unavailable";
    // Log only a non-sensitive category of failure; never the prompt, key, or applicant data.
    console.warn(`[gemini] fallback to deterministic ranking: ${msg.replace(/key=[^&\s]+/gi, "key=***")}`);
    return fallback(`${msg}. Deterministic ranking used.`);
  }
}
