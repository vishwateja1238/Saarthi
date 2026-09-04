import { describe, expect, it } from "vitest";
import { HEALTH_NPA_THRESHOLD_PERCENT, routePartners } from "@/lib/engines/geo-router";
import { haversineKm } from "@/lib/utils/distance";
import { partner, puneLocation } from "./fixtures";

describe("distance", () => {
  it("computes Haversine distance (Pune → Mumbai ≈ 120 km)", () => {
    const d = haversineKm(18.5204, 73.8567, 19.076, 72.8777);
    expect(d).toBeGreaterThan(115);
    expect(d).toBeLessThan(125);
  });
  it("returns zero for identical points", () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0);
  });
});

describe("geo router", () => {
  const partners = [
    partner({ partnerId: "A", latitude: 18.53, longitude: 73.86, npaRatioPercent: 2 }), // ~1 km, healthy
    partner({ partnerId: "B", latitude: 18.6, longitude: 73.9, npaRatioPercent: 3 }), // ~10 km, healthy
    partner({ partnerId: "C", latitude: 18.51, longitude: 73.85, npaRatioPercent: 9 }), // ~1 km, unhealthy
    partner({ partnerId: "D", latitude: 18.52, longitude: 73.86, isActive: false }), // inactive
    partner({ partnerId: "E", latitude: 19.0, longitude: 74.0, npaRatioPercent: 4 }), // ~55 km, healthy
    partner({ partnerId: "F", latitude: 18.55, longitude: 73.8, npaRatioPercent: 5, supportedSchemeIds: ["SS-002"] }), // ~7 km, scheme-specific
  ];

  it("filters unhealthy partners using the configured threshold", () => {
    const r = routePartners(puneLocation, partners);
    expect(r.partners.find((p) => p.partnerId === "C")).toBeUndefined();
    expect(r.stats.unhealthyRemoved).toBe(1);
    expect(r.partners.every((p) => p.npaRatioPercent <= HEALTH_NPA_THRESHOLD_PERCENT && p.healthStatus === "Healthy")).toBe(true);
  });

  it("filters inactive partners", () => {
    const r = routePartners(puneLocation, partners);
    expect(r.partners.find((p) => p.partnerId === "D")).toBeUndefined();
    expect(r.stats.inactiveRemoved).toBe(1);
  });

  it("returns top 3 ranked by distance", () => {
    const r = routePartners(puneLocation, partners);
    expect(r.partners).toHaveLength(3);
    expect(r.partners.map((p) => p.partnerId)).toEqual(["A", "F", "B"]);
    expect(r.partners.map((p) => p.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < r.partners.length; i++) expect(r.partners[i].distanceKm).toBeGreaterThanOrEqual(r.partners[i - 1].distanceKm);
  });

  it("applies scheme support filter when a scheme is selected", () => {
    const r = routePartners(puneLocation, partners, "SS-004");
    expect(r.partners.find((p) => p.partnerId === "F")).toBeUndefined();
    expect(r.stats.schemeUnsupportedRemoved).toBe(1);
    expect(r.partners.map((p) => p.partnerId)).toEqual(["A", "B", "E"]);
  });

  it("returns fewer than 3 when fewer qualify", () => {
    const r = routePartners(puneLocation, partners.slice(0, 4));
    expect(r.partners).toHaveLength(2);
  });

  it("returns an empty list when no partner qualifies", () => {
    const r = routePartners(puneLocation, [partner({ isActive: false }), partner({ partnerId: "X", npaRatioPercent: 50 })]);
    expect(r.partners).toEqual([]);
    expect(r.error).toBeUndefined();
  });

  it("reports an error when applicant location is unresolved", () => {
    const r = routePartners(null, partners);
    expect(r.partners).toEqual([]);
    expect(r.error).toMatch(/location/i);
  });

  it("prioritizes exact district and never returns out-of-state Bhopal partner for Telangana Mancherial", () => {
    const mancherialLocation = { state: "Telangana", district: "Mancherial", latitude: 18.87, longitude: 79.45 };
    const mixedPartners = [
      partner({ partnerId: "TG-MAN-1", state: "Telangana", district: "Mancherial", latitude: 18.868, longitude: 79.46, npaRatioPercent: 2.4 }),
      partner({ partnerId: "TG-HYD-1", state: "Telangana", district: "Hyderabad", latitude: 17.385, longitude: 78.486, npaRatioPercent: 2.5 }),
      partner({ partnerId: "MP-BPL-1", partnerName: "Bhopal Demo Bank", state: "Madhya Pradesh", district: "Bhopal", latitude: 23.25, longitude: 77.41, npaRatioPercent: 1.5 }),
    ];

    const r = routePartners(mancherialLocation, mixedPartners);
    expect(r.partners).toHaveLength(2);
    expect(r.partners[0].partnerId).toBe("TG-MAN-1");
    expect(r.partners[0].district).toBe("Mancherial");
    // Bhopal must NEVER be returned for Telangana
    expect(r.partners.some((p) => p.partnerId === "MP-BPL-1" || p.district === "Bhopal")).toBe(false);
  });

  it("resolves Mancherial from actual locations.csv and returns nearby Telangana partners from channel_partners.csv", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { parseCsv } = await import("@/lib/data/csv");
    const { mapPartner } = await import("@/lib/data/datasets");

    const locRaw = await fs.readFile(path.join(process.cwd(), "data", "locations.csv"), "utf8");
    const locs = parseCsv(locRaw);
    const mancherial = locs.find((l) => l.state === "Telangana" && l.district === "Mancherial");
    expect(mancherial).toBeDefined();
    expect(Number(mancherial?.latitude)).toBeCloseTo(18.87, 1);
    expect(Number(mancherial?.longitude)).toBeCloseTo(79.45, 1);

    const cpRaw = await fs.readFile(path.join(process.cwd(), "data", "channel_partners.csv"), "utf8");
    const allPartners = parseCsv(cpRaw).map(mapPartner);

    const applicant = {
      state: "Telangana",
      district: "Mancherial",
      latitude: Number(mancherial!.latitude),
      longitude: Number(mancherial!.longitude),
    };

    const res = routePartners(applicant, allPartners, null);
    expect(res.error).toBeUndefined();
    expect(res.partners.length).toBeGreaterThanOrEqual(1);
    // All returned partners must be in Telangana and in Mancherial
    for (const p of res.partners) {
      expect(p.state).toBe("Telangana");
      expect(p.district).toBe("Mancherial");
      expect(p.distanceKm).toBeLessThan(30); // local to district
    }
    // Must not contain Bhopal
    expect(res.partners.some((p) => p.district.toLowerCase().includes("bhopal"))).toBe(false);
  });
});
