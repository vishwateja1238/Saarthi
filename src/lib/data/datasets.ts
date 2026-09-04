import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { parseCsv, toBool, toList, toNum } from "./csv";
import type { ChannelPartner, GeoLocation, MoratoriumType, Scheme } from "../types";

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetError";
  }
}

const DATA_DIR = path.join(process.cwd(), "data");

async function readDataset(fileName: string): Promise<Record<string, string>[]> {
  const filePath = path.join(DATA_DIR, fileName);
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    throw new DatasetError(`Dataset unavailable: ${fileName} could not be read.`);
  }
  const rows = parseCsv(text);
  if (rows.length === 0) throw new DatasetError(`Dataset unavailable: ${fileName} is empty.`);
  return rows;
}

export function mapScheme(r: Record<string, string>): Scheme {
  const mt = (r.moratorium_type || "none") as MoratoriumType;
  return {
    schemeId: r.scheme_id,
    schemeName: r.scheme_name,
    implementingAgency: r.implementing_agency,
    categoryEligibility: toList(r.category_eligibility),
    minAge: toNum(r.min_age, 0),
    maxAge: toNum(r.max_age, 120),
    minIncome: toNum(r.min_income, 0),
    maxIncome: toNum(r.max_income, Number.MAX_SAFE_INTEGER),
    minLoan: toNum(r.min_loan, 0),
    maxLoan: toNum(r.max_loan, Number.MAX_SAFE_INTEGER),
    purposes: toList(r.purposes),
    businessStatus: (r.business_status as Scheme["businessStatus"]) || "Any",
    interestRateAnnual: toNum(r.interest_rate_annual, 0),
    tenureMonthsMax: toNum(r.tenure_months_max, 60),
    moratoriumMonths: toNum(r.moratorium_months, 0),
    moratoriumType: ["none", "interest_only", "capitalized"].includes(mt) ? mt : "none",
    subsidyNote: r.subsidy_note,
    isActive: toBool(r.is_active),
    description: r.description,
    sourceNote: r.source_note,
  };
}

export function mapPartner(r: Record<string, string>): ChannelPartner {
  return {
    partnerId: r.partner_id,
    partnerName: r.partner_name,
    partnerType: r.partner_type,
    state: r.state,
    district: r.district,
    pincode: r.pincode,
    latitude: toNum(r.latitude),
    longitude: toNum(r.longitude),
    isActive: toBool(r.is_active),
    npaRatioPercent: toNum(r.npa_ratio_percent, 100),
    supportedSchemeIds: toList(r.supported_scheme_ids),
    addressLine: r.address_line,
    contactPhone: r.contact_phone,
  };
}

let schemeCache: Scheme[] | null = null;
let partnerCache: ChannelPartner[] | null = null;
let locationCache: GeoLocation[] | null = null;

export async function loadSchemes(): Promise<Scheme[]> {
  if (!schemeCache) schemeCache = (await readDataset("schemes.csv")).map(mapScheme);
  return schemeCache;
}

export async function loadPartners(): Promise<ChannelPartner[]> {
  if (!partnerCache) partnerCache = (await readDataset("channel_partners.csv")).map(mapPartner);
  return partnerCache;
}

export async function loadLocations(): Promise<GeoLocation[]> {
  if (!locationCache) {
    locationCache = (await readDataset("locations.csv")).map((r) => ({
      state: r.state,
      district: r.district,
      latitude: toNum(r.latitude),
      longitude: toNum(r.longitude),
    }));
  }
  return locationCache;
}
