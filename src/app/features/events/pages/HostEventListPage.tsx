import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../api/events";
import type { EventDoc } from "../types";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import { useAuth } from "../../../providers/AuthProvider";

type Mode = "active" | "closed";

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
        return events.filter((e) =>
            mode === "closed" ? e.status === "closed" : e.status !== "closed"
        );
    }, [events, mode]);

    return (
        <>
            <Navbar />
            <main>
                <div className="space-between">
                    <div>
                        <h1>My Events</h1>
                        <p>Manage registrations and boats for your events.</p>
                    </div>

                    <div className="row">
                        <button
                            className={mode === "active" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("active")}
                        >
                            Active
                        </button>
                        <button
                            className={mode === "closed" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("closed")}
                        >
                            Closed
                        </button>
                    </div>
                </div>

                {loading ? (
                    <p>Loading events…</p>
                ) : err ? (
                    <p style={{ color: "crimson" }}>{err}</p>
                ) : visible.length === 0 ? (
                    <p>No events found.</p>
                ) : (
                    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                        {visible.map((e) => (
                            <Link
                                key={e.id}
                                to={`/host/events/${e.id}`}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                <div className="card card--hover">
                                    <div className="space-between">
                                        <div>
                                            <h2 style={{ margin: 0 }}>{e.name}</h2>
                                            <div className="muted">
                                                {e.location} • {e.lengthMeters}m
                                            </div>
                                        </div>

                                        <span className="badge">{e.status}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
