"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { GeoLocation, RankedPartner } from "@/lib/types";

export interface NetworkPoint {
  partnerId: string;
  partnerName: string;
  latitude: number;
  longitude: number;
  npaRatioPercent: number;
  healthy: boolean;
}

export default function PartnerMap({ applicant, ranked, network }: { applicant: GeoLocation; ranked: RankedPartner[]; network: NetworkPoint[] }) {
  const rankedIds = new Set(ranked.map((r) => r.partnerId));
  const zoom = ranked.length && ranked[ranked.length - 1].distanceKm > 60 ? 8 : 11;

  return (
    <MapContainer center={[applicant.latitude, applicant.longitude]} zoom={zoom} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {network
        .filter((n) => !rankedIds.has(n.partnerId))
        .map((n) => (
          <CircleMarker key={n.partnerId} center={[n.latitude, n.longitude]} radius={6} pathOptions={{ color: n.healthy ? "#10b981" : "#f59e0b", fillColor: n.healthy ? "#10b981" : "#f59e0b", fillOpacity: 0.5, weight: 1 }}>
            <Tooltip>{n.partnerName} · {n.healthy ? "Healthy" : "Watchlist"} (demo NPA {n.npaRatioPercent}%)</Tooltip>
          </CircleMarker>
        ))}

      {ranked.map((p) => (
        <CircleMarker key={p.partnerId} center={[p.latitude, p.longitude]} radius={11} pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 0.9, weight: 2 }}>
          <Tooltip permanent direction="top" offset={[0, -10]} className="!rounded-md !border-emerald-300 !bg-white !px-1.5 !py-0.5 !text-[11px] !font-semibold !text-emerald-800">#{p.rank}</Tooltip>
          <Popup>
            <strong>#{p.rank} {p.partnerName}</strong><br />
            {p.partnerType}<br />
            {p.distanceKm} km · Healthy (demo NPA {p.npaRatioPercent}%)
          </Popup>
        </CircleMarker>
      ))}

      <CircleMarker center={[applicant.latitude, applicant.longitude]} radius={9} pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 }}>
        <Tooltip permanent direction="bottom" offset={[0, 8]} className="!rounded-md !border-blue-300 !bg-white !px-1.5 !py-0.5 !text-[11px] !font-semibold !text-blue-800">Applicant · {applicant.district}</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
