import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc } from "../../events/types";
import { DEV_MODE } from "../../../shared/lib/config";

import { listBoatsForEvent, startBoat, finishBoat } from "../../signup/api/boats";

// Firestore (for events when DEV_MODE=false)
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

import { updateEvent } from "../../events/api/events";

type EventWithId = EventDoc & { id: string };

// ---------- helpers ----------
function ymdFromDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

function todayYMD() {
    return ymdFromDate(new Date());
}

function isDateInRange(ymd: string, start: string, end: string) {
    return ymd >= start && ymd <= end;
}

function tsToYMD(ts: any): string {
    // Firestore Timestamp has toDate()
    if (!ts) return "";
    if (typeof ts === "string") return ts; // if mock uses strings
    if (typeof ts.toDate === "function") return ymdFromDate(ts.toDate());
    if (ts instanceof Date) return ymdFromDate(ts);
    return "";
}

async function listEventsFirestore(): Promise<EventWithId[]> {
    const q = query(collection(db, "events"), orderBy("startAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as EventDoc) }));
}

// If you have mock events, wire them here. For now, empty list.
async function listEventsMock(): Promise<EventWithId[]> {
    return [];
}

export default function TimingPage() {
    const [events, setEvents] = useState<EventWithId[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [boats, setBoats] = useState<any[]>([]);
    const [tab, setTab] = useState<"starter" | "finisher">("starter");
    const [busyBoatId, setBusyBoatId] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function refresh(forceEventId?: string) {
        const evs = DEV_MODE ? await listEventsMock() : await listEventsFirestore();
        setEvents(evs);

        const id = forceEventId || selectedEventId || evs[0]?.id || "";
        setSelectedEventId(id);

        if (id) {
            const b = await listBoatsForEvent(id);
            setBoats(b);
        } else {
            setBoats([]);
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedEventId) return;
        refresh(selectedEventId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId]);

    // Polling: keep for DEV_MODE, disable for Firestore (we should use onSnapshot later)
    useEffect(() => {
        if (!selectedEventId) return;
        if (!DEV_MODE) return;

        const t = setInterval(() => refresh(selectedEventId), 1000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId]);

    const selectedEvent = useMemo(
        () => events.find((x) => x.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    const eventStartYMD = useMemo(() => tsToYMD(selectedEvent?.startAt), [selectedEvent]);
    const eventEndYMD = useMemo(() => tsToYMD(selectedEvent?.endAt), [selectedEvent]);

    const canTimeToday = useMemo(() => {
        if (!selectedEvent) return false;
        if (!eventStartYMD || !eventEndYMD) return false;
        const ymd = todayYMD();
        return isDateInRange(ymd, eventStartYMD, eventEndYMD);
    }, [selectedEvent, eventStartYMD, eventEndYMD]);

    const boatsWithBows = useMemo(() => {
        return boats
            .filter((b) => typeof b.bowNumber === "number")
            .slice()
            .sort((a, b) => (a.bowNumber ?? 999999) - (b.bowNumber ?? 999999));
    }, [boats]);

    const starterList = useMemo(() => boatsWithBows.filter((b) => !b.startedAt), [boatsWithBows]);
    const finisherList = useMemo(() => boatsWithBows.filter((b) => b.startedAt && !b.finishedAt), [boatsWithBows]);

    async function onStartBoat(boatId: string) {
        if (!selectedEventId) return;
        setBusyBoatId(boatId);
        setMsg(null);
        try {
            await startBoat(selectedEventId, boatId);

            if (selectedEvent?.id && selectedEvent.status === "closed") {
                await updateEvent(selectedEvent.id, { status: "running" });
            }

            await refresh(selectedEventId);
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to start boat");
        } finally {
            setBusyBoatId(null);
        }
    }

    async function onFinishBoat(boatId: string) {
        if (!selectedEventId) return;

        setBusyBoatId(boatId);
        setMsg(null);

        try {
            // 1) persist finish time
            await finishBoat(selectedEventId, boatId);

            // 2) fetch the latest boats directly (don’t rely on React state)
            const latestBoats = await listBoatsForEvent(selectedEventId);

            // only consider boats that have bow numbers (same set you time)
            const timedBoats = latestBoats.filter((b) => typeof b.bowNumber === "number");

            const allFinished =
                timedBoats.length > 0 &&
                timedBoats.every((b) => !!b.finishedAt);

            // 3) if this was the last finish, mark event finished
            if (selectedEvent?.status === "running" && allFinished) {
                await updateEvent(selectedEventId, { status: "finished" });
                setMsg("Event marked as finished.");
            }

            // 4) refresh UI state after status update
            await refresh(selectedEventId);
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to finish boat");
        } finally {
            setBusyBoatId(null);
        }
    }



    return (
        <>
            <Navbar />
            <main>
                <h1>Timing</h1>

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
                        <div style={{ marginTop: 10, opacity: 0.85 }}>
                            <div>
                                <b>Dates:</b> {eventStartYMD || "—"} → {eventEndYMD || "—"}
                            </div>
                            <div>
                                <b>Timing active today?</b> {canTimeToday ? "Yes" : "No"}
                            </div>
                        </div>

                        {!canTimeToday && (
                            <p style={{ color: "crimson", marginTop: 10 }}>
                                Timing is only available on the event start/end date range (day-based).
                            </p>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                            <button className="btn-primary" onClick={() => setTab("starter")} disabled={tab === "starter"}>
                                Starter ({starterList.length})
                            </button>
                            <button className="btn-primary" onClick={() => setTab("finisher")} disabled={tab === "finisher"}>
                                Finisher ({finisherList.length})
                            </button>
                            <button className="btn-primary" onClick={() => refresh(selectedEventId)}>
                                Refresh
                            </button>
                        </div>

                        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

                        <hr style={{ margin: "18px 0" }} />

                        {tab === "starter" ? (
                            <>
                                <h2>Starter</h2>
                                <p>Start boats in bow order.</p>

                                {starterList.length === 0 ? (
                                    <p>No boats waiting to start.</p>
                                ) : (
                                    <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                        {starterList.map((b) => (
                                            <li key={b.id} className="card card--tight">
                                                <div className="space-between">
                                                    <b>Bow {b.bowNumber}</b>
                                                    <span className="muted">{b.clubName}</span>
                                                </div>

                                                <div className="muted" style={{ marginTop: 6 }}>
                                                    {b.categoryName ?? b.category ?? "—"}
                                                </div>
                                                <div className="muted">Boat size: {b.boatSize}</div>

                                                <button
                                                    style={{ marginTop: 10 }}
                                                    disabled={!canTimeToday || busyBoatId === b.id}
                                                    onClick={() => onStartBoat(b.id)}
                                                >
                                                    {busyBoatId === b.id ? "Starting..." : "Start"}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        ) : (
                            <>
                                <h2>Finisher</h2>
                                <p>Finish boats that have started.</p>

                                {finisherList.length === 0 ? (
                                    <p>No boats currently on course.</p>
                                ) : (
                                    <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                        {finisherList.map((b) => (
                                            <li key={b.id} className="card card--tight">
                                                <div className="space-between">
                                                    <b>Bow {b.bowNumber}</b>
                                                    <span className="muted">{b.clubName}</span>
                                                </div>

                                                <div className="muted" style={{ marginTop: 6 }}>
                                                    {b.categoryName ?? b.category ?? "—"}
                                                </div>

                                                <button
                                                    style={{ marginTop: 10 }}
                                                    disabled={!canTimeToday || busyBoatId === b.id}
                                                    onClick={() => onFinishBoat(b.id)}
                                                >
                                                    {busyBoatId === b.id ? "Finishing..." : "Finish"}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
