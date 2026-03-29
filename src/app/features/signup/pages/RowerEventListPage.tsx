import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";

import "../styles/events.css";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import { formatDate } from "../../events/lib/categories.ts";

type Mode = "upcoming" | "past";

const PAGE_SIZE = 10;

/* ---------------- helpers ---------------- */

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts); // fallback for ISO strings
}

function getEventAction(event: EventDoc) {
    const now = new Date();
    const closing = tsToDate(event.closingDate);
    const start = tsToDate(event.startDate);
    const end = tsToDate(event.endDate);

    if (!start || !end) return { type: "none", label: "Unavailable" };

    if (now > end) {
        // Event finished
        return { type: "results", label: "View Results", link: `/rower/events/${event.id}/results` };
    }

    if (closing && now > closing && now < start) {
        // After closing but before start
        return { type: "disabled", label: "Reg Closed" };
    }

    if (now < start) {
        // Before start, registration open
        return { type: "signup", label: "Enter Race", link: `/rower/events/${event.id}/signup` };
    }

    if (now >= start && now <= end) {
        // During event
        return { type: "results", label: "View Results", link: `/rower/events/${event.id}/results` };
    }

    return { type: "none", label: "Unavailable" };
}

/* ---------------- page ---------------- */

export default function RowerEventListPage() {
    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("upcoming");
    const [page, setPage] = useState(1);

    /* -------- fetch events -------- */
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

    useEffect(() => setPage(1), [mode]);

    /* -------- filtering -------- */
    const visible = useMemo(() => {
        return events
            .filter(e => {
                const start = tsToDate(e.startDate);
                const end = tsToDate(e.endDate);
                if (!start || !end) return false;

                if (mode === "past") return end < new Date();
                return end >= new Date(); // upcoming includes all events not finished
            })
            .sort((a, b) => {
                const aStart = new Date(a.startDate).getTime();
                const bStart = new Date(b.startDate).getTime();
                return mode === "past" ? bStart - aStart : aStart - bStart;
            });
    }, [events, mode]);

    /* -------- pagination -------- */
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const pageItems = useMemo(() => {
        const startIdx = (clampedPage - 1) * PAGE_SIZE;
        return visible.slice(startIdx, startIdx + PAGE_SIZE);
    }, [visible, clampedPage]);

    /* ---------------- render ---------------- */
    return (
        <div className="page-container">
            <Navbar />
            <div className="page-content">
                <main className="events-page">
                    {/* header */}
                    <div className="events-header">
                        <div className="events-title">
                            <h1>RACES</h1>
                            <p>Sign up for upcoming events, or view results for past events.</p>
                        </div>
                        <div className="events-toggle">
                            <button
                                className={mode === "upcoming" ? "btn-primary" : "btn-ghost"}
                                onClick={() => setMode("upcoming")}
                            >
                                Upcoming
                            </button>
                            <button
                                className={mode === "past" ? "btn-primary" : "btn-ghost"}
                                onClick={() => setMode("past")}
                            >
                                Past & Results
                            </button>
                        </div>
                    </div>

                    {/* content */}
                    {loading && <p>Loading events…</p>}
                    {err && <p style={{ color: "crimson" }}>{err}</p>}
                    {!loading && !err && visible.length === 0 && (
                        <p>No {mode === "past" ? "past" : "upcoming"} events found.</p>
                    )}

                    {!loading && !err && visible.length > 0 && (
                        <>
                            {/* stats */}
                            <div className="events-stats">
                                <span className="badge">
                                    {visible.length} {mode === "past" ? "past" : "upcoming"} events
                                </span>
                                <span className="badge">
                                    Page {clampedPage} / {totalPages}
                                </span>
                            </div>

                            {/* event list */}
                            <div className="events-list">
                                {pageItems.map((e) => {
                                    const action = getEventAction(e);
                                    return (
                                        <div key={e.id} className="event-card">
                                            <div className="event-grid">
                                                <div className="event-left">
                                                    <div className="event-line">
                                                        <span className="event-name">{e.name}</span>
                                                        <span className="event-type">{e.lengthMeters}m Time Trial</span>
                                                    </div>
                                                    <div className="event-line event-meta">
                                                        <span>{e.location}</span>
                                                        <div
                                                            className="event-dates"
                                                            style={{ marginTop: 4, fontSize: "0.85em", color: "#555" }}
                                                        >
                                                            <div>Closes: {formatDate(e.closingDate)}</div>
                                                            <div>Starts: {formatDate(e.startDate)}</div>
                                                            <div>Ends: {formatDate(e.endDate)}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="event-action">
                                                    {action.type === "signup" || action.type === "results" ? (
                                                        <Link to={action.link!}>
                                                            <button className="enter-race-btn">{action.label}</button>
                                                        </Link>
                                                    ) : action.type === "disabled" ? (
                                                        <button className="enter-race-btn" disabled>
                                                            {action.label}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* pagination */}
                            <div className="card card--tight events-pagination">
                                <div className="space-between">
                                    <button
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
            </div>
            <Footer />
        </div>
    );
}