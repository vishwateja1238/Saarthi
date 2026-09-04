import type { ChannelPartner, GeoLocation, GeoRouterResult, RankedPartner } from "../types";
import { haversineKm } from "../utils/distance";

// Configured partner-health criterion for the prototype.
// NPA figures in the dataset are STATIC DEMO VALUES, not a live feed.
export const HEALTH_NPA_THRESHOLD_PERCENT = 6.0;
export const TOP_N = 3;

export function healthStatus(p: ChannelPartner): "Healthy" | "Watchlist" {
  return p.npaRatioPercent <= HEALTH_NPA_THRESHOLD_PERCENT ? "Healthy" : "Watchlist";
}

export function partnerSupportsScheme(p: ChannelPartner, schemeId: string | null | undefined): boolean {
  if (!schemeId) return true;
  const ids = p.supportedSchemeIds.map((s) => s.toUpperCase());
  return ids.includes("ALL") || ids.includes(schemeId.toUpperCase());
}

export function routePartners(
  applicant: GeoLocation | null,
  partners: ChannelPartner[],
  schemeId: string | null = null,
  topN: number = TOP_N,
): GeoRouterResult {
  const stats = {
    total: partners.length,
    inactiveRemoved: 0,
    unhealthyRemoved: 0,
    schemeUnsupportedRemoved: 0,
    considered: 0,
  };

  if (!applicant) {
    return {
      applicantLocation: null,
      partners: [],
      stats,
      healthThresholdPercent: HEALTH_NPA_THRESHOLD_PERCENT,
      error: "Applicant location could not be resolved from the configured location dataset.",
    };
  }

  const active = partners.filter((p) => p.isActive);
  stats.inactiveRemoved = partners.length - active.length;

  const healthy = active.filter((p) => healthStatus(p) === "Healthy");
  stats.unhealthyRemoved = active.length - healthy.length;

  const supporting = healthy.filter((p) => partnerSupportsScheme(p, schemeId));
  stats.schemeUnsupportedRemoved = healthy.length - supporting.length;
  stats.considered = supporting.length;

  // STATE-FIRST HIERARCHICAL ROUTING:
  // Step 1: Filter candidates within applicant's state
  const cleanApplicantState = applicant.state.trim().toLowerCase();
  const cleanApplicantDistrict = applicant.district.trim().toLowerCase();

  const sameStatePartners = supporting.filter(
    (p) => p.state.trim().toLowerCase() === cleanApplicantState
  );

  // If same state has partners, prioritize them exclusively.
  // Fall back to wider pool only if same state has 0 candidates.
  const pool = sameStatePartners.length > 0 ? sameStatePartners : supporting;

  const exactDistrictMatches: (ChannelPartner & { distanceKm: number; healthStatus: "Healthy" | "Watchlist" })[] = [];
  const sameStateMatches: (ChannelPartner & { distanceKm: number; healthStatus: "Healthy" | "Watchlist" })[] = [];

  for (const p of pool) {
    const dist = Math.round(haversineKm(applicant.latitude, applicant.longitude, p.latitude, p.longitude) * 10) / 10;
    const item = {
      ...p,
      distanceKm: dist,
      healthStatus: healthStatus(p),
    };
    if (p.district.trim().toLowerCase() === cleanApplicantDistrict) {
      exactDistrictMatches.push(item);
    } else {
      sameStateMatches.push(item);
    }
  }

  exactDistrictMatches.sort((a, b) => a.distanceKm - b.distanceKm || a.npaRatioPercent - b.npaRatioPercent);
  sameStateMatches.sort((a, b) => a.distanceKm - b.distanceKm || a.npaRatioPercent - b.npaRatioPercent);

  const selected = [...exactDistrictMatches, ...sameStateMatches].slice(0, topN);

  const ranked: RankedPartner[] = selected.map((p, i) => ({
    ...p,
    rank: i + 1,
  }));

  return {
    applicantLocation: applicant,
    partners: ranked,
    stats,
    healthThresholdPercent: HEALTH_NPA_THRESHOLD_PERCENT,
  };
}
