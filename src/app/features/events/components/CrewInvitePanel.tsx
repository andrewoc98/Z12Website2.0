import { useEffect, useState } from "react";
import { listClubRowers, addClubAthleteToBoat } from "../../signup/services/crewInviteService";
import type { BoatDoc } from "../../signup/types";

type ClubRower = { uid: string; displayName: string; clubName: string };

interface Props {
    boat: BoatDoc & { id: string };
    eventId: string;
    inviteUrl: string | null;
    onAthleteAdded: () => void;
}

export default function CrewInvitePanel({ boat, eventId, inviteUrl, onAthleteAdded }: Props) {
    const [rowers, setRowers]         = useState<ClubRower[]>([]);
    const [loading, setLoading]       = useState(true);
    const [fetchErr, setFetchErr]     = useState<string | null>(null);
    const [search, setSearch]         = useState("");
    const [addingUid, setAddingUid]   = useState<string | null>(null);
    const [addErr, setAddErr]         = useState<string | null>(null);
    const [copied, setCopied]         = useState(false);

    const categoryName = (boat as any).categoryName ?? (boat as any).category ?? "";

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFetchErr(null);
        listClubRowers({ eventId, boatId: boat.id, categoryName })
            .then((res) => { if (!cancelled) setRowers(res.rowers); })
            .catch((e: any) => { if (!cancelled) setFetchErr(e?.message ?? "Failed to load athletes"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    // Re-fetch when rowerUids changes (after an athlete is added)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, boat.id, (boat.rowerUids ?? []).join(",")]);

    async function handleAdd(athleteUid: string) {
        setAddingUid(athleteUid);
        setAddErr(null);
        try {
            await addClubAthleteToBoat({ eventId, boatId: boat.id, athleteUid });
            onAthleteAdded();
        } catch (e: any) {
            setAddErr(e?.message ?? "Failed to add athlete");
        } finally {
            setAddingUid(null);
        }
    }

    async function handleCopy() {
        if (!inviteUrl) return;
        try {
            await navigator.clipboard.writeText(inviteUrl);
        } catch {
            window.prompt("Copy this invite link:", inviteUrl);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    const q = search.toLowerCase().trim();
    const filtered = q ? rowers.filter((r) => r.displayName.toLowerCase().includes(q)) : [];

    // Extract the 12-char code from the invite URL
    const inviteCode = inviteUrl ? inviteUrl.split("/").pop() ?? null : null;

    return (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* ── Club athlete assignment ── */}
            <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Add from club
                </div>

                {loading && (
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Loading athletes…</p>
                )}

                {fetchErr && (
                    <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{fetchErr}</p>
                )}

                {!loading && !fetchErr && rowers.length === 0 && (
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>No eligible athletes in your club for this category.</p>
                )}

                {!loading && !fetchErr && rowers.length > 0 && (
                    <>
                        <input
                            type="text"
                            placeholder={`Search ${rowers.length} eligible athlete${rowers.length !== 1 ? "s" : ""}…`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "7px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: "var(--surface-2)",
                                color: "var(--text)",
                                fontSize: 13,
                                boxSizing: "border-box",
                                marginBottom: 6,
                            }}
                        />

                        {q && (
                            <div style={{
                                maxHeight: 260,
                                overflowY: "auto",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                background: "var(--surface-2)",
                                marginBottom: 4,
                            }}>
                            {filtered.length === 0 ? (
                                <p style={{ padding: "10px 12px", margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                                    No athletes match "{search}"
                                </p>
                            ) : filtered.map((r, i) => (
                                <div
                                    key={r.uid}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 12px",
                                        borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: "var(--text)" }}>{r.displayName}</div>
                                        {r.clubName && (
                                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{r.clubName}</div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={addingUid === r.uid}
                                        onClick={() => handleAdd(r.uid)}
                                        style={{
                                            padding: "4px 12px",
                                            borderRadius: 6,
                                            border: "1px solid rgba(254,185,89,0.4)",
                                            background: addingUid === r.uid ? "rgba(254,185,89,0.05)" : "rgba(254,185,89,0.12)",
                                            color: "#FEB959",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: addingUid === r.uid ? "default" : "pointer",
                                            whiteSpace: "nowrap",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {addingUid === r.uid ? "Adding…" : "Add"}
                                    </button>
                                </div>
                            ))}
                        </div>
                        )}

                        {addErr && (
                            <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 4, marginBottom: 0 }}>{addErr}</p>
                        )}
                    </>
                )}
            </div>

            {/* ── Copy link fallback ── */}
            {inviteCode && (
                <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    paddingTop: 10,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Or share invite link
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                            fontFamily: "monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.6)",
                            letterSpacing: "0.12em",
                            flex: 1,
                        }}>
                            {inviteCode}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            style={{
                                padding: "4px 12px",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: "transparent",
                                color: copied ? "#4ade80" : "rgba(255,255,255,0.5)",
                                fontSize: 12,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                            }}
                        >
                            {copied ? "✓ Copied" : "Copy link"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
