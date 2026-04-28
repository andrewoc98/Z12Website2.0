import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../api/events";
import type { EventDoc } from "../types";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { formatDate, getEventStatus } from "../lib/categories.ts";
import "../../signup/styles/events.css";

type Mode = "active" | "finished";

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts);
}

export default function HostEventListPage() {
    const mock = DEV_MODE ? useMockAuth() : null;
    const fb = !DEV_MODE ? useAuth() : null;
    const hostUid = DEV_MODE ? mock?.user?.uid ?? null : fb?.user?.uid ?? null;

    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>("active");

    useEffect(() => {
        if (!hostUid) return;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const all = await listEvents();
                setEvents(all.filter((e: any) => e.createdByUid === hostUid));
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load events");
            } finally {
                setLoading(false);
            }
        })();
    }, [hostUid]);

    const visible = useMemo(() => {
        return events
            .filter((e) => {
                const status = getEventStatus(e);
                return mode === "finished"
                    ? status === "finished"
                    : status !== "finished";
            })
            .sort((a, b) => {
                const aStart = tsToDate(a.startDate)?.getTime() ?? 0;
                const bStart = tsToDate(b.startDate)?.getTime() ?? 0;
                return mode === "finished" ? bStart - aStart : aStart - bStart;
            });
    }, [events, mode]);

    return (
        <div className="page-container">
            <Navbar />
            <div className="page-content">
                <main className="events-page">
                    {/* header */}
                    <div className="events-header">
                        <div className="events-title">
                            <h1>MY EVENTS</h1>
                            <p>Manage registrations and boats for your events.</p>
                        </div>
                        <div className="events-toggle">
                            <button
                                className={mode === "active" ? "btn-primary" : "btn-ghost"}
                                onClick={() => setMode("active")}
                            >
                                Active
                            </button>
                            <button
                                className={mode === "finished" ? "btn-primary" : "btn-ghost"}
                                onClick={() => setMode("finished")}
                            >
                                Finished
                            </button>
                        </div>
                    </div>

                    {/* content */}
                    {loading && (
                    <div>
                        <div className="skeleton-stats">
                        <div className="skeleton-bar" style={{ width: 130, height: 32, borderRadius: 999 }} />
                        </div>

                        {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="event-card">
                            <div className="event-grid">
                            <div className="event-left">
                                <div className="event-line">
                                <div className="skeleton-bar" style={{ width: "50%", height: 28, borderRadius: 6 }} />
                                <div className="skeleton-bar" style={{ width: 160, height: 16, borderRadius: 999 }} />
                                </div>
                                <div className="event-line event-meta">
                                <div className="skeleton-bar" style={{ width: 120, height: 14, borderRadius: 999 }} />
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                                    <div className="skeleton-bar" style={{ width: 160, height: 12, borderRadius: 999 }} />
                                    <div className="skeleton-bar" style={{ width: 150, height: 12, borderRadius: 999 }} />
                                    <div className="skeleton-bar" style={{ width: 155, height: 12, borderRadius: 999 }} />
                                </div>
                                </div>
                            </div>

                            <div className="event-action">
                                <div className="skeleton-bar" style={{ width: 90, height: 70, borderRadius: 14 }} />
                            </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    )}
                    {err && <p style={{ color: "crimson" }}>{err}</p>}
                    {!loading && !err && visible.length === 0 && (
                        <p>No {mode === "finished" ? "finished" : "active"} events found.</p>
                    )}

                    {!loading && !err && visible.length > 0 && (
                        <>
                            {/* stats */}
                            <div className="events-stats">
                                <span className="badge">
                                    {visible.length} {mode === "finished" ? "finished" : "active"} events
                                </span>
                            </div>

                            {/* event list */}
                            <div className="events-list">
                                {visible.map((e) => {
                                    const status = getEventStatus(e);
                                    return (
                                        <Link
                                            key={e.id}
                                            to={`/host/events/${e.id}`}
                                            style={{ textDecoration: "none", color: "inherit" }}
                                        >
                                            <div className="event-card">
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
                                                        <button className="enter-race-btn">
                                                            {status === "finished" ? "View" : "Manage"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}