import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTimingEvents } from "../useTimingEvents";
import ConnectionBadge from "../components/ConnectionBadge";
import "../styles/TimingEventSelectPage.css";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer";

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts);
}

function formatDate(ts: any): string {
    const d = tsToDate(ts);
    if (!d) return "TBC";
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

function isActive(event: any): boolean {
    const now = new Date();
    const start = tsToDate(event.startAt);
    const end = tsToDate(event.endAt);
    if (!start || !end) return false;
    return now >= start && now <= end;
}

function isUpcoming(event: any): boolean {
    const now = new Date();
    const start = tsToDate(event.startAt);
    if (!start) return false;
    return start > now;
}

export default function TimingEventSelectPage() {
    const { events, loading } = useTimingEvents();
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const filtered = useMemo(() => events.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.location?.toLowerCase().includes(search.toLowerCase())
    ), [events, search]);

    const activeEvents = useMemo(() => filtered.filter(isActive), [filtered]);
    const upcomingEvents = useMemo(() => filtered.filter(isUpcoming).sort((a, b) => {
        const aDate = tsToDate(a.startAt)?.getTime() ?? 0;
        const bDate = tsToDate(b.startAt)?.getTime() ?? 0;
        return aDate - bDate;
    }), [filtered]);

    if (loading) return (
    <>
        <Navbar />
        <div className="timing-select-page page">
            <div className="timing-select-header">
                <div className="timing-select-title">
                    <h1>TIMING</h1>
                    <p>Select an event to begin timing.</p>
                </div>
                <ConnectionBadge />
            </div>

            <div className="skeleton-stats">
                <div className="skeleton-bar" style={{ width: 80, height: 26, borderRadius: 6 }} />
            </div>

            <div className="timing-select-list">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="timing-event-card">
                        <div className="timing-event-grid">
                            <div className="timing-event-left">
                                <div className="skeleton-bar" style={{ width: "55%", height: 24, borderRadius: 6, marginBottom: 10 }} />
                                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                                    <div className="skeleton-bar" style={{ width: 100, height: 13, borderRadius: 999 }} />
                                    <div className="skeleton-bar" style={{ width: 120, height: 13, borderRadius: 999 }} />
                                </div>
                                <div className="skeleton-bar" style={{ width: 180, height: 13, borderRadius: 999 }} />
                            </div>
                            <div className="timing-event-action">
                                <div className="skeleton-bar" style={{ width: 70, height: 60, borderRadius: 14 }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <Footer />
    </>
);

    const renderCard = (event: any, disabled: boolean) => (
        <div
            key={event.id}
            className={`timing-event-card ${disabled ? "timing-event-card--disabled" : ""}`}
            onClick={() => !disabled && navigate(`/timing/${event.id}`)}
        >
            <div className="timing-event-grid">
                <div className="timing-event-left">
                    <div className="timing-event-name">{event.name}</div>
                    <div className="timing-event-meta">
                        <span>{event.location}</span>
                        {event.lengthMeters && (
                            <span className="timing-event-type">{event.lengthMeters}m Time Trial</span>
                        )}
                    </div>
                    <div className="timing-event-date">
                        {formatDate(event.startAt)} — {formatDate(event.endAt)}
                    </div>
                </div>
                <div className="timing-event-action">
                    <button className="timing-select-btn" disabled={disabled}>
                        {disabled ? "UPCOMING" : <>TIME<br />EVENT</>}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Navbar />
            <div className="timing-select-page page">
                <div className="timing-select-header">
                    <div className="timing-select-title">
                        <h1>TIMING</h1>
                        <p>Select an event to begin timing.</p>
                    </div>
                    <ConnectionBadge />
                </div>

                {events.length > 1 && (
                    <div className="timing-select-search">
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                )}

                {activeEvents.length === 0 && upcomingEvents.length === 0 && (
                    <p className="timing-select-empty">No events found.</p>
                )}

                {activeEvents.length > 0 && (
                    <>
                        <h2 className="timing-section-heading">Active</h2>
                        <div className="timing-select-list">
                            {activeEvents.map(e => renderCard(e, false))}
                        </div>
                    </>
                )}

                {upcomingEvents.length > 0 && (
                    <>
                        <h2 className="timing-section-heading">Upcoming</h2>
                        <div className="timing-select-list">
                            {upcomingEvents.map(e => renderCard(e, true))}
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </>
    );
}