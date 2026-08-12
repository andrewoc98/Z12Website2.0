import { useEffect, useState, useMemo } from "react";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import {
    listClubRowers,
    addClubAthleteToBoat,
    removeCrewMemberAsCreator,
} from "../../signup/services/crewInviteService";
import { deleteBoat } from "../../signup/api/boats";

// ─── Types ────────────────────────────────────────────────────────────────────

type BoatState = {
    id: string;
    categoryId: string;
    categoryName: string;
    boatSize: number;
    rowerUids: string[];
    inviteCode: string | null;
};

type ClubRower = { uid: string; displayName: string; clubName: string };

export interface CoachCrewBuilderModalProps {
    eventId: string;
    eventName: string;
    boatIds: string[];
    getCategoryFee: (categoryId: string) => number;
    requiresPayment: boolean;
    onPay: (boatIds: string[]) => void;
    onClose: () => void;
    onBoatsChanged: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFee(cents: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function inviteUrl(eventId: string, code: string): string {
    return `${window.location.origin}/invite/${eventId}/${code}`;
}

// ─── SeatDots ─────────────────────────────────────────────────────────────────

function SeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    style={{
                        display: "block", width: 10, height: 10,
                        borderRadius: "50%", flexShrink: 0,
                        background: i < filled ? "#FEB959" : "rgba(255,255,255,0.1)",
                        border: i < filled ? "none" : "1px solid rgba(255,255,255,0.18)",
                        transition: "background 0.2s",
                    }}
                />
            ))}
        </div>
    );
}

// ─── BoatCard ─────────────────────────────────────────────────────────────────

function BoatCard({
    boat, eventId, allAssignedUids, names,
    onNameResolved, onUpdate, onRemove, removing,
}: {
    boat: BoatState;
    eventId: string;
    allAssignedUids: Set<string>;
    names: Map<string, string>;
    onNameResolved: (uid: string, name: string) => void;
    onUpdate: (updated: BoatState) => void;
    onRemove: () => void;
    removing: boolean;
}) {
    const [searchOpen, setSearchOpen]     = useState(false);
    const [searchQ, setSearchQ]           = useState("");
    const [roster, setRoster]             = useState<ClubRower[]>([]);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [rosterErr, setRosterErr]       = useState<string | null>(null);
    const [addingUid, setAddingUid]       = useState<string | null>(null);
    const [removingUid, setRemovingUid]   = useState<string | null>(null);
    const [copied, setCopied]             = useState(false);

    useEffect(() => {
        if (!searchOpen || roster.length > 0 || loadingRoster) return;
        setLoadingRoster(true);
        setRosterErr(null);
        listClubRowers({ eventId, boatId: boat.id, categoryName: boat.categoryName })
            .then(r => {
                setRoster(r.rowers);
                r.rowers.forEach(rw => onNameResolved(rw.uid, rw.displayName));
            })
            .catch((e: any) => setRosterErr(e?.message ?? "Failed to load athletes"))
            .finally(() => setLoadingRoster(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchOpen]);

    async function handleAdd(r: ClubRower) {
        setAddingUid(r.uid);
        onNameResolved(r.uid, r.displayName);
        try {
            await addClubAthleteToBoat({ eventId, boatId: boat.id, athleteUid: r.uid });
            const snap = await getDoc(doc(db, "events", eventId, "boats", boat.id));
            if (snap.exists()) {
                onUpdate({ ...boat, rowerUids: (snap.data() as any)?.rowerUids ?? boat.rowerUids });
            }
            setSearchQ("");
        } catch (e: any) {
            alert(e?.message ?? "Failed to add athlete");
        } finally {
            setAddingUid(null);
        }
    }

    async function handleRemoveAthlete(targetUid: string) {
        setRemovingUid(targetUid);
        try {
            await removeCrewMemberAsCreator({ eventId, boatId: boat.id, targetUid });
            onUpdate({ ...boat, rowerUids: boat.rowerUids.filter(u => u !== targetUid) });
        } catch (e: any) {
            alert(e?.message ?? "Failed to remove athlete");
        } finally {
            setRemovingUid(null);
        }
    }

    function handleCopyLink() {
        if (!boat.inviteCode) return;
        const url = inviteUrl(eventId, boat.inviteCode);
        navigator.clipboard.writeText(url).catch(() => window.prompt("Copy invite link:", url));
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    }

    const filteredRoster = searchQ.trim()
        ? roster.filter(r => r.displayName.toLowerCase().includes(searchQ.toLowerCase()))
        : roster;

    const isFull = boat.rowerUids.length >= boat.boatSize;

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                padding: "14px 16px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                gap: 12,
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f0eee8", marginBottom: 8, lineHeight: 1.3 }}>
                        {boat.categoryName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <SeatDots filled={boat.rowerUids.length} total={boat.boatSize} />
                        <span style={{
                            fontSize: 11,
                            color: isFull ? "#48c78e" : "rgba(255,255,255,0.35)",
                            fontWeight: isFull ? 600 : 400,
                        }}>
                            {isFull ? "Crew complete" : `${boat.rowerUids.length} / ${boat.boatSize} filled`}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onRemove}
                    disabled={removing}
                    style={{
                        flexShrink: 0,
                        background: "rgba(255,107,107,0.06)",
                        border: "1px solid rgba(255,107,107,0.18)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        color: removing ? "rgba(255,107,107,0.3)" : "#ff6b6b",
                        fontSize: 11, fontWeight: 600,
                        cursor: removing ? "default" : "pointer",
                        whiteSpace: "nowrap",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={e => !removing && ((e.currentTarget as HTMLElement).style.background = "rgba(255,107,107,0.12)")}
                    onMouseLeave={e => !removing && ((e.currentTarget as HTMLElement).style.background = "rgba(255,107,107,0.06)")}
                >
                    {removing ? "Removing…" : "Remove"}
                </button>
            </div>

            {/* Crew list */}
            <div style={{ padding: "8px 16px 0" }}>
                {boat.rowerUids.length === 0 ? (
                    <p style={{
                        fontSize: 12, color: "rgba(255,255,255,0.2)",
                        margin: "10px 0 12px", fontStyle: "italic",
                    }}>
                        No crew assigned — add athletes below or share the invite link.
                    </p>
                ) : (
                    boat.rowerUids.map(uid => (
                        <div key={uid} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "7px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: "rgba(254,185,89,0.1)",
                                border: "1px solid rgba(254,185,89,0.18)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700, color: "#FEB959",
                                flexShrink: 0,
                            }}>
                                {(names.get(uid) ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <span style={{ flex: 1, fontSize: 13, color: "#f0eee8" }}>
                                {names.get(uid) ?? uid.slice(0, 8)}
                            </span>
                            <button
                                onClick={() => handleRemoveAthlete(uid)}
                                disabled={removingUid === uid}
                                title="Remove from crew"
                                style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    border: "1px solid rgba(255,107,107,0.22)",
                                    background: "transparent",
                                    color: removingUid === uid ? "rgba(255,107,107,0.3)" : "#ff6b6b",
                                    fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0,
                                    cursor: removingUid === uid ? "default" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Action bar */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px 14px", flexWrap: "wrap",
            }}>
                {!isFull && (
                    <button
                        onClick={() => setSearchOpen(o => !o)}
                        style={{
                            flex: 1, minWidth: 120,
                            padding: "7px 12px", borderRadius: 8,
                            border: `1px solid ${searchOpen ? "rgba(254,185,89,0.5)" : "rgba(254,185,89,0.28)"}`,
                            background: searchOpen ? "rgba(254,185,89,0.1)" : "rgba(254,185,89,0.05)",
                            color: "#FEB959", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {searchOpen ? "Close search" : "+ Add from club"}
                    </button>
                )}
                {boat.inviteCode && (
                    <button
                        onClick={handleCopyLink}
                        style={{
                            padding: "7px 12px", borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent",
                            color: copied ? "#48c78e" : "rgba(255,255,255,0.38)",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                            transition: "color 0.2s", whiteSpace: "nowrap",
                        }}
                    >
                        {copied ? "✓ Link copied" : "Copy invite link"}
                    </button>
                )}
            </div>

            {/* Search panel */}
            {searchOpen && !isFull && (
                <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    padding: "12px 16px 14px",
                    background: "rgba(0,0,0,0.18)",
                }}>
                    <input
                        autoFocus
                        type="text"
                        placeholder={
                            loadingRoster
                                ? "Loading athletes…"
                                : `Search ${roster.length} eligible athlete${roster.length !== 1 ? "s" : ""}…`
                        }
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        disabled={loadingRoster}
                        style={{
                            width: "100%", padding: "8px 12px",
                            borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)", color: "#f0eee8",
                            fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                    />
                    {rosterErr && (
                        <p style={{ fontSize: 12, color: "#ff6b6b", margin: "8px 0 0" }}>{rosterErr}</p>
                    )}
                    {searchQ.trim().length > 0 && (
                        <div style={{
                            marginTop: 6, maxHeight: 200, overflowY: "auto",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8, background: "rgba(16,16,20,0.96)",
                        }}>
                            {filteredRoster.length === 0 ? (
                                <p style={{ padding: "10px 12px", margin: 0, fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
                                    No matches for "{searchQ}"
                                </p>
                            ) : filteredRoster.map((r, i) => {
                                const inOther  = allAssignedUids.has(r.uid) && !boat.rowerUids.includes(r.uid);
                                const inThis   = boat.rowerUids.includes(r.uid);
                                const isAdding = addingUid === r.uid;
                                const disabled = inOther || inThis || !!addingUid;
                                return (
                                    <div key={r.uid} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "8px 12px",
                                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                    }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: "50%",
                                            background: "rgba(255,255,255,0.05)", flexShrink: 0,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
                                        }}>
                                            {r.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                color: (disabled && !isAdding) ? "rgba(255,255,255,0.28)" : "#f0eee8",
                                            }}>
                                                {r.displayName}
                                            </div>
                                            {inThis   && <div style={{ fontSize: 10, color: "#48c78e" }}>Already in crew</div>}
                                            {inOther  && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>In another entry</div>}
                                        </div>
                                        <button
                                            onClick={() => !disabled && handleAdd(r)}
                                            disabled={disabled}
                                            style={{
                                                padding: "4px 12px", borderRadius: 6, flexShrink: 0,
                                                border: `1px solid ${(disabled && !isAdding) ? "rgba(255,255,255,0.07)" : "rgba(254,185,89,0.38)"}`,
                                                background: (disabled && !isAdding) ? "transparent" : "rgba(254,185,89,0.08)",
                                                color: (disabled && !isAdding) ? "rgba(255,255,255,0.2)" : "#FEB959",
                                                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                                                cursor: disabled ? "default" : "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {isAdding ? "Adding…" : inThis ? "Added" : "Add"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CoachCrewBuilderModal({
    eventId, eventName, boatIds, getCategoryFee, requiresPayment, onPay, onClose, onBoatsChanged,
}: CoachCrewBuilderModalProps) {
    const [boats, setBoats]           = useState<BoatState[]>([]);
    const [names, setNames]           = useState<Map<string, string>>(new Map());
    const [loading, setLoading]       = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // Load all boats once on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const loaded: BoatState[] = [];
            await Promise.all(boatIds.map(async id => {
                try {
                    const snap = await getDoc(doc(db, "events", eventId, "boats", id));
                    if (!cancelled && snap.exists()) {
                        const data = snap.data() as any;
                        loaded.push({
                            id,
                            categoryId:   data.categoryId ?? "",
                            categoryName: data.categoryName ?? data.category ?? "",
                            boatSize:     data.boatSize ?? 1,
                            rowerUids:    data.rowerUids ?? [],
                            inviteCode:   data.inviteCode ?? null,
                        });
                    }
                } catch { /* skip missing boats */ }
            }));
            if (!cancelled) {
                setBoats(boatIds.map(id => loaded.find(b => b.id === id)).filter(Boolean) as BoatState[]);
                setLoading(false);
                // Resolve names for any athletes already assigned
                const existingUids = [...new Set(loaded.flatMap(b => b.rowerUids))];
                if (existingUids.length) {
                    const nameMap = new Map<string, string>();
                    for (let i = 0; i < existingUids.length; i += 10) {
                        const batch = existingUids.slice(i, i + 10);
                        const snap = await getDocs(
                            query(collection(db, "users"), where(documentId(), "in", batch))
                        );
                        snap.docs.forEach(d => {
                            const data = d.data() as any;
                            nameMap.set(d.id, data.displayName?.trim() || data.fullName?.trim() || d.id.slice(0, 8));
                        });
                    }
                    if (!cancelled) setNames(nameMap);
                }
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function addName(uid: string, name: string) {
        setNames(prev => {
            if (prev.get(uid) === name) return prev;
            const next = new Map(prev);
            next.set(uid, name);
            return next;
        });
    }

    function updateBoat(updated: BoatState) {
        setBoats(prev => prev.map(b => b.id === updated.id ? updated : b));
    }

    async function handleRemoveBoat(boatId: string) {
        setRemovingId(boatId);
        try {
            await deleteBoat(eventId, boatId);
            setBoats(prev => prev.filter(b => b.id !== boatId));
            onBoatsChanged();
        } catch (e: any) {
            alert(e?.message ?? "Failed to remove entry.");
        } finally {
            setRemovingId(null);
        }
    }

    const allAssignedUids = useMemo(() => {
        const s = new Set<string>();
        boats.forEach(b => b.rowerUids.forEach(uid => s.add(uid)));
        return s;
    }, [boats]);

    const totalFeeCents = useMemo(
        () => boats.reduce((sum, b) => sum + getCategoryFee(b.categoryId), 0),
        [boats, getCategoryFee]
    );

    const incompleteCount = boats.filter(b => b.rowerUids.length < b.boatSize).length;
    const canPay = requiresPayment && totalFeeCents > 0;

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.78)", zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading entries…</div>
            </div>
        );
    }

    return (
        <div
            style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.78)",
                backdropFilter: "blur(6px)",
                zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 16,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: "100%", maxWidth: 660,
                maxHeight: "88vh",
                display: "flex", flexDirection: "column",
                background: "#1a1a1e",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
                overflow: "hidden",
            }}>
                {/* ── Header ── */}
                <div style={{
                    padding: "20px 24px 18px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    gap: 12, flexShrink: 0,
                }}>
                    <div>
                        <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: "rgba(254,185,89,0.6)", marginBottom: 5,
                        }}>
                            Configure Entries
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#f0eee8", lineHeight: 1.2 }}>
                            {eventName}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 5 }}>
                            {boats.length} {boats.length === 1 ? "entry" : "entries"}
                            {canPay && totalFeeCents > 0 && (
                                <> · {fmtFee(totalFeeCents)} total</>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 32, height: 32, borderRadius: "50%",
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.4)", fontSize: 18,
                            cursor: "pointer", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{
                    flex: 1, overflowY: "auto",
                    padding: 24, display: "flex", flexDirection: "column", gap: 12,
                }}>
                    {boats.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 0" }}>
                            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.12 }}>🚣</div>
                            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.22)", marginBottom: 20 }}>
                                All entries removed.
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: "8px 20px", borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    background: "transparent", color: "rgba(255,255,255,0.38)",
                                    fontSize: 13, cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        boats.map(boat => (
                            <BoatCard
                                key={boat.id}
                                boat={boat}
                                eventId={eventId}
                                allAssignedUids={allAssignedUids}
                                names={names}
                                onNameResolved={addName}
                                onUpdate={updateBoat}
                                onRemove={() => handleRemoveBoat(boat.id)}
                                removing={removingId === boat.id}
                            />
                        ))
                    )}
                </div>

                {/* ── Footer ── */}
                {boats.length > 0 && (
                    <div style={{
                        padding: "16px 24px",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                        display: "flex", flexDirection: "column", gap: 10,
                        background: "#1a1a1e", flexShrink: 0,
                    }}>
                        {incompleteCount > 0 && (
                            <div style={{
                                display: "flex", alignItems: "flex-start", gap: 10,
                                padding: "10px 14px",
                                background: "rgba(254,185,89,0.07)",
                                border: "1px solid rgba(254,185,89,0.22)",
                                borderRadius: 10,
                                fontSize: 12, color: "rgba(254,185,89,0.85)", lineHeight: 1.55,
                            }}>
                                <span style={{ fontSize: 13, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>⚠</span>
                                <span>
                                    {incompleteCount === 1 ? "1 entry has" : `${incompleteCount} entries have`} an incomplete crew.
                                    {" "}Athletes can join via invite link after checkout.
                                </span>
                            </div>
                        )}
                        {canPay ? (
                            <button
                                className="esu-btn-primary"
                                onClick={() => onPay(boats.map(b => b.id))}
                                style={{
                                    width: "100%", padding: "13px",
                                    fontSize: 14, fontWeight: 700, borderRadius: 12,
                                }}
                            >
                                Pay for {boats.length} {boats.length === 1 ? "entry" : "entries"} — {fmtFee(totalFeeCents)}
                            </button>
                        ) : (
                            <button
                                className="esu-btn-primary"
                                onClick={onClose}
                                style={{
                                    width: "100%", padding: "13px",
                                    fontSize: 14, fontWeight: 700, borderRadius: 12,
                                }}
                            >
                                Done — view entries below
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
