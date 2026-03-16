import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";

import "../styles/events.css";
import Footer from "../../../shared/components/Footer/Footer.tsx";

type Mode = "upcoming" | "past";

const PAGE_SIZE = 10;


/* ---------------- helpers ---------------- */

function ymdFromDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

function todayYMD() {
    return ymdFromDate(new Date());
}

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return null;
}


function isPastEvent(e: EventDoc) {
    const end = tsToDate(e.endDate);
    if (!end) return false;
    return ymdFromDate(end) < todayYMD();
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
                setEvents(all as any);
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

        const filtered =
            mode === "past"
                ? events.filter((e) => isPastEvent(e) || e.status === "finished")
                : events.filter((e) => !isPastEvent(e) && e.status !== "finished");

        const sorted = [...filtered].sort((a, b) => {

            const aStart = tsToDate(a.startDate)?.getTime() ?? 0;
            const bStart = tsToDate(b.startDate)?.getTime() ?? 0;

            if (mode === "past") return bStart - aStart;

            return aStart - bStart;

        });

        return sorted;

    }, [events, mode]);

    function formatRaceDate(dateString: string | Date | null | undefined) {
        if (!dateString) return "—";

        const d = new Date(dateString);

        return d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }


    /* -------- pagination -------- */

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);

    const pageItems = useMemo(() => {

        const start = (clampedPage - 1) * PAGE_SIZE;

        return visible.slice(start, start + PAGE_SIZE);

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


                                    return (

                                        <div key={e.id} className="event-card">

                                            <div className="event-grid">

                                                <div className="event-left">

                                                    <div className="event-line">

                                                        <span className="event-name">{e.name}</span>

                                                        <span className="event-type">
                    {e.lengthMeters}m Time Trial
                </span>

                                                    </div>

                                                    <div className="event-line event-meta">

                                                        <span>{e.location}</span>

                                                        <span>{formatRaceDate(e.startDate)}</span>

                                                    </div>

                                                </div>

                                                <div className="event-action">

                                                    {e.status === "open" && !isPastEvent(e) ? (
                                                        <Link to={`/rower/events/${e.id}/signup`}>
                                                            <button className="enter-race-btn">
                                                                Enter
                                                                <br />
                                                                Race
                                                            </button>
                                                        </Link>
                                                    ) : (
                                                        <Link to={`/rower/events/${e.id}/results`}>
                                                            <button className="enter-race-btn">
                                                                View
                                                                <br />
                                                                Results
                                                            </button>
                                                        </Link>
                                                    )}

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
            <Footer/>
        </div>

    );
}