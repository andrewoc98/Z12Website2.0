import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents, updateEvent } from "../../events/api/events";
import type { EventDoc } from "../../events/types";
import { listBoatsForEvent, startBoat, finishBoat } from "../../signup/api/boats";

function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function isDateInRange(ymd: string, start: string, end: string) {
    return ymd >= start && ymd <= end;
}

export default function TimingPage() {
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [boats, setBoats] = useState<any[]>([]);
    const [tab, setTab] = useState<"starter" | "finisher">("starter");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function refresh(evId?: string) {
        const e = await listEvents();
        setEvents(e);
        const id = evId || selectedEventId || e[0]?.id || "";
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

    // Live-ish updates (mock mode). In Firestore this becomes real-time.
    useEffect(() => {
        if (!selectedEventId) return;
        const t = setInterval(() => refresh(selectedEventId), 1000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId]);

    const selectedEvent = useMemo(
        () => events.find((x) => x.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    const canTimeToday = useMemo(() => {
        if (!selectedEvent) return false;
        const ymd = todayYMD();
        return isDateInRange(ymd, selectedEvent.startDate, selectedEvent.endDate);
    }, [selectedEvent]);

    const boatsWithBows = useMemo(() => {
        return boats
            .filter((b) => typeof b.bowNumber === "number")
            .slice()
            .sort((a, b) => (a.bowNumber ?? 999999) - (b.bowNumber ?? 999999));
    }, [boats]);

    const starterList = useMemo(() => {
        return boatsWithBows.filter((b) => !b.startedAt);
    }, [boatsWithBows]);

    const finisherList = useMemo(() => {
        return boatsWithBows.filter((b) => b.startedAt && !b.finishedAt);
    }, [boatsWithBows]);

    async function onStart(id: string) {
        setBusyId(id);
        setMsg(null);
        try {
            await startBoat(id);
            // optional: set event status
            if (selectedEvent?.id && selectedEvent.status === "closed") {
                await updateEvent(selectedEvent.id, { status: "running" });
            }
            await refresh(selectedEventId);
        } finally {
            setBusyId(null);
        }
    }

    async function onFinish(id: string) {
        setBusyId(id);
        setMsg(null);
        try {
            await finishBoat(id);
            await refresh(selectedEventId);
        } finally {
            setBusyId(null);
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
                            <option key={e.id ?? e.name} value={e.id ?? ""}>
                                {e.name} ({e.status})
                            </option>
                        ))}
                    </select>
                </label>

                {selectedEvent && (
                    <>
                        <div style={{ marginTop: 10, opacity: 0.85 }}>
                            <div><b>Dates:</b> {selectedEvent.startDate} → {selectedEvent.endDate}</div>
                            <div><b>Timing active today?</b> {canTimeToday ? "Yes" : "No"}</div>
                        </div>

                        {!canTimeToday && (
                            <p style={{ color: "crimson", marginTop: 10 }}>
                                Timing is only available on the event start/end date range (day-based).
                            </p>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                            <button className="btn-primary" onClick={() => setTab("starter")} disabled={tab === "starter"}>
                                Starter ({starterList.length})
                            </button>
                            <button className="btn-primary" onClick={() => setTab("finisher")} disabled={tab === "finisher"}>
                                Finisher ({finisherList.length})
                            </button>
                            <button className="btn-primary" onClick={() => refresh(selectedEventId)}>Refresh</button>
                        </div>

                        {msg && <p>{msg}</p>}

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
                                            <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                    <b>Bow {b.bowNumber}</b>
                                                    <span style={{ opacity: 0.8 }}>{b.clubName}</span>
                                                </div>
                                                <div style={{ opacity: 0.9 }}>{b.category}</div>
                                                <div style={{ opacity: 0.8 }}>Boat size: {b.boatSize}</div>

                                                <button
                                                    style={{ marginTop: 10 }}
                                                    disabled={!canTimeToday || busyId === b.id}
                                                    onClick={() => onStart(b.id)}
                                                >
                                                    {busyId === b.id ? "Starting..." : "Start"}
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
                                            <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                    <b>Bow {b.bowNumber}</b>
                                                    <span style={{ opacity: 0.8 }}>{b.clubName}</span>
                                                </div>
                                                <div style={{ opacity: 0.9 }}>{b.category}</div>

                                                <button
                                                    style={{ marginTop: 10 }}
                                                    disabled={!canTimeToday || busyId === b.id}
                                                    onClick={() => onFinish(b.id)}
                                                >
                                                    {busyId === b.id ? "Finishing..." : "Finish"}
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

