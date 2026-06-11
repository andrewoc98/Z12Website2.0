import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listBoatsForEvent } from "../../signup/api/boats";
import { getEventById } from "../api/results";
import OverallResults from "../components/OverallResults";
import CategoryResults from "../components/CategoryResults";
import type {Boat} from "../components/ResultCard.tsx";
import { useUserProfiles } from "../../timing/useUserProfiles.ts";
import { useAuth } from "../../../providers/AuthProvider";
import { useAthleteRoster } from "../../coaches/hooks/useAthleteRoster";

export default function EventResultsPage() {
    const { user, profile } = useAuth();
    const { eventId } = useParams<{ eventId: string }>();
    const [event, setEvent] = useState<any>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<"overall" | "category">("overall");
    const [selectedCategory, setSelectedCategory] = useState<string | "All">("All");
    const [page, setPage] = useState<number>(1);
    const PAGE_SIZE = 10;

    const inProgressBoats = useMemo(() => {
        return boats.filter(b => b.startedAt && !b.finishedAt && b.status !== "dnf" && b.status !== "dns");
    }, [boats]);

    const allUids = useMemo(() => {
    const uids = new Set<string>();
    boats.forEach(b => (b.rowerUids ?? []).forEach((uid: string) => uids.add(uid)));
    return Array.from(uids);
    }, [boats]);

    const { profiles } = useUserProfiles(allUids);

    const isCoach = !!profile?.roles?.coach;
    const { roster } = useAthleteRoster(isCoach ? (user?.uid ?? null) : null);
    const linkedAthleteUids = useMemo(() => {
        if (!isCoach) return undefined;
        return new Set(roster.filter(r => r.status === "active").map(r => r.rowerId));
    }, [isCoach, roster]);
    
    const toTimestamp = (value: number | Date | string | null | undefined): number | null => {
        if (!value) return null;
        if (typeof value === "number") return value;
        if (value instanceof Date) return value.getTime();
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed.getTime();
    };

    const formatDate = (value: number | Date | string | null | undefined) => {
        const ts = toTimestamp(value);
        if (ts == null) return "—";
        return new Date(ts).toDateString();
    };

    async function refresh() {
        if (!eventId) return;
        setErr(null);
        setLoading(true);
        try {
            const e = await getEventById(eventId);
            setEvent(e);
            const b = await listBoatsForEvent(eventId);
            setBoats(b);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load results");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { refresh(); }, [eventId]);

    const finishedBoats = useMemo(() => {
        return boats
            .map(b => {
                const startMs = toTimestamp(b.startedAt);
                const finishMs = toTimestamp(b.finishedAt);
                const status = b.status?.toLowerCase();

                // under_review boats are hidden until an admin confirms them
                if (status === "under_review") return null;

                // A boat is "Resolved" if it has a finish time OR a DNF/DNS status
                const isResolved = (startMs != null && finishMs != null) || status === "dnf" || status === "dns";

                if (!isResolved) return null;

                return {
                    ...b,
                    startedAt: startMs,
                    finishedAt: finishMs,
                    // Use Infinity for elapsedMs on DNF/DNS so they sort to the bottom
                    elapsedMs: (startMs && finishMs) ? finishMs - startMs : Infinity
                };
            })
            .filter((b): b is any => b !== null)
            .sort((a, b) => {
                // Priority 1: Timed results come before DNF/DNS
                if (a.elapsedMs === Infinity && b.elapsedMs !== Infinity) return 1;
                if (a.elapsedMs !== Infinity && b.elapsedMs === Infinity) return -1;

                // Priority 2: Sort by time
                if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;

                // Priority 3: If both are Infinity (DNF/DNS), sort alphabetically (DNF before DNS)
                return (a.status || "").localeCompare(b.status || "");
            });
    }, [boats]);

    const byCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const b of finishedBoats) {
            const cat = b.categoryName ?? b.category ?? "—";
            const list = map.get(cat) ?? [];
            list.push(b);
            map.set(cat, list);
        }
        for (const [cat, list] of map.entries()) {
            list.sort((a, b) => a.elapsedMs - b.elapsedMs);
            map.set(cat, list);
        }
        return map;
    }, [finishedBoats]);

    const visibleBoats = useMemo(() => {
        if (!event?.resultsPublishMode || event.resultsPublishMode === "Live") {
            return finishedBoats;
        }
        if (event.resultsPublishMode === "Category") {
            const filteredByCategory: any[] = [];
            for (const [, boatsInCat] of byCategory.entries()) {
                const allFinished = boatsInCat.every(b => toTimestamp(b.finishedAt) != null);
                if (allFinished) filteredByCategory.push(...boatsInCat);
            }
            return filteredByCategory;
        }
        if (event.resultsPublishMode === "Event") {
            const allFinished = boats.every(b => toTimestamp(b.finishedAt) != null);
            return allFinished ? finishedBoats : [];
        }
        return finishedBoats;
    }, [event?.resultsPublishMode, finishedBoats, byCategory, boats]);

    const paginatedBoats = useMemo<Boat[]>(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        if (tab === "overall") return visibleBoats.slice(start, end);
        if (tab === "category") {
            if (selectedCategory === "All") {
                const allBoats = Array.from(byCategory.values()).flat().filter(b => visibleBoats.includes(b));
                return allBoats.slice(start, end);
            } else {
                const boatsInCat = (byCategory.get(selectedCategory) || []).filter(b => visibleBoats.includes(b));
                return boatsInCat.slice(start, end);
            }
        }
        return [];
    }, [tab, page, visibleBoats, byCategory, selectedCategory]);

    const totalPages = useMemo(() => {
        const totalItems = tab === "overall"
            ? visibleBoats.length
            : selectedCategory === "All"
                ? Array.from(byCategory.values()).flat().filter(b => visibleBoats.includes(b)).length
                : (byCategory.get(selectedCategory)?.filter(b => visibleBoats.includes(b)).length || 0);
        return Math.ceil(totalItems / PAGE_SIZE);
    }, [tab, byCategory, visibleBoats, selectedCategory]);

    return (
        <>
            <Navbar />
            <main className="px-4 pt-6 pb-12 max-w-[900px] mx-auto max-sm:px-3 max-sm:pt-4 max-sm:pb-10">
                <div className="flex flex-col gap-2 mb-6">
                    <Link to="/events" className="btn-ghost">← Back to events</Link>
                    <h1 className="m-0 text-[1.6rem]">{event?.name} — Results</h1>
                    {event && (
                        <div className="text-muted text-[0.9rem]">
                            {event.location} • {formatDate(event.startDate)} → {formatDate(event.endDate)}
                        </div>
                    )}
                    <div className="flex gap-0 bg-surface border border-border rounded-DEFAULT p-1 w-fit mt-2 max-sm:w-full">
                        {(["overall", "category"] as const).map(t => (
                            <button
                                key={t}
                                className={`flex-1 border-none px-5 py-2 font-semibold text-[0.85rem] tracking-[0.05em] cursor-pointer rounded-[calc(16px-2px)] transition-[color,background] duration-150 ${tab === t ? "text-brand bg-surface-2 shadow-[0_1px_3px_rgba(0,0,0,0.3)] cursor-default" : "bg-none text-muted hover:text-text hover:bg-surface-2"} max-sm:px-[10px] max-sm:text-[0.8rem]`}
                                onClick={() => { setTab(t); setPage(1); }}
                            >
                                {t === "overall" ? "Overall" : "By Category"}
                            </button>
                        ))}
                        <button
                            className="border-l border-border rounded-none ml-1 pl-4 flex-1 border-t-0 border-r-0 border-b-0 py-2 font-semibold text-[0.85rem] tracking-[0.05em] text-muted cursor-pointer bg-none transition-[color,background] duration-150 hover:text-text hover:bg-surface-2 max-sm:px-[10px] max-sm:text-[0.8rem]"
                            onClick={refresh}
                        >
                            Refresh
                        </button>
                    </div>

                    {tab === "category" && (
                        <div className="flex items-center gap-2 mt-2 text-muted text-[0.9rem]">
                            <label>Filter by category: </label>
                            <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setPage(1); }}>
                                <option value="All">All</option>
                                {Array.from(byCategory.keys()).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <hr />

                {loading ? (
                    <p>Loading results…</p>
                ) : err ? (
                    <p className="text-danger">{err}</p>
                ) : finishedBoats.length === 0 ? (
                    <p>No finished results yet.</p>
                ) : tab === "overall" ? (
                    <OverallResults boats={paginatedBoats} inProgressBoats={inProgressBoats} profiles={profiles} page={page} pageSize={PAGE_SIZE} currentUserUid={user?.uid} linkedAthleteUids={linkedAthleteUids} />
                ) : (
                    <CategoryResults byCategory={byCategory} selectedCategory={selectedCategory} inProgressBoats={inProgressBoats} profiles={profiles} page={page} pageSize={PAGE_SIZE} currentUserUid={user?.uid} linkedAthleteUids={linkedAthleteUids} />
                )}
                {finishedBoats.length > PAGE_SIZE && tab === "overall" && (
                    <div className="flex justify-center items-center gap-3 mt-6 text-muted text-[0.9rem]">
                        <button className="btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button className="btn-primary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </main>
        </>
    );
}