import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";

type Mode = "upcoming" | "past";
const PAGE_SIZE = 10;

// ---------- helpers ----------
function ymdFromDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

function todayYMD() {
    return ymdFromDate(new Date());
}

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate(); // Firestore Timestamp
    return null;
}

function tsToYMD(ts: any): string {
    const d = tsToDate(ts);
    return d ? ymdFromDate(d) : "";
}

function isPastEvent(e: EventDoc) {
    const end = tsToDate((e as any).endAt);
    if (!end) return false;
    // day-based
    return ymdFromDate(end) < todayYMD();
}

function statusBadge(e: EventDoc, past: boolean) {
    // Your meanings:
    // draft = before registration open
    // open = registration open
    // closed = registration closed (event not started)
    // running = event on
    // finished = event ended
    const st = (e as any).status as string | undefined;

    if (st === "open") return { label: "Open", cls: "badge badge--brand" };
    if (st === "draft") return { label: "Draft", cls: "badge" };
    if (st === "closed") return { label: "Closed", cls: "badge" };
    if (st === "running") return { label: "Running", cls: "badge badge--brand" };
    if (st === "finished") return { label: "Finished", cls: "badge" };

    // fallback if status missing
    return past ? { label: "Finished", cls: "badge" } : { label: "Closed", cls: "badge" };
}

export default function EventListPage() {
    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
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
                setEvents(all as any); // listEvents should return ids
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load events");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Reset pagination when switching modes
    useEffect(() => setPage(1), [mode]);

    const visible = useMemo(() => {
        const filtered =
            mode === "past"
                ? events.filter((e) => isPastEvent(e) || (e as any).status === "finished")
                : events.filter((e) => !isPastEvent(e) && (e as any).status !== "finished");

        const sorted = [...filtered].sort((a, b) => {
            const ad = tsToDate((a as any).startAt)?.getTime() ?? 0;
            const bd = tsToDate((b as any).startAt)?.getTime() ?? 0;
            if (mode === "past") return bd - ad; // most recent first
            return ad - bd; // soonest first
        });

        return sorted;
    }, [events, mode]);

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
                        <p>Pick an event to sign up, or view results for past events.</p>
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
                        <div className="row" style={{ marginTop: 8 }}>
              <span className="badge">
                {visible.length} {mode === "past" ? "past" : "upcoming"} events
              </span>
                            <span className="badge">
                Page {clampedPage} of {totalPages}
              </span>
                        </div>

                        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                            {pageItems.map((e) => {
                                const past = isPastEvent(e);

                                const startYMD = tsToYMD((e as any).startAt);
                                const endYMD = tsToYMD((e as any).endAt);
                                const closeYMD = tsToYMD((e as any).closeAt);

                                const st = (e as any).status as string | undefined;

                                const canSignup = st === "open" && !past;
                                const canViewResults = mode === "past" || st === "finished" || past;

                                const badge = statusBadge(e, past);

                                return (
                                    <div key={e.id} className="card">
                                        <div className="space-between">
                                            <div>
                                                <h2 style={{ margin: 0 }}>{e.name}</h2>
                                                <div className="muted">
                                                    {e.location} • {startYMD || "—"} → {endYMD || "—"}
                                                </div>
                                            </div>
                                            <span className={badge.cls}>{badge.label}</span>
                                        </div>

                                        {e.description && <p>{e.description}</p>}

                                        <div className="row" style={{ marginTop: 10 }}>
                                            {canSignup ? (
                                                <Link to={`/events/${e.id}/signup`}>
                                                    <button type="button" className="btn-primary">
                                                        Sign up
                                                    </button>
                                                </Link>
                                            ) : canViewResults ? (
                                                <Link to={`/events/${e.id}/results`}>
                                                    <button type="button" className="btn-primary">
                                                        View results
                                                    </button>
                                                </Link>
                                            ) : (
                                                <button type="button" disabled className="btn-ghost">
                                                    Sign up closed
                                                </button>
                                            )}

                                            <span className="badge">Distance: {e.lengthMeters}m</span>
                                            <span className="badge">Closes: {closeYMD || "—"}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
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

                                <div className="row">
                  <span className="badge">
                    Page {clampedPage} / {totalPages}
                  </span>
                                </div>

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
