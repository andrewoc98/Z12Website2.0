import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../../../../shared/components/Navbar/Navbar";
import Footer from "../../../../shared/components/Footer/Footer";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../shared/lib/firebase";
import { mapEvent } from "../../lib/mapper";
import type { EventDoc, FirestoreEventDoc } from "../../types";
import { useAuth } from "../../../../providers/AuthProvider";
import OverviewTab from "./tabs/OverviewTab";
import RegistrationTab from "./tabs/RegistrationTab";
import ResultsTab from "./tabs/ResultsTab";
import ReviewsTab from "./tabs/ReviewsTab";
import "./EventPage.css";

type Tab = "overview" | "registration" | "results" | "reviews";

function StatusPill({ status }: { status: string }) {
    const map: Record<string, string> = {
        open: "ep-pill ep-pill--open",
        closed: "ep-pill ep-pill--closed",
        draft: "ep-pill ep-pill--draft",
        running: "ep-pill ep-pill--running",
        finished: "ep-pill ep-pill--finished",
    };
    return <span className={map[status] ?? "ep-pill"}>{status}</span>;
}

function formatDate(ts: any) {
    if (!ts) return "—";
    const d = typeof ts?.toDate === "function" ? ts.toDate()
        : ts instanceof Date ? ts
        : typeof ts === "string" ? new Date(ts)
        : null;
    if (!d || isNaN((d as Date).getTime())) return "—";
    return (d as Date).toLocaleDateString("en-IE", {
        weekday: "short", day: "numeric", month: "long", year: "numeric",
    });
}

export default function EventPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth() as any;
    const navigate = useNavigate();

    const tab = (searchParams.get("tab") as Tab | null) ?? "overview";
    const [event, setEvent] = useState<(EventDoc & { id: string; [key: string]: any }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const snap = await getDoc(doc(db, "events", eventId));
                if (!snap.exists()) { setEvent(null); return; }
                setEvent(mapEvent(snap.id, snap.data() as FirestoreEventDoc) as any);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    function setTab(t: Tab) {
        setSearchParams({ tab: t }, { replace: true });
    }

    if (loading) {
        return (
            <div className="page-container">
                <Navbar />
                <main className="ep-page">
                    <div className="ep-container">
                        <div className="ep-skeleton-bar" style={{ height: 32, width: "60%", marginBottom: 12 }} />
                        <div className="ep-skeleton-bar" style={{ height: 16, width: "40%" }} />
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (err) {
        return (
            <div className="page-container">
                <Navbar />
                <main className="ep-page">
                    <div className="ep-container">
                        <div className="card"><h3>Something went wrong</h3><p>{err}</p></div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="page-container">
                <Navbar />
                <main className="ep-page">
                    <div className="ep-container">
                        <div className="card"><h3>Event not found</h3></div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const TABS: { key: Tab; label: string }[] = [
        { key: "overview",     label: "Overview" },
        { key: "registration", label: "Registration" },
        { key: "results",      label: "Results" },
        { key: "reviews",      label: "Reviews" },
    ];

    const hostId: string = event.createdByUid ?? "";

    return (
        <div className="page-container">
            <Navbar />
            <main className="ep-page">
                <div className="ep-container">
                    <Link to="/events" className="ep-back-btn">← Back to events</Link>

                    {/* Header */}
                    <div className="ep-event-header">
                        <div className="ep-header-top">
                            <h1 className="ep-event-title">{event.name}</h1>
                            <StatusPill status={event.status ?? "closed"} />
                        </div>
                        <div className="ep-event-meta">
                            <span>{event.location}</span>
                            {event.startDate && <span>{formatDate(event.startDate)}</span>}
                            {event.lengthMeters && <span>{event.lengthMeters}m course</span>}
                        </div>
                        {event.description && (
                            <p className="ep-event-description">{event.description}</p>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="ep-tabs">
                        {TABS.map(({ key, label }) => (
                            <button
                                key={key}
                                className={`ep-tab-btn${tab === key ? " active" : ""}`}
                                onClick={() => setTab(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {tab === "overview" && (
                        <OverviewTab
                            event={event}
                            hostId={hostId}
                            onRegisterClick={() => {
                                if (!user) {
                                    navigate(`/auth?redirect=/events/${eventId}?tab=registration`);
                                } else {
                                    setTab("registration");
                                }
                            }}
                        />
                    )}
                    {tab === "registration" && (
                        <RegistrationTab
                            event={event}
                            eventId={eventId!}
                        />
                    )}
                    {tab === "results" && (
                        <ResultsTab
                            event={event}
                            eventId={eventId!}
                        />
                    )}
                    {tab === "reviews" && (
                        <ReviewsTab
                            eventId={eventId!}
                            hostId={hostId}
                        />
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
