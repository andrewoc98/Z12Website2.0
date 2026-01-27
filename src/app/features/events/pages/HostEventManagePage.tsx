import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventCategory, EventDoc } from "../types";
import { listEvents, updateEvent } from "../api/events";
import { listBoatsForEvent, assignBowNumbersForEvent } from "../../signup/api/boats";

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
    const { eventId } = useParams<{ eventId: string }>();

    const [event, setEvent] = useState<(EventDoc & { id: string }) | null>(null);
    const [boats, setBoats] = useState<BoatLite[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // pagination
    const [page, setPage] = useState(1);

    /* ----------------------------- data loading ----------------------------- */

    useEffect(() => {
        if (!eventId) return;

        (async () => {
            const all = await listEvents();
            const found = all.find((e: any) => e.id === eventId);
            setEvent(found ?? null);
        })();
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        setPage(1);
        listBoatsForEvent(eventId).then((b) => setBoats(b as any));
    }, [eventId]);

    async function refreshEvent() {
        if (!eventId) return;
        const all = await listEvents();
        setEvent(all.find((e: any) => e.id === eventId) ?? null);
    }

    async function refreshBoats() {
        if (!eventId) return;
        const b = await listBoatsForEvent(eventId);
        setBoats(b as any);
    }

    /* ------------------------------ derived data ----------------------------- */

    const categoryCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of boats) {
            const key = b.categoryId ?? boatCategoryLabel(b);
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [boats]);

    const summaryRows = useMemo(() => {
        if (!event) return [];
        return (event.categories ?? [])
            .map((c: EventCategory) => ({
                id: c.id,
                name: c.name,
                count: categoryCounts.get(c.id) ?? 0,
            }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [event, categoryCounts]);

    const boatsSorted = useMemo(() => {
        const hasAnyBow = boats.some((b) => typeof b.bowNumber === "number");
        const copy = boats.slice();

        copy.sort((a, b) =>
            hasAnyBow
                ? (a.bowNumber ?? 999999) - (b.bowNumber ?? 999999)
                : (a.createdAt ?? 0) - (b.createdAt ?? 0)
        );

        return copy;
    }, [boats]);

    const totalPages = Math.max(1, Math.ceil(boatsSorted.length / PAGE_SIZE));

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        if (page < 1) setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalPages]);

    const boatsPage = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return boatsSorted.slice(start, start + PAGE_SIZE);
    }, [boatsSorted, page]);

    /* ------------------------------- actions -------------------------------- */

    async function onAssignBows() {
        if (!event) return;
        setBusy(true);
        setMsg(null);
        try {
            const categoryOrder = (event.categories ?? []).map((c: EventCategory) => c.id);
            await assignBowNumbersForEvent(event.id, categoryOrder);
            await refreshBoats();
            setMsg("Assigned bow numbers (unique across event).");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to assign bow numbers.");
        } finally {
            setBusy(false);
        }
    }

    async function onCloseRegistration() {
        if (!event) return;
        setBusy(true);
        setMsg(null);
        try {
            const categoryOrder = (event.categories ?? []).map((c: EventCategory) => c.id);
            await assignBowNumbersForEvent(event.id, categoryOrder);
            await updateEvent(event.id, { status: "closed" } as any);
            await refreshEvent();
            setMsg("Closed registration and ensured bow numbers are assigned.");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to close registration.");
        } finally {
            setBusy(false);
        }
    }

    /* -------------------------------- render -------------------------------- */

    return (
        <>
            <Navbar />
            <main>
                <Link to="/host/events" className="btn-ghost">
                    ← Back to My Events
                </Link>

                {!event ? (
                    <p>Loading event…</p>
                ) : (
                    <>
                        <h1>Manage Event</h1>

                        {/* Debug info (optional) */}
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                            <div>
                                eventId: <b>{event.id}</b>
                            </div>
                            <div>
                                boats loaded: <b>{boats.length}</b>
                            </div>
                        </div>

                        {/* Event details */}
                        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                            <div>
                                <b>Name:</b> {event.name}
                            </div>
                            <div>
                                <b>Status:</b> {event.status}
                            </div>
                            <div>
                                <b>Location:</b> {event.location}
                            </div>

                            {"startDate" in (event as any) && (
                                <div>
                                    <b>Dates:</b>{" "}
                                    {(event as any).startDate} → {(event as any).endDate}
                                </div>
                            )}

                            {"closingDate" in (event as any) && (
                                <div>
                                    <b>Closes:</b> {(event as any).closingDate}
                                </div>
                            )}

                            <div>
                                <b>Length:</b> {event.lengthMeters}m
                            </div>
                            <div>
                                <b>Created by:</b> {event.createdByName}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                            <button disabled={busy} onClick={onAssignBows}>
                                {busy ? "Working..." : "Assign Bow Numbers"}
                            </button>

                            <button
                                disabled={busy || event.status === "closed"}
                                onClick={onCloseRegistration}
                            >
                                {event.status === "closed"
                                    ? "Registration Closed"
                                    : "Close Registration"}
                            </button>

                            <button disabled={busy} onClick={refreshBoats}>
                                Refresh
                            </button>
                        </div>

                        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

                        <hr style={{ margin: "18px 0" }} />

                        {/* Boats summary */}
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

                        {/* Boats list */}
                        <h2 style={{ marginTop: 18 }}>Boats</h2>

                        {boatsSorted.length === 0 ? (
                            <p>No boats registered yet.</p>
                        ) : (
                            <>
                                {/* Pagination */}
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                        marginBottom: 10,
                                    }}
                                >
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
                                        onClick={() =>
                                            setPage((p) => Math.min(totalPages, p + 1))
                                        }
                                    >
                                        Next →
                                    </button>
                                </div>

                                <ul
                                    style={{
                                        display: "grid",
                                        gap: 10,
                                        padding: 0,
                                        listStyle: "none",
                                    }}
                                >
                                    {boatsPage.map((b) => (
                                        <li
                                            key={b.id}
                                            style={{
                                                border: "1px solid #eee",
                                                borderRadius: 12,
                                                padding: 12,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                }}
                                            >
                                                <b>{b.clubName}</b>
                                                <span style={{ fontSize: 12, opacity: 0.8 }}>
                                                    Bow: {b.bowNumber ?? "—"}
                                                </span>
                                            </div>
                                            <div style={{ opacity: 0.9 }}>
                                                {boatCategoryLabel(b)}
                                            </div>
                                            <div style={{ opacity: 0.8 }}>
                                                Boat size: {b.boatSize}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
