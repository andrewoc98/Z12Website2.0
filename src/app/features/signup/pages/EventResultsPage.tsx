import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc } from "../../events/types";
import { DEV_MODE } from "../../../shared/lib/config";
import { listBoatsForEvent, getElapsedMs } from "../api/boats";

// Firestore event read (DEV_MODE=false)
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

type EventWithId = EventDoc & { id: string };

function ymdFromDate(d: Date) {
    return d.toISOString().slice(0, 10);
}
function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return null;
}
function tsToYMD(ts: any): string {
    const d = tsToDate(ts);
    return d ? ymdFromDate(d) : "";
}

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

async function getEventById(eventId: string): Promise<EventWithId | null> {
    if (DEV_MODE) return null; // wire mock if you have it
    const snap = await getDoc(doc(db, "events", eventId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as EventDoc) };
}

export default function EventResultsPage() {
    const { eventId } = useParams<{ eventId: string }>();

    const [event, setEvent] = useState<EventWithId | null>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<"overall" | "category">("overall");

    async function refresh() {
        if (!eventId) return;
        setErr(null);
        setLoading(true);
        try {
            const e = await getEventById(eventId);
            setEvent(e);

            const b = await listBoatsForEvent(eventId);
            setBoats(b);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load results");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    // optional “live-ish” refresh in dev; for Firestore you’d switch to onSnapshot later
    useEffect(() => {
        if (!eventId) return;
        if (!DEV_MODE) return;
        const t = setInterval(() => refresh(), 1000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    const finished = useMemo(() => {
        return boats
            .filter((b) => b.startedAt && b.finishedAt)
            .map((b) => ({ ...b, elapsedMs: getElapsedMs(b)! }))
            .sort((a, b) => a.elapsedMs - b.elapsedMs);
    }, [boats]);

    // A/B/C labels for crew boats per (categoryName, clubName) based on finish order
    const crewLabelMap = useMemo(() => {
        const map = new Map<string, string>(); // boatId -> label
        const groups = new Map<string, any[]>();

        for (const b of finished) {
            if (b.boatSize === 1) continue;
            const catName = b.categoryName ?? b.category ?? "—";
            const key = `${catName}__${b.clubName}`;
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
        if (b.boatSize === 1) return `${b.clubName} Single`;
        const letter = crewLabelMap.get(b.id) ?? "A";
        return `${b.clubName} ${letter}`;
    }

    const byCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const b of finished) {
            const catName = b.categoryName ?? b.category ?? "—";
            const list = map.get(catName) ?? [];
            list.push(b);
            map.set(catName, list);
        }
        for (const [cat, list] of map.entries()) {
            list.sort((a, b) => a.elapsedMs - b.elapsedMs);
            map.set(cat, list);
        }
        return map;
    }, [finished]);

    const startYMD = tsToYMD(event?.startAt);
    const endYMD = tsToYMD(event?.endAt);

    return (
        <>
            <Navbar />
            <main>
                <div className="row" style={{ marginBottom: 10 }}>
                    <Link to="/rower/events">
                        <button type="button" className="btn-ghost">
                            ← Back to events
                        </button>
                    </Link>
                </div>

                {loading ? (
                    <p>Loading results…</p>
                ) : err ? (
                    <p style={{ color: "crimson" }}>{err}</p>
                ) : !event ? (
                    <p>Event not found.</p>
                ) : (
                    <>
                        <h1>{event.name} — Results</h1>
                        <div className="muted">
                            {event.location} • {startYMD || "—"} → {endYMD || "—"}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                            <button className="btn-primary" onClick={() => setTab("overall")} disabled={tab === "overall"}>
                                Overall
                            </button>
                            <button className="btn-primary" onClick={() => setTab("category")} disabled={tab === "category"}>
                                By Category
                            </button>
                            <button className="btn-primary" onClick={refresh}>
                                Refresh
                            </button>
                        </div>

                        <hr style={{ margin: "18px 0" }} />

                        {finished.length === 0 ? (
                            <p>No finished results yet.</p>
                        ) : tab === "overall" ? (
                            <>
                                <h2>Overall</h2>
                                <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                    {finished.map((b: any, idx: number) => {
                                        const catName = b.categoryName ?? b.category ?? "—";
                                        return (
                                            <li key={b.id} className="card card--tight">
                                                <div className="space-between">
                                                    <b>#{idx + 1} {displayName(b)}</b>
                                                    <span><b>{formatMs(b.elapsedMs)}</b></span>
                                                </div>
                                                <div className="muted" style={{ marginTop: 6 }}>
                                                    Bow {b.bowNumber ?? "—"} • {catName}
                                                </div>

                                                <details style={{ marginTop: 8 }}>
                                                    <summary>Details</summary>
                                                    <div style={{ marginTop: 6 }} className="muted">
                                                        <div>Club: {b.clubName}</div>
                                                        <div>Boat size: {b.boatSize}</div>
                                                        <div>Started: {new Date(b.startedAt).toLocaleTimeString()}</div>
                                                        <div>Finished: {new Date(b.finishedAt).toLocaleTimeString()}</div>
                                                    </div>
                                                </details>
                                            </li>
                                        );
                                    })}
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
                                                <li key={b.id} className="card card--tight">
                                                    <div className="space-between">
                                                        <b>#{idx + 1} {displayName(b)}</b>
                                                        <span><b>{formatMs(b.elapsedMs)}</b></span>
                                                    </div>
                                                    <div className="muted" style={{ marginTop: 6 }}>
                                                        Bow {b.bowNumber ?? "—"}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
