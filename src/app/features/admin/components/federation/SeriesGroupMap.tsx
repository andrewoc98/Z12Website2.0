import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import type { PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Club } from "../../../auth/club";
import type { SeriesGroup } from "../../../events/api/events";

const IRELAND_CENTER: [number, number] = [53.4, -8.0];
const IRELAND_ZOOM = 7;

const PALETTE = [
    "#3b82f6",
    "#ef4444",
    "#22c55e",
    "#f97316",
    "#a855f7",
    "#06b6d4",
    "#ec4899",
    "#eab308",
];

interface Props {
    clubs: Club[];
    groups: SeriesGroup[];
}

export function SeriesGroupMap({ clubs, groups }: Props) {
    const [counties, setCounties] = useState<object | null>(null);

    useEffect(() => {
        fetch("/data/ireland-counties.geojson")
            .then(r => r.json())
            .then(setCounties)
            .catch(() => {});
    }, []);

    const groupColors = useMemo(() => {
        const map = new Map<string, string>();
        groups.forEach((g, i) => map.set(g.id, PALETTE[i % PALETTE.length]));
        return map;
    }, [groups]);

    // Map county name (lowercase) → group id, based on which clubs are in each group
    const countyGroupMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const group of groups) {
            for (const clubId of group.clubIds ?? []) {
                const club = clubs.find(c => c.id === clubId);
                if (club?.location?.county) {
                    map.set(club.location.county.toLowerCase(), group.id);
                }
            }
        }
        return map;
    }, [clubs, groups]);

    const { mappedClubs, unmappedClubs } = useMemo(() => ({
        mappedClubs:   clubs.filter(c => c.location?.lat != null && c.location?.lng != null),
        unmappedClubs: clubs.filter(c => c.location?.lat == null || c.location?.lng == null),
    }), [clubs]);

    const countyStyle = useCallback((feature: GeoJSON.Feature | undefined): PathOptions => {
        const county = ((feature?.properties as Record<string, unknown>)?.county ?? "") as string;
        const groupId = countyGroupMap.get(county.toLowerCase());
        const color = groupId ? groupColors.get(groupId) : undefined;
        return color
            ? { fillColor: color, fillOpacity: 0.22, color, weight: 2, opacity: 0.75 }
            : { fillColor: "#888", fillOpacity: 0.04, color: "#555", weight: 1, opacity: 0.25 };
    }, [countyGroupMap, groupColors]);

    // Key forces GeoJSON layer remount whenever group membership changes
    const geoKey = useMemo(
        () => groups.map(g => `${g.id}:${(g.clubIds ?? []).join(",")}`).join("|"),
        [groups]
    );

    const hasUnassigned = mappedClubs.some(c => !groups.some(g => (g.clubIds ?? []).includes(c.id)));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", height: 500 }}>
                <MapContainer
                    center={IRELAND_CENTER}
                    zoom={IRELAND_ZOOM}
                    style={{ height: "100%", width: "100%" }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {counties && (
                        <GeoJSON
                            key={geoKey}
                            data={counties as GeoJSON.FeatureCollection}
                            style={countyStyle}
                        />
                    )}

                    {mappedClubs.map(club => {
                        const groupId = groups.find(g => (g.clubIds ?? []).includes(club.id))?.id;
                        const color = groupId ? (groupColors.get(groupId) ?? "#888") : "#888";
                        const groupName = groupId ? groups.find(g => g.id === groupId)?.name : undefined;
                        return (
                            <CircleMarker
                                key={club.id}
                                center={[club.location.lat!, club.location.lng!]}
                                radius={7}
                                fillColor={color}
                                color="white"
                                weight={2}
                                fillOpacity={0.95}
                            >
                                <Popup>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 140 }}>
                                        <strong style={{ fontSize: "0.9rem" }}>{club.name}</strong>
                                        <span style={{ color: "#888", fontSize: "0.8rem" }}>
                                            {club.location.city}{club.location.county ? `, ${club.location.county}` : ""}
                                        </span>
                                        {groupName && (
                                            <span style={{ color, fontSize: "0.78rem", fontWeight: 600, marginTop: 2 }}>
                                                {groupName}
                                            </span>
                                        )}
                                        <span style={{ color: "#888", fontSize: "0.78rem" }}>
                                            {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>

                {/* Legend */}
                {(groups.length > 0 || hasUnassigned) && (
                    <div style={{
                        position: "absolute",
                        bottom: 24,
                        left: 12,
                        zIndex: 1000,
                        background: "rgba(26,26,30,0.92)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 7,
                        maxWidth: 240,
                    }}>
                        <span style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.4)",
                            marginBottom: 2,
                        }}>
                            Series
                        </span>
                        {groups.map(g => (
                            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: groupColors.get(g.id),
                                    flexShrink: 0,
                                    boxShadow: `0 0 6px ${groupColors.get(g.id)}80`,
                                }} />
                                <span style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.3 }}>
                                    {g.name}
                                </span>
                            </div>
                        ))}
                        {hasUnassigned && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#888", flexShrink: 0 }} />
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Unassigned</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Clubs without coordinates */}
            {unmappedClubs.length > 0 && (
                <div style={{
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid rgba(255,255,255,0.07)",
                }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>
                        {unmappedClubs.length} club{unmappedClubs.length !== 1 ? "s" : ""} without map coordinates — assign a location to show on map:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {unmappedClubs.map(c => (
                            <span key={c.id} style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.07)",
                                fontSize: "0.78rem",
                                color: "var(--muted)",
                            }}>
                                {c.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
