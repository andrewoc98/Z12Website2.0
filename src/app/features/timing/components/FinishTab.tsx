import { useMemo, useState } from "react";
import { groupBoatsByCategory, sortBoatsByBowNumber, formatElapsedTime, formatRowerNames } from "../lib/utils";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc, PlaceholderFinish } from "../types";
import { assignPlaceholderToBoat, flagBoatForReview, deletePlaceholder } from "../api/timing";
import Modal from "../../../shared/components/Modal/Modal";

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
    const [flagPending, setFlagPending] = useState<BoatTimingDoc | null>(null);
    const [deletePending, setDeletePending] = useState<PlaceholderFinish | null>(null);

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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="timer font-bold">
                    {boat.status === "dns" && <span style={{color: "var(--red)"}}>DNS</span>}
                    {boat.status === "dnf" && <span style={{color: "var(--orange)"}}>DNF</span>}
                    {boat.status === "finished" && boat.startedAt && boat.finishedAt
                        ? formatElapsedTime(boat.finishedAt - boat.startedAt + boat.adjustmentMs)
                        : ""
                    }
                </span>
                {boat.status === "finished" && (
                    <button
                        className="btn-ghost finish-flag-btn"
                        onClick={() => setFlagPending(boat)}
                        title="Flag for review"
                    >
                        Flag
                    </button>
                )}
            </div>
        </div>
    );

    const handleDeletePlaceholder = async () => {
        if (!deletePending) return;
        const ph = deletePending;
        setDeletePending(null);
        try {
            await deletePlaceholder(eventId, ph.id);
        } catch {
            showMsg(ph.id, "Failed to delete — try again");
        }
    };

    const handleFlag = async () => {
        if (!flagPending) return;
        const boat = flagPending;
        setFlagPending(null);
        try {
            await flagBoatForReview(eventId, boat.id);
        } catch {
            showMsg(boat.id, "Failed to flag — try again");
        }
    };

    return (
        <div className="finish-tab">
            {flagPending && (
                <Modal
                    title="Flag for review?"
                    message={`Move #${flagPending.bowNumber} ${flagPending.clubName} to the Review tab. The time will be hidden from results until an admin confirms or corrects it.`}
                    onClose={() => setFlagPending(null)}
                    actions={[
                        { label: "Flag",   onClick: handleFlag,                 variant: "primary"   },
                        { label: "Cancel", onClick: () => setFlagPending(null), variant: "secondary" },
                    ]}
                />
            )}

            {deletePending && (
                <Modal
                    title="Delete placeholder?"
                    message={`Remove the placeholder recorded at ${new Date(deletePending.finishedAt).toLocaleTimeString()}. This cannot be undone.`}
                    onClose={() => setDeletePending(null)}
                    actions={[
                        { label: "Delete", onClick: handleDeletePlaceholder,      variant: "primary"   },
                        { label: "Cancel", onClick: () => setDeletePending(null), variant: "secondary" },
                    ]}
                />
            )}

            {placeholders.length > 0 && (
                <>
                    <h3>Unassigned Placeholders</h3>
                    {placeholders.map((placeholder) => (
                        <div key={placeholder.id} className="placeholder-item">
                            <span className="placeholder-time">
                                Finish at {new Date(placeholder.finishedAt).toLocaleTimeString()}
                            </span>
                            <select
                                className="placeholder-select"
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
                            <div className="placeholder-actions">
                                <button
                                    className="btn-primary"
                                    onClick={() => handleAssign(placeholder)}
                                    disabled={!selectedBoat[placeholder.id] || assigning === placeholder.id}
                                >
                                    {assigning === placeholder.id ? "Assigning..." : "Assign"}
                                </button>
                                <button
                                    className="btn-ghost placeholder-delete-btn"
                                    onClick={() => setDeletePending(placeholder)}
                                    disabled={assigning === placeholder.id}
                                >
                                    Delete
                                </button>
                            </div>
                            {msgs[placeholder.id] && (
                                <span className="placeholder-msg" style={{ color: msgs[placeholder.id].startsWith("Failed") ? "#ef4444" : "#10b981" }}>
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