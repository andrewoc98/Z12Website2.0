import { useEffect, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";

import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";
import EventCard from "../../events/components/EventCard";
import { Link } from "react-router-dom";

export default function HomePage() {
    const { user, loginAs, logout } = useMockAuth();

    const [events, setEvents] = useState<EventDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    async function refresh() {
        setLoading(true);
        setErr(null);
        try {
            const e = await listEvents();
            setEvents(e);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load events");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <>
            <Navbar />
            <main>
                <h1>Z12</h1>
                <p>
                    Welcome to Z12 rowing events. Sign in to register for events, manage timing,
                    or create events (depending on your role).
                </p>

                <section style={{ marginTop: 14 }}>
                    <div className="space-between">
                        <h2>Events</h2>
                        <button className="btn-primary" onClick={refresh} disabled={loading}>
                            {loading ? "Loading..." : "Refresh"}
                        </button>
                    </div>

                    {err && <p style={{ color: "crimson" }}>{err}</p>}

                    {loading ? (
                        <p>Loading events…</p>
                    ) : events.length === 0 ? (
                        <p>No events yet.</p>
                    ) : (
                        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                            {events.map((event) => (
                                <div key={event.id} style={{ display: "grid", gap: 10 }}>
                                    <EventCard event={event} />

                                    {/* lightweight CTA row (optional, but feels more complete) */}
                                    <div className="row">
                                        <Link to="/leaderboard">
                                            <button>View Leaderboard</button>
                                        </Link>

                                        {user?.roles?.rower ? (
                                            <Link to="/rower/signup">
                                                <button className="btn-primary">Sign Up</button>
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <hr style={{ margin: "18px 0" }} />

                {DEV_MODE && (
                    <section className="card">
                        <div className="space-between">
                            <h2 style={{ margin: 0 }}>DEV: Quick Login</h2>
                            <span className="badge badge--brand">DEV</span>
                        </div>

                        {user ? (
                            <>
                                <p style={{ marginTop: 10 }}>
                                    <b>Signed in as:</b> {user.displayName} ({user.email})
                                </p>

                                <p>
                                    <b>Roles:</b>{" "}
                                    {Object.keys(user.roles).length ? Object.keys(user.roles).join(", ") : "none"}
                                </p>

                                <button className="btn-danger" onClick={logout}>
                                    Log out
                                </button>
                            </>
                        ) : (
                            <>
                                <p style={{ marginTop: 10 }}>Pick a role to simulate sign-in:</p>
                                <div className="row">
                                    <button onClick={() => loginAs("rower")}>Login as Rower</button>
                                    <button onClick={() => loginAs("host")}>Login as Host</button>
                                    <button onClick={() => loginAs("admin")}>Login as Admin</button>
                                </div>
                            </>
                        )}
                    </section>
                )}

                {!DEV_MODE && (
                    <section className="card">
                        <p>DEV_MODE is off. This page should use Firebase auth state (useAuth) instead.</p>
                    </section>
                )}
            </main>
        </>
    );
}
