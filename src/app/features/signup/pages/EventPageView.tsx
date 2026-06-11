import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, FirestoreEventDoc } from "../../events/types";
import { listBoatsForEvent } from "../api/boats";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { mapEvent } from "../../events/lib/mapper.tsx";

type UserDoc = {
    displayName?: string;
    fullName?: string;
    email?: string;
};

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

const PILL_CLS: Record<string, string> = {
    open:     "bg-brand-soft text-brand border-brand/40",
    running:  "bg-brand/10 text-brand",
    closed:   "bg-surface-2 text-muted border-border",
    finished: "bg-surface-2 text-muted border-border",
    draft:    "bg-surface-2 text-muted border-border",
};

function StatusPill({ status }: { status: string }) {
    return (
        <span className={`text-[0.7rem] font-bold px-[10px] py-1 rounded-full uppercase border border-transparent ${PILL_CLS[status] ?? "bg-surface-2 text-muted border-border"}`}>
            {status}
        </span>
    );
}

function SeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div className="flex gap-1" title={`${filled}/${total}`}>
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${i < filled ? "bg-brand" : "bg-white/10"}`}
                />
            ))}
        </div>
    );
}

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

    useEffect(() => {
        if (!eventId) return;

        listBoatsForEvent(eventId)
            .then(setBoats)
    }, [eventId]);

    useEffect(() => {
        const uids = boats.flatMap((b) => b.rowerUids ?? []);
        if (!uids.length) return;

        fetchUsersByUid(uids).then(setUserByUid);
    }, [boats]);

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

    return (
        <>
            <Navbar />

            <main className="px-3 pt-6 pb-10">
                <div className="page-container">
                    <Link to="/events" className="back-btn">
                        Back to events
                    </Link>

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
                            <div className="mb-5">
                                <div className="flex justify-between items-center gap-3 mb-[6px]">
                                    <h1>{selectedEvent.name}</h1>
                                    <StatusPill status={(selectedEvent as any).status ?? "closed"} />
                                </div>

                                <div className="flex flex-wrap gap-3 text-[0.85rem] text-muted">
                                    <span>{selectedEvent.location}</span>
                                    {(selectedEvent as any).startAt && (
                                        <span>{formatDate((selectedEvent as any).startAt)}</span>
                                    )}
                                    {selectedEvent.lengthMeters && (
                                        <span>{selectedEvent.lengthMeters}m course</span>
                                    )}
                                </div>

                                {selectedEvent.description && (
                                    <p className="mt-2 max-w-[720px]">
                                        {selectedEvent.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-[10px] flex-wrap mb-[18px]">
                                <div className="relative flex-1">
                                    <input
                                        className="w-full rounded-full px-[34px] py-[10px] text-[0.9rem]"
                                        placeholder="Search club, category, rower, bow number"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <select className="flex-1 min-w-[110px]" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                        <option value="all">All categories</option>
                                    </select>

                                    <select className="flex-1 min-w-[110px]" value={filterClub} onChange={(e) => setFilterClub(e.target.value)}>
                                        <option value="all">All clubs</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                {grouped.map(([category, boats]) => (
                                    <div key={category} className="mb-[22px]">
                                        <div className="flex justify-between items-baseline px-[2px] mb-[6px]">
                                            <span className="font-semibold pl-10">{category}</span>
                                        </div>

                                        <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[10px] list-none p-0 max-[640px]:grid-cols-1">
                                            {boats.map((b) => {
                                                const filled = b.rowerUids?.length ?? 0;
                                                const total = b.boatSize ?? 0;

                                                return (
                                                    <li key={b.id} className="card transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-DEFAULT">
                                                        <div className="flex justify-between gap-[10px]">
                                                            <div>
                                                                {b.bowNumber && (
                                                                    <div className="text-[0.75rem] font-bold text-brand">#{b.bowNumber}</div>
                                                                )}
                                                                <div className="font-semibold">{b.clubName}</div>
                                                                <div className="text-[0.75rem] text-muted">
                                                                    {b.categoryName ?? b.category}
                                                                </div>
                                                            </div>

                                                            <SeatDots filled={filled} total={total} />
                                                        </div>

                                                        <button
                                                            className="bg-none border-none py-2 w-full text-left text-muted"
                                                            onClick={() => toggleExpand(b.id)}
                                                        >
                                                            Crew ({filled}/{total})
                                                        </button>

                                                        {expandedBoats.has(b.id) && (
                                                            <ul className="flex flex-col gap-[6px] mt-[6px]">
                                                                {(b.rowerUids ?? []).map((uid: string) => (
                                                                    <li key={uid} className="flex items-center gap-2">
                                                                        <span className="w-6 h-6 rounded-full bg-brand-soft flex items-center justify-center text-[0.7rem]">
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
