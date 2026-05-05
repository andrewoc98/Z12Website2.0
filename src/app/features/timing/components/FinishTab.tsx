import { useMemo, useState } from "react";
import { groupBoatsByCategory, sortBoatsByBowNumber, formatElapsedTime, formatRowerNames } from "../lib/utils";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc, PlaceholderFinish } from "../types";
import { assignPlaceholderToBoat } from "../api/timing";

interface FinishTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
    placeholders: PlaceholderFinish[];
}

export default function FinishTab({ eventId, boats, placeholders }: FinishTabProps) {
    const [assigning, setAssigning] = useState<string | null>(null);
    const [selectedBoat, setSelectedBoat] = useState<Record<string, string>>({});
    const [msgs, setMsgs] = useState<Record<string, string>>({});
    const [grouped, setGrouped] = useState(false);

    const sortResolvedBoats = (list: BoatTimingDoc[]) => {
        return [...list].sort((a, b) => {
            const statusOrder: Record<string, number> = { finished: 0, dnf: 1, dns: 2 };
            const rankA = statusOrder[a.status] ?? 99;
            const rankB = statusOrder[b.status] ?? 99;

            if (rankA !== rankB) return rankA - rankB;

            if (a.status === "finished" && b.status === "finished") {
                const timeA = (a.finishedAt! - a.startedAt!) + (a.adjustmentMs || 0);
                const timeB = (b.finishedAt! - b.startedAt!) + (b.adjustmentMs || 0);
                return timeA - timeB;
            }
            return (a.bowNumber ?? 0) - (b.bowNumber ?? 0);
        });
    };

    const resolvedBoats = useMemo(() => {
        return sortResolvedBoats(boats.filter(b => ["finished", "dns", "dnf"].includes(b.status)));
    }, [boats]);

    const categories = useMemo(() => {
        const filtered = boats.filter(b => ["finished", "dns", "dnf"].includes(b.status));
        const grouped = groupBoatsByCategory(filtered);
        return Object.entries(grouped)
            .map(([catId, catBoats]) => ({
                id: catId,
                name: catBoats[0]?.categoryName || catId,
                boats: sortResolvedBoats(catBoats),
            }))
            .sort((a, b) => (a.boats[0]?.bowNumber ?? 0) - (b.boats[0]?.bowNumber ?? 0));
    }, [boats]);

    const inProgressBoats = useMemo(() => {
        return sortBoatsByBowNumber(boats.filter(b => b.status === "in_progress"));
    }, [boats]);

    const allUids = useMemo(() => {
        const uids = new Set<string>();
        [...resolvedBoats, ...inProgressBoats].forEach((boat) =>
            boat.rowerUids.forEach((uid: string) => uids.add(uid))
        );
        return Array.from(uids);
    }, [resolvedBoats, inProgressBoats]);

    const { profiles } = useUserProfiles(allUids);

    const showMsg = (key: string, msg: string) => {
        setMsgs(prev => ({ ...prev, [key]: msg }));
        setTimeout(() => setMsgs(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        }), 2000);
    };

    const handleAssign = async (placeholder: PlaceholderFinish) => {
        const boatId = selectedBoat[placeholder.id];
        if (!boatId) return;
        setAssigning(placeholder.id);
        try {
            await assignPlaceholderToBoat(eventId, placeholder.id, boatId, placeholder.finishedAt);
            showMsg(placeholder.id, "Assigned!");
            setSelectedBoat(prev => {
                const next = { ...prev };
                delete next[placeholder.id];
                return next;
            });
        } catch (error) {
            showMsg(placeholder.id, "Failed to assign");
            console.error("Failed to assign placeholder:", error);
        } finally {
            setAssigning(null);
        }
    };

    const renderBoatRow = (boat: BoatTimingDoc, position: number) => (
        <div key={boat.id} className="boat-item">
            <span className="position-badge">
                {boat.status === "finished" ? `#${position}` : "—"}
            </span>
            <span>{boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}</span>
            <span className="timer font-bold">
                {boat.status === "dns" && <span style={{color: "var(--red)"}}>DNS</span>}
                {boat.status === "dnf" && <span style={{color: "var(--orange)"}}>DNF</span>}
                {boat.status === "finished" && boat.startedAt && boat.finishedAt
                    ? formatElapsedTime(boat.finishedAt - boat.startedAt + boat.adjustmentMs)
                    : ""
                }
            </span>
        </div>
    );

    return (
        <div className="finish-tab">
            {placeholders.length > 0 && (
                <>
                    <h3>Unassigned Placeholders</h3>
                    {placeholders.map((placeholder) => (
                        <div key={placeholder.id} className="placeholder-item">
                            <span>Finish at {new Date(placeholder.finishedAt).toLocaleTimeString()}</span>
                            <select
                                value={selectedBoat[placeholder.id] || ""}
                                onChange={(e) => setSelectedBoat(prev => ({
                                    ...prev,
                                    [placeholder.id]: e.target.value
                                }))}
                                disabled={assigning === placeholder.id}
                            >
                                <option value="">Assign to boat...</option>
                                {inProgressBoats.map((boat) => (
                                    <option key={boat.id} value={boat.id}>
                                        #{boat.bowNumber} {boat.clubName} — {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn-primary"
                                onClick={() => handleAssign(placeholder)}
                                disabled={!selectedBoat[placeholder.id] || assigning === placeholder.id}
                            >
                                {assigning === placeholder.id ? "Assigning..." : "Assign"}
                            </button>
                            {msgs[placeholder.id] && (
                                <span style={{ fontSize: "0.8rem", color: msgs[placeholder.id].startsWith("Failed") ? "#ef4444" : "#10b981" }}>
                                    {msgs[placeholder.id]}
                                </span>
                            )}
                        </div>
                    ))}
                </>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3>Finished Boats</h3>
                <div className="view-toggle">
                    <button
                        className={!grouped ? "btn-primary" : "btn-ghost"}
                        onClick={() => setGrouped(false)}
                    >
                        Overall
                    </button>
                    <button
                        className={grouped ? "btn-primary" : "btn-ghost"}
                        onClick={() => setGrouped(true)}
                    >
                        By Category
                    </button>
                </div>
            </div>

            {resolvedBoats.length === 0 && (
                <p style={{ color: "var(--muted)" }}>No boats finished yet</p>
            )}

            {!grouped ? (
                resolvedBoats.map((boat, i) => renderBoatRow(boat, i + 1))
            ) : (
                categories.map((category) => (
                    <div key={category.id} className="category-section">
                        <h3>{category.name}</h3>
                        <div className="boats-list">
                            {category.boats.length === 0
                                ? <p style={{ color: "var(--muted)" }}>No boats finished yet</p>
                                : category.boats.map((boat, i) => renderBoatRow(boat, i + 1))
                            }
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}