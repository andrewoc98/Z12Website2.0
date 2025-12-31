import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";

type Mode = "upcoming" | "past";
const PAGE_SIZE = 10;

function toDate(s: string) {
    const d = new Date(s + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
}

function isPastEvent(e: EventDoc, now: Date) {
    const end = toDate(e.endDate);
    if (!end) return false;
    return end.getTime() < now.getTime();
}

export default function RowerEventListPage() {
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("upcoming");
    const [page, setPage] = useState(1);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const all = await listEvents();
                setEvents(all);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load events");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Reset page when switching tabs
    useEffect(() => setPage(1), [mode]);

    const now = useMemo(() => new Date(), []);

    const visible = useMemo(() => {
        // rowers only care about open signup for upcoming,
        // but still want to see past events for results.
        const filtered =
            mode === "past"
                ? events.filter((e) => isPastEvent(e, now))
                : events.filter((e) => !isPastEvent(e, now));

        const sorted = [...filtered].sort((a, b) => {
            const aStart = toDate(a.startDate)?.getTime() ?? 0;
            const bStart = toDate(b.startDate)?.getTime() ?? 0;
            if (mode === "past") return bStart - aStart; // most recent first
            return aStart - bStart; // soonest first
        });

        return sorted;
    }, [events, mode, now]);

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);

    const pageItems = useMemo(() => {
        const start = (clampedPage - 1) * PAGE_SIZE;
        return visible.slice(start, start + PAGE_SIZE);
    }, [visible, clampedPage]);

    return (
        <>
            <Navbar />
            <main>
                <div className="space-between">
                    <div>
                        <h1>Events</h1>
                        <p>Sign up for upcoming events, or view results for past events.</p>
                    </div>

                    <div className="row">
                        <button
                            type="button"
                            className={mode === "upcoming" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("upcoming")}
                        >
                            Upcoming
                        </button>
                        <button
                            type="button"
                            className={mode === "past" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("past")}
                        >
                            Past & Results
                        </button>
                    </div>
                </div>

                {loading ? (
                    <p>Loading events…</p>
                ) : err ? (
                    <p style={{ color: "crimson" }}>{err}</p>
                ) : visible.length === 0 ? (
                    <p>No {mode === "past" ? "past" : "upcoming"} events found.</p>
                ) : (
                    <>
                        <div className="row">
              <span className="badge">
                {visible.length} {mode === "past" ? "past" : "upcoming"} events
              </span>
                            <span className="badge">
                Page {clampedPage} / {totalPages}
              </span>
                        </div>

                        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                            {pageItems.map((e) => {
                                const past = isPastEvent(e, now);
                                const canSignup = !past && e.status === "open";

                                return (
                                    <div key={e.id} className="card">
                                        <div className="space-between">
                                            <div>
                                                <h2 style={{ margin: 0 }}>{e.name}</h2>
                                                <div className="muted">
                                                    {e.location} • {e.startDate} → {e.endDate}
                                                </div>
                                            </div>

                                            {canSignup ? (
                                                <span className="badge badge--brand">Open</span>
                                            ) : past ? (
                                                <span className="badge">Finished</span>
                                            ) : (
                                                <span className="badge">Closed</span>
                                            )}
                                        </div>

                                        {e.description && <p>{e.description}</p>}

                                        <div className="row">
                                            {canSignup ? (
                                                <Link to={`/rower/events/${e.id}/signup`}>
                                                    <button type="button" className="btn-primary">
                                                        Sign up
                                                    </button>
                                                </Link>
                                            ) : (
                                                <Link to={`/rower/events/${e.id}/results`}>
                                                    <button type="button" className="btn-primary">
                                                        View results
                                                    </button>
                                                </Link>
                                            )}

                                            <span className="badge">Distance: {e.lengthMeters}m</span>
                                            <span className="badge">Closes: {e.closingDate}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="card card--tight" style={{ marginTop: 14 }}>
                            <div className="space-between">
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    disabled={clampedPage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    ← Prev
                                </button>

                                <span className="badge">
                  Page {clampedPage} / {totalPages}
                </span>

                                <button
                                    type="button"
                                    className="btn-ghost"
                                    disabled={clampedPage >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}
