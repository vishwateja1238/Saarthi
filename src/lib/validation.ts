import {
  BUSINESS_STATUSES,
  GENDERS,
  LOAN_PURPOSES,
  SOCIAL_CATEGORIES,
  type ApplicantProfile,
} from "./types";

export type ProfileErrors = Partial<Record<keyof ApplicantProfile, string>>;

export interface ProfileFormValues {
  category: string;
  gender: string;
  state: string;
  district: string;
  pincode: string;
  age: string;
  annualIncome: string;
  businessStatus: string;
  loanAmount: string;
  loanPurpose: string;
}

export const EMPTY_FORM: ProfileFormValues = {
  category: "",
  gender: "",
  state: "",
  district: "",
  pincode: "",
  age: "",
  annualIncome: "",
  businessStatus: "",
  loanAmount: "",
  loanPurpose: "",
};

export function validateProfile(v: ProfileFormValues): { errors: ProfileErrors; profile: ApplicantProfile | null } {
  const errors: ProfileErrors = {};

  if (!SOCIAL_CATEGORIES.includes(v.category as never)) errors.category = "Select a category.";
  if (!GENDERS.includes(v.gender as never)) errors.gender = "Select gender.";
  if (!v.state) errors.state = "Select a state.";
  if (!v.district) errors.district = "Select a district.";
  if (!/^[1-9][0-9]{5}$/.test(v.pincode.trim())) errors.pincode = "Enter a valid 6-digit pincode.";

  const age = Number(v.age);
  if (!Number.isInteger(age) || age < 16 || age > 100) errors.age = "Age must be between 16 and 100.";

  const income = Number(v.annualIncome);
  if (!Number.isFinite(income) || income < 0 || v.annualIncome === "") errors.annualIncome = "Enter annual family income (₹, 0 or more).";
  else if (income > 100000000) errors.annualIncome = "Income seems too large for this prototype.";

  if (!BUSINESS_STATUSES.includes(v.businessStatus as never)) errors.businessStatus = "Select business status.";

  const loan = Number(v.loanAmount);
  if (!Number.isFinite(loan) || loan < 1000 || v.loanAmount === "") errors.loanAmount = "Loan amount must be at least ₹1,000.";
  else if (loan > 50000000) errors.loanAmount = "Loan amount exceeds prototype limit (₹5 crore).";

  if (!LOAN_PURPOSES.includes(v.loanPurpose as never)) errors.loanPurpose = "Select a loan purpose.";

  if (Object.keys(errors).length > 0) return { errors, profile: null };

  return {
    errors,
    profile: {
      category: v.category as ApplicantProfile["category"],
      gender: v.gender as ApplicantProfile["gender"],
      state: v.state,
      district: v.district,
      pincode: v.pincode.trim(),
      age,
      annualIncome: income,
      businessStatus: v.businessStatus as ApplicantProfile["businessStatus"],
      loanAmount: loan,
      loanPurpose: v.loanPurpose as ApplicantProfile["loanPurpose"],
    },
  };
}

/** Server-side guard for API payloads: re-validates an already-typed profile object. */
export function isValidProfile(p: unknown): p is ApplicantProfile {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const { errors } = validateProfile({
    category: String(o.category ?? ""),
    gender: String(o.gender ?? ""),
    state: String(o.state ?? ""),
    district: String(o.district ?? ""),
    pincode: String(o.pincode ?? ""),
    age: String(o.age ?? ""),
    annualIncome: String(o.annualIncome ?? ""),
    businessStatus: String(o.businessStatus ?? ""),
    loanAmount: String(o.loanAmount ?? ""),
    loanPurpose: String(o.loanPurpose ?? ""),
  });
  return Object.keys(errors).length === 0;
}
