import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventCategory, EventDoc } from "../types";
import { listEvents, updateEvent } from "../api/events";
import { listBoatsForEvent, assignBowNumbersForEvent } from "../../signup/api/boats";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import { useAuth } from "../../../providers/AuthProvider";

type BoatLite = {
    id: string;
    clubName: string;

    category?: string;
    categoryName?: string;
    categoryId?: string;

    boatSize: number;
    bowNumber?: number;
    createdAt?: number;
};

function boatCategoryLabel(b: BoatLite) {
    return b.categoryName ?? b.category ?? b.categoryId ?? "—";
}

const PAGE_SIZE = 10;

export default function HostEventManagePage() {
    const mock = DEV_MODE ? useMockAuth() : null;
    const fb = !DEV_MODE ? useAuth() : null;

    const hostUid = DEV_MODE ? mock?.user?.uid ?? null : fb?.user?.uid ?? null;

    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [boats, setBoats] = useState<BoatLite[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // pagination state
    const [page, setPage] = useState(1);

    const selectedEvent = useMemo(
        () => events.find((e) => e.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    async function refreshEvents(preserveId?: string) {
        const all = await listEvents();
        const mine = hostUid ? all.filter((e: any) => e.createdByUid === hostUid) : [];
        setEvents(mine);

        const nextId = preserveId || selectedEventId || mine[0]?.id || "";
        setSelectedEventId(nextId);
        return nextId;
    }

    async function refreshBoats(eventId: string) {
        const b = await listBoatsForEvent(eventId);
        setBoats(b as any);
    }

    async function refreshAll(preserveId?: string) {
        setMsg(null);
        const id = await refreshEvents(preserveId);
        if (id) await refreshBoats(id);
        else setBoats([]);
    }

    useEffect(() => {
        setPage(1);
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostUid]);

    useEffect(() => {
        if (!selectedEventId) return;
        setPage(1);
        refreshBoats(selectedEventId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId]);

    // --- Boats summary counts keyed by categoryId (preferred) OR by name (fallback)
    const categoryCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of boats) {
            const key = b.categoryId ?? boatCategoryLabel(b);
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [boats]);

    // ✅ Summary rows: only categories with > 0 entrants
    const summaryRows = useMemo(() => {
        if (!selectedEvent) return [];

        const cats = selectedEvent.categories ?? [];
        const rows = cats
            .map((c: EventCategory) => ({
                id: c.id,
                name: c.name,
                count: categoryCounts.get(c.id) ?? 0,
            }))
            .filter((r) => r.count > 0);

        // optional: sort by entrants desc, then name
        rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        return rows;
    }, [selectedEvent, categoryCounts]);

    const boatsSorted = useMemo(() => {
        const hasAnyBow = boats.some((b) => typeof b.bowNumber === "number");
        const copy = boats.slice();
        if (hasAnyBow) {
            copy.sort((a, b) => (a.bowNumber ?? 999999) - (b.bowNumber ?? 999999));
        } else {
            copy.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        }
        return copy;
    }, [boats]);

    // ✅ Pagination derived values
    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(boatsSorted.length / PAGE_SIZE));
    }, [boatsSorted.length]);

    // keep page in range if boats change
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        if (page < 1) setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalPages]);

    const boatsPage = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return boatsSorted.slice(start, start + PAGE_SIZE);
    }, [boatsSorted, page]);

    async function onAssignBows() {
        if (!selectedEvent) return;
        setBusy(true);
        setMsg(null);
        try {
            const categoryOrder = (selectedEvent.categories ?? []).map((c: EventCategory) => c.id);
            await assignBowNumbersForEvent(selectedEvent.id, categoryOrder);
            await refreshBoats(selectedEvent.id);
            setMsg("Assigned bow numbers (unique across event).");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to assign bow numbers.");
        } finally {
            setBusy(false);
        }
    }

    async function onCloseRegistration() {
        if (!selectedEvent) return;
        setBusy(true);
        setMsg(null);
        try {
            const categoryOrder = (selectedEvent.categories ?? []).map((c: EventCategory) => c.id);
            await assignBowNumbersForEvent(selectedEvent.id, categoryOrder);

            await updateEvent(selectedEvent.id, { status: "closed" } as any);

            await refreshAll(selectedEvent.id);
            setMsg("Closed registration and ensured bow numbers are assigned.");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to close registration.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <h1>Manage Event (Host)</h1>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    <div>
                        hostUid: <b>{hostUid || "—"}</b>
                    </div>
                    <div>
                        selectedEventId: <b>{selectedEventId || "—"}</b>
                    </div>
                    <div>
                        boats loaded: <b>{boats.length}</b>
                    </div>
                </div>

                {!hostUid ? (
                    <p>Not signed in as a host.</p>
                ) : events.length === 0 ? (
                    <p>No events found for this host yet.</p>
                ) : (
                    <>
                        <label>
                            Event
                            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                                {events.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} ({e.status})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedEvent && (
                            <>
                                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                                    <div>
                                        <b>Status:</b> {selectedEvent.status}
                                    </div>
                                    <div>
                                        <b>Location:</b> {selectedEvent.location}
                                    </div>

                                    {"startDate" in (selectedEvent as any) && (
                                        <div>
                                            <b>Dates:</b> {(selectedEvent as any).startDate} → {(selectedEvent as any).endDate}
                                        </div>
                                    )}
                                    {"closingDate" in (selectedEvent as any) && (
                                        <div>
                                            <b>Closes:</b> {(selectedEvent as any).closingDate}
                                        </div>
                                    )}

                                    <div>
                                        <b>Length:</b> {selectedEvent.lengthMeters}m
                                    </div>
                                    <div>
                                        <b>Created by:</b> {selectedEvent.createdByName}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                                    <button disabled={busy} onClick={onAssignBows}>
                                        {busy ? "Working..." : "Assign Bow Numbers"}
                                    </button>

                                    <button disabled={busy || selectedEvent.status === "closed"} onClick={onCloseRegistration}>
                                        {selectedEvent.status === "closed" ? "Registration Closed" : "Close Registration"}
                                    </button>

                                    <button disabled={busy} onClick={() => refreshAll(selectedEvent.id)}>
                                        Refresh
                                    </button>
                                </div>

                                {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

                                <hr style={{ margin: "18px 0" }} />

                                <h2>Boats Summary</h2>

                                {summaryRows.length === 0 ? (
                                    <p className="muted">No signups yet (all categories are 0).</p>
                                ) : (
                                    <ul>
                                        {summaryRows.map((r) => (
                                            <li key={r.id}>
                                                {r.name}: <b>{r.count}</b>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <h2 style={{ marginTop: 18 }}>Boats</h2>

                                {boatsSorted.length === 0 ? (
                                    <p>No boats registered yet.</p>
                                ) : (
                                    <>
                                        {/* ✅ Pagination controls */}
                                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                disabled={page <= 1}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            >
                                                ← Prev
                                            </button>

                                            <span className="muted" style={{ fontWeight: 700 }}>
                                                Page {page} of {totalPages}
                                            </span>

                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                disabled={page >= totalPages}
                                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            >
                                                Next →
                                            </button>
                                        </div>

                                        <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                            {boatsPage.map((b) => (
                                                <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                        <b>{b.clubName}</b>
                                                        <span style={{ fontSize: 12, opacity: 0.8 }}>
                                                            Bow: {b.bowNumber ?? "—"}
                                                        </span>
                                                    </div>
                                                    <div style={{ opacity: 0.9 }}>{boatCategoryLabel(b)}</div>
                                                    <div style={{ opacity: 0.8 }}>Boat size: {b.boatSize}</div>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
