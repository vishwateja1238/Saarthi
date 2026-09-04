import type { ApplicantProfile, ChannelPartner, Scheme } from "@/lib/types";

export const baseProfile: ApplicantProfile = {
  category: "SC",
  gender: "Female",
  state: "Maharashtra",
  district: "Pune",
  pincode: "411001",
  age: 29,
  annualIncome: 240000,
  businessStatus: "New",
  loanAmount: 400000,
  loanPurpose: "Manufacturing",
};

export function scheme(overrides: Partial<Scheme> = {}): Scheme {
  return {
    schemeId: "T-001",
    schemeName: "Test Scheme",
    implementingAgency: "Test Agency",
    categoryEligibility: ["All"],
    minAge: 18,
    maxAge: 65,
    minIncome: 0,
    maxIncome: 1000000,
    minLoan: 10000,
    maxLoan: 1000000,
    purposes: ["All"],
    businessStatus: "Any",
    interestRateAnnual: 10,
    tenureMonthsMax: 60,
    moratoriumMonths: 0,
    moratoriumType: "none",
    subsidyNote: "",
    isActive: true,
    description: "",
    sourceNote: "",
    ...overrides,
  };
}

export function partner(overrides: Partial<ChannelPartner> = {}): ChannelPartner {
  return {
    partnerId: "P-1",
    partnerName: "Partner",
    partnerType: "Bank Branch",
    state: "Maharashtra",
    district: "Pune",
    pincode: "411001",
    latitude: 18.52,
    longitude: 73.85,
    isActive: true,
    npaRatioPercent: 2,
    supportedSchemeIds: ["ALL"],
    addressLine: "Addr",
    contactPhone: "000",
    ...overrides,
  };
}

export const puneLocation = { state: "Maharashtra", district: "Pune", latitude: 18.5204, longitude: 73.8567 };
