import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, FirestoreEventDoc } from "../../events/types";
import { listBoatsForEvent } from "../api/boats";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { mapEvent } from "../../events/lib/mapper.tsx";

import "../styles/eventView.css";
import "../../../shared/styles/globals.css";

/* ───────── TYPES ───────── */

type UserDoc = {
    displayName?: string;
    fullName?: string;
    email?: string;
};

/* ───────── HELPERS ───────── */

function bestName(u?: UserDoc | null) {
    return u?.displayName?.trim() || u?.fullName?.trim() || "Unknown";
}

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return null;
}

function formatDate(ts: any) {
    const d = tsToDate(ts);
    if (!d) return "—";
    return d.toLocaleDateString("en-IE", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

async function fetchUsersByUid(uids: string[]): Promise<Map<string, UserDoc>> {
    const out = new Map<string, UserDoc>();
    const unique = Array.from(new Set(uids.filter(Boolean)));
    if (!unique.length) return out;

    for (let i = 0; i < unique.length; i += 10) {
        const q = query(collection(db, "users"), where(documentId(), "in", unique.slice(i, i + 10)));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => out.set(d.id, d.data() as UserDoc));
    }

    return out;
}

/* ───────── UI COMPONENTS ───────── */

function StatusPill({ status }: { status: string }) {
    const map: Record<string, string> = {
        open: "ev-pill ev-pill--open",
        closed: "ev-pill ev-pill--closed",
        draft: "ev-pill ev-pill--draft",
        running: "ev-pill ev-pill--running",
        finished: "ev-pill ev-pill--finished",
    };

    const cls = map[status] || "ev-pill";

    return <span className={cls}>{status}</span>;
}

function SeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div className="ev-seat-dots" title={`${filled}/${total}`}>
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className={`ev-seat-dot ${i < filled ? "ev-seat-dot--filled" : "ev-seat-dot--empty"}`}
                />
            ))}
        </div>
    );
}

/* ───────── MAIN PAGE ───────── */

export default function EventPageView() {
    const { eventId } = useParams<{ eventId: string }>();

    const [selectedEvent, setSelectedEvent] =
        useState<(EventDoc & { id: string }) | null>(null);

    const [boats, setBoats] = useState<any[]>([]);
    const [userByUid, setUserByUid] = useState<Map<string, UserDoc>>(new Map());

    const [loadingEvent, setLoadingEvent] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterClub, setFilterClub] = useState("all");
    const [expandedBoats, setExpandedBoats] = useState<Set<string>>(new Set());

    /* ───────── LOAD EVENT ───────── */

    useEffect(() => {
        if (!eventId) return;

        (async () => {
            setLoadingEvent(true);
            setErr(null);

            try {
                const snap = await getDoc(doc(db, "events", eventId));
                if (!snap.exists()) return setSelectedEvent(null);

                setSelectedEvent(mapEvent(snap.id, snap.data() as FirestoreEventDoc));
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoadingEvent(false);
            }
        })();
    }, [eventId]);

    /* ───────── LOAD BOATS ───────── */

    useEffect(() => {
        if (!eventId) return;

        listBoatsForEvent(eventId)
            .then(setBoats)
    }, [eventId]);

    /* ───────── LOAD USERS ───────── */

    useEffect(() => {
        const uids = boats.flatMap((b) => b.rowerUids ?? []);
        if (!uids.length) return;

        fetchUsersByUid(uids).then(setUserByUid);
    }, [boats]);

    /* ───────── FILTERS ───────── */

    const registeredBoats = useMemo(
        () => boats.filter((b) => (b.status ?? "registered") === "registered"),
        [boats]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();

        return registeredBoats.filter((b) => {
            if (filterCategory !== "all" && (b.categoryName ?? b.category) !== filterCategory) return false;
            if (filterClub !== "all" && b.clubName !== filterClub) return false;

            if (q) {
                const cat = (b.categoryName ?? b.category ?? "").toLowerCase();
                const club = (b.clubName ?? "").toLowerCase();
                const rowers = (b.rowerUids ?? [])
                    .map((u: string) => bestName(userByUid.get(u)).toLowerCase())
                    .join(" ");
                const bow = String(b.bowNumber ?? "");

                if (!cat.includes(q) && !club.includes(q) && !rowers.includes(q) && !bow.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [registeredBoats, search, filterCategory, filterClub, userByUid]);

    const grouped = useMemo(() => {
        const map = new Map<string, any[]>();

        filtered.forEach((b) => {
            const cat = b.categoryName ?? b.category ?? "Uncategorised";
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(b);
        });

        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    function toggleExpand(id: string) {
        setExpandedBoats((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    /* ───────── RENDER ───────── */

    return (
        <>
            <Navbar />

            <main className="ev-page">
                <div className="page-container">
                    <Link to="/events" className="back-btn">
                        Back to events
                    </Link>

                    {/* ───── LOADING / ERROR ───── */}
                    {loadingEvent ? (
                        <div className="card">
                            <div className="skeleton-bar" style={{ height: 28, width: "60%" }} />
                        </div>
                    ) : err ? (
                        <div className="card">
                            <h3>Something went wrong</h3>
                            <p>{err}</p>
                        </div>
                    ) : !selectedEvent ? (
                        <div className="card">
                            <h3>Event not found</h3>
                        </div>
                    ) : (
                        <>
                            {/* ───── HEADER ───── */}
                            <div className="ev-header">
                                <div className="ev-header-top">
                                    <h1>{selectedEvent.name}</h1>
                                    <StatusPill status={(selectedEvent as any).status ?? "closed"} />
                                </div>

                                <div className="ev-meta">
                                    <span>{selectedEvent.location}</span>
                                    {(selectedEvent as any).startAt && (
                                        <span>{formatDate((selectedEvent as any).startAt)}</span>
                                    )}
                                    {selectedEvent.lengthMeters && (
                                        <span>{selectedEvent.lengthMeters}m course</span>
                                    )}
                                </div>

                                {selectedEvent.description && (
                                    <p className="ev-description">
                                        {selectedEvent.description}
                                    </p>
                                )}
                            </div>

                            {/* ───── FILTERS ───── */}
                            <div className="ev-filters">
                                <div className="ev-search-wrap">
                                    <input
                                        className="ev-search-input"
                                        placeholder="Search club, category, rower, bow number"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                                <div className="ev-filter-selects">
                                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                        <option value="all">All categories</option>
                                    </select>

                                    <select value={filterClub} onChange={(e) => setFilterClub(e.target.value)}>
                                        <option value="all">All clubs</option>
                                    </select>
                                </div>
                            </div>

                            {/* ───── BOATS ───── */}
                            <div className="ev-boats-grid">
                                {grouped.map(([category, boats]) => (
                                    <div key={category} className="ev-category-group">
                                        <div className="ev-category-heading">
                                            <span className="ev-category-name">{category}</span>
                                        </div>

                                        <ul className="ev-boats-grid">
                                            {boats.map((b) => {
                                                const filled = b.rowerUids?.length ?? 0;
                                                const total = b.boatSize ?? 0;

                                                return (
                                                    <li key={b.id} className="card ev-boat-card">
                                                        <div className="ev-boat-header">
                                                            <div>
                                                                {b.bowNumber && (
                                                                    <div className="ev-bow-badge">#{b.bowNumber}</div>
                                                                )}
                                                                <div className="ev-boat-club">{b.clubName}</div>
                                                                <div className="ev-boat-category">
                                                                    {b.categoryName ?? b.category}
                                                                </div>
                                                            </div>

                                                            <SeatDots filled={filled} total={total} />
                                                        </div>

                                                        <button
                                                            className="ev-crew-toggle"
                                                            onClick={() => toggleExpand(b.id)}
                                                        >
                                                            Crew ({filled}/{total})
                                                        </button>

                                                        {expandedBoats.has(b.id) && (
                                                            <ul className="ev-crew-list">
                                                                {(b.rowerUids ?? []).map((uid: string) => (
                                                                    <li key={uid}>
                                                                        <span className="ev-crew-avatar">
                                                                            {bestName(userByUid.get(uid)).charAt(0)}
                                                                        </span>
                                                                        {bestName(userByUid.get(uid))}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}