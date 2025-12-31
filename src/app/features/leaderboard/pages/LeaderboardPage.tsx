import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";
import { getElapsedMs, listBoatsForEvent } from "../../signup/api/boats";

function formatMs(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function clubLetter(i: number) {
    return String.fromCharCode("A".charCodeAt(0) + i);
}

export default function LeaderboardPage() {
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [boats, setBoats] = useState<any[]>([]);
    const [tab, setTab] = useState<"overall" | "category">("overall");

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

    // live-ish refresh
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

    const finished = useMemo(() => {
        return boats
            .filter((b) => b.startedAt && b.finishedAt)
            .map((b) => ({ ...b, elapsedMs: getElapsedMs(b)! }))
            .sort((a, b) => a.elapsedMs - b.elapsedMs);
    }, [boats]);

    // Assign A/B/C labels for crew boats per (category, club) based on finish order
    const crewLabelMap = useMemo(() => {
        const map = new Map<string, string>(); // boatId -> label
        const groups = new Map<string, any[]>();

        for (const b of finished) {
            if (b.boatSize === 1) continue; // only crews
            const key = `${b.category}__${b.clubName}`;
            const list = groups.get(key) ?? [];
            list.push(b);
            groups.set(key, list);
        }

        for (const [, list] of groups) {
            list.sort((a, b) => a.elapsedMs - b.elapsedMs);
            list.forEach((b, idx) => map.set(b.id, clubLetter(idx)));
        }
        return map;
    }, [finished]);

    function displayName(b: any) {
        if (b.boatSize === 1) {
            // If you later store rower names, format “Club W. Smith”.
            // For now: Club + “Single”
            return `${b.clubName} Single`;
        }
        const letter = crewLabelMap.get(b.id) ?? "A";
        return `${b.clubName} ${letter}`;
    }

    const byCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const b of finished) {
            const list = map.get(b.category) ?? [];
            list.push(b);
            map.set(b.category, list);
        }
        // sort each category list
        for (const [cat, list] of map.entries()) {
            list.sort((a, b) => a.elapsedMs - b.elapsedMs);
            map.set(cat, list);
        }
        return map;
    }, [finished]);

    return (
        <>
            <Navbar />
            <main>
                <h1>Leaderboard</h1>

                <label>
                    Event
                    <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                        {events.map((e) => (
                            <option key={e.id ?? e.name} value={e.id ?? ""}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                </label>

                {selectedEvent && (
                    <div style={{ marginTop: 10, opacity: 0.85 }}>
                        <div><b>Location:</b> {selectedEvent.location}</div>
                        <div><b>Length:</b> {selectedEvent.lengthMeters}m</div>
                    </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => setTab("overall")} disabled={tab === "overall"}>
                        Overall
                    </button>
                    <button onClick={() => setTab("category")} disabled={tab === "category"}>
                        By Category
                    </button>
                    <button onClick={() => refresh(selectedEventId)}>Refresh</button>
                </div>

                <hr style={{ margin: "18px 0" }} />

                {finished.length === 0 ? (
                    <p>No finished results yet. Timing will appear live as boats finish.</p>
                ) : tab === "overall" ? (
                    <>
                        <h2>Overall</h2>
                        <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                            {finished.map((b: any, idx: number) => (
                                <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <b>#{idx + 1} {displayName(b)}</b>
                                        <span><b>{formatMs(b.elapsedMs)}</b></span>
                                    </div>
                                    <div style={{ opacity: 0.9 }}>
                                        Bow {b.bowNumber} • {b.category}
                                    </div>

                                    <details style={{ marginTop: 8 }}>
                                        <summary>Details</summary>
                                        <div style={{ marginTop: 6, opacity: 0.85 }}>
                                            <div>Club: {b.clubName}</div>
                                            <div>Boat size: {b.boatSize}</div>
                                            <div>Started: {new Date(b.startedAt).toLocaleTimeString()}</div>
                                            <div>Finished: {new Date(b.finishedAt).toLocaleTimeString()}</div>
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <>
                        <h2>By Category</h2>

                        {Array.from(byCategory.entries()).map(([cat, list]) => (
                            <section key={cat} style={{ marginBottom: 18 }}>
                                <h3 style={{ marginBottom: 10 }}>{cat}</h3>
                                <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                    {list.map((b: any, idx: number) => (
                                        <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                <b>#{idx + 1} {displayName(b)}</b>
                                                <span><b>{formatMs(b.elapsedMs)}</b></span>
                                            </div>
                                            <div style={{ opacity: 0.9 }}>
                                                Bow {b.bowNumber}
                                            </div>

                                            <details style={{ marginTop: 8 }}>
                                                <summary>Details</summary>
                                                <div style={{ marginTop: 6, opacity: 0.85 }}>
                                                    <div>Club: {b.clubName}</div>
                                                    <div>Boat size: {b.boatSize}</div>
                                                </div>
                                            </details>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </>
                )}
            </main>
        </>
    );
}
