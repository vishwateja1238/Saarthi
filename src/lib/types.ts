// Shared domain types for Saarthi.
// Applicant data is held ONLY in browser session memory; nothing here maps to a DB table.

export type SocialCategory = "SC" | "ST" | "OBC" | "General";
export type Gender = "Female" | "Male" | "Other";
export type BusinessStatus = "New" | "Existing";
export type LoanPurpose =
  | "Manufacturing"
  | "Services"
  | "Trading"
  | "Agriculture-allied"
  | "Transport"
  | "Retail"
  | "Working Capital"
  | "Skill/Education";

export const LOAN_PURPOSES: LoanPurpose[] = [
  "Manufacturing",
  "Services",
  "Trading",
  "Agriculture-allied",
  "Transport",
  "Retail",
  "Working Capital",
  "Skill/Education",
];

export const SOCIAL_CATEGORIES: SocialCategory[] = ["SC", "ST", "OBC", "General"];
export const GENDERS: Gender[] = ["Female", "Male", "Other"];
export const BUSINESS_STATUSES: BusinessStatus[] = ["New", "Existing"];

export interface ApplicantProfile {
  category: SocialCategory;
  gender: Gender;
  state: string;
  district: string;
  pincode: string;
  age: number;
  annualIncome: number;
  businessStatus: BusinessStatus;
  loanAmount: number;
  loanPurpose: LoanPurpose;
}

export type MoratoriumType = "none" | "interest_only" | "capitalized";

export interface Scheme {
  schemeId: string;
  schemeName: string;
  implementingAgency: string;
  categoryEligibility: string[]; // e.g. ["SC","ST"] or ["All"] or ["Women"]
  minAge: number;
  maxAge: number;
  minIncome: number;
  maxIncome: number;
  minLoan: number;
  maxLoan: number;
  purposes: string[]; // e.g. ["Manufacturing","Services"] or ["All"]
  businessStatus: "New" | "Existing" | "Any";
  interestRateAnnual: number;
  tenureMonthsMax: number;
  moratoriumMonths: number;
  moratoriumType: MoratoriumType;
  subsidyNote: string;
  isActive: boolean;
  description: string;
  sourceNote: string;
}

export interface RuleCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface SchemeEvaluation {
  scheme: Scheme;
  checks: RuleCheck[];
  eligible: boolean;
  failedCount: number;
  score: number;
}

export interface RankedScheme {
  schemeId: string;
  schemeName: string;
  rank: number;
  reason: string;
  matchedConditions: string[];
}

export interface RecommendationResult {
  source: "gemini" | "deterministic";
  fallbackReason?: string;
  aiSummary?: string;
  recommended: RankedScheme | null;
  ranked: RankedScheme[];
  evaluations: SchemeEvaluation[];
  candidateCount: number;
  totalActiveSchemes: number;
}

export interface EmiInput {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  moratoriumMonths: number;
  moratoriumType: MoratoriumType;
}

export interface ScheduleRow {
  month: number;
  phase: "Moratorium" | "Repayment";
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface EmiResult {
  input: EmiInput;
  emi: number;
  moratoriumMonthlyPayment: number;
  effectivePrincipal: number;
  totalInterest: number;
  totalRepayment: number;
  totalMonths: number;
  schedule: ScheduleRow[];
}

export interface ChannelPartner {
  partnerId: string;
  partnerName: string;
  partnerType: string;
  state: string;
  district: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  npaRatioPercent: number;
  supportedSchemeIds: string[]; // ["ALL"] or specific ids
  addressLine: string;
  contactPhone: string;
}

export interface RankedPartner extends ChannelPartner {
  distanceKm: number;
  healthStatus: "Healthy" | "Watchlist";
  rank: number;
}

export interface GeoLocation {
  state: string;
  district: string;
  latitude: number;
  longitude: number;
}

export interface GeoRouterResult {
  applicantLocation: GeoLocation | null;
  partners: RankedPartner[];
  stats: {
    total: number;
    inactiveRemoved: number;
    unhealthyRemoved: number;
    schemeUnsupportedRemoved: number;
    considered: number;
  };
  healthThresholdPercent: number;
  error?: string;
}

export interface SessionState {
  profile: ApplicantProfile | null;
  recommendation: RecommendationResult | null;
  selectedSchemeId: string | null;
  finance: EmiResult | null;
  geo: GeoRouterResult | null;
  startedAt: string | null;
}

export const EMPTY_SESSION: SessionState = {
  profile: null,
  recommendation: null,
  selectedSchemeId: null,
  finance: null,
  geo: null,
  startedAt: null,
};

export const DEMO_DATA_LABEL = "Prototype / Static Demo Data";
export const REFERRAL_DISCLAIMER =
  "This document is a referral/decision-support summary and is not a loan sanction or approval.";
