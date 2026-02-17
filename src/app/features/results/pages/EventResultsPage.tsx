import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listBoatsForEvent, getElapsedMs } from "../../signup/api/boats";
import { getEventById } from "../api/results";
import OverallResults from "../components/OverallResults";
import CategoryResults from "../components/CategoryResults";
import "../style/EventResultsPage.css";
import type {Boat} from "../components/ResultCard.tsx";

export default function EventResultsPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const [event, setEvent] = useState<any>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<"overall" | "category">("overall");
    const [selectedCategory, setSelectedCategory] = useState<string | "All">("All");
    const [page, setPage] = useState<number>(1);
    const PAGE_SIZE = 10; // boats per page

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

    // Finished boats with elapsed times
    const finishedBoats = useMemo(() => {
        return boats
            .filter(b => b.startedAt && b.finishedAt)
            .map(b => ({ ...b, elapsedMs: getElapsedMs(b)! }))
            .sort((a, b) => a.elapsedMs - b.elapsedMs);
    }, [boats]);

    // Group boats by category
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

    // Pagination slice
    const paginatedBoats = useMemo<Boat[]>(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        if (tab === "overall") return finishedBoats.slice(start, end);

        if (tab === "category") {
            if (selectedCategory === "All") {
                // Merge all categories
                const allBoats = Array.from(byCategory.values()).flat();
                return allBoats.slice(start, end);
            } else {
                const boatsInCat = byCategory.get(selectedCategory) || [];
                return boatsInCat.slice(start, end);
            }
        }
        return []
    }, [tab, page, finishedBoats, byCategory, selectedCategory]);

    // Total pages
    const totalPages = useMemo(() => {
        const totalItems = tab === "overall"
            ? finishedBoats.length
            : selectedCategory === "All"
                ? Array.from(byCategory.values()).flat().length
                : (byCategory.get(selectedCategory)?.length || 0);
        return Math.ceil(totalItems / PAGE_SIZE);
    }, [tab, byCategory, finishedBoats, selectedCategory]);

    return (
        <>
            <Navbar />
            <main className="results-page">
                <div className="results-header">
                    <Link to="/rower/events" className="btn-ghost">← Back to events</Link>
                    <h1>{event?.name} — Results</h1>
                    {event && (
                        <div className="event-meta">
                            {event.location} • {new Date(event.startDate).toDateString()} → {new Date(event.endDate).toDateString()}
                        </div>
                    )}
                    <div className="tab-buttons">
                        <button className="btn-primary" disabled={tab === "overall"} onClick={() => { setTab("overall"); setPage(1); }}>Overall</button>
                        <button className="btn-primary" disabled={tab === "category"} onClick={() => { setTab("category"); setPage(1); }}>By Category</button>
                        <button className="btn-primary" onClick={refresh}>Refresh</button>
                    </div>

                    {tab === "category" && (
                        <div className="category-filter">
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
                    <p className="error">{err}</p>
                ) : finishedBoats.length === 0 ? (
                    <p>No finished results yet.</p>
                ) : tab === "overall" ? (
                    <OverallResults boats={paginatedBoats} />
                ) : (
                    <CategoryResults byCategory={byCategory} selectedCategory={selectedCategory}/>
                )}

                {((finishedBoats.length > PAGE_SIZE) && tab === "overall") && (
                    <div className="pagination">
                        <button className="btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span>Page {page} of {totalPages}</span>
                        <button className="btn-primary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </main>
        </>
    );
}