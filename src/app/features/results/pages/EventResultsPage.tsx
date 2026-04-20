import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { getEventById, fetchRowersByUids } from "../api/results";
import OverallResults from "../components/OverallResults";
import CategoryResults from "../components/CategoryResults";
import "../style/EventResultsPage.css";
import type { Boat } from "../components/ResultCard.tsx";

const functions = getFunctions();
const getEventResults = httpsCallable(functions, "getEventResults");

const PAGE_SIZE = 10;

export default function EventResultsPage() {
    const { eventId } = useParams<{ eventId: string }>();

    const [event, setEvent] = useState<any>(null);
    const [boats, setBoats] = useState<Boat[]>([]);
    const [rowerMap, setRowerMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<"overall" | "category">("overall");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [lastDocId, setLastDocId] = useState<string | null>(null);

    // Load event metadata once
    useEffect(() => {
        if (!eventId) return;
        getEventById(eventId).then(setEvent).catch(console.error);
    }, [eventId]);

    const loadPage = useCallback(async (opts: {
        pageNum: number;
        lastDocId: string | null;
        category: string;
    }) => {
        if (!eventId) return;
        setErr(null);
        setLoading(true);
        try {
            const result: any = await getEventResults({
                eventId,
                pageSize: PAGE_SIZE,
                lastDocId: opts.pageNum === 1 ? null : opts.lastDocId,
                category: opts.category === "All" ? null : opts.category,
            });

            const newBoats: Boat[] = result.data.boats;
            setBoats(newBoats);
            setHasMore(result.data.hasMore);
            setLastDocId(result.data.lastDocId);

            // Fetch rower names only for this page (max 40 reads)
            const allUids = newBoats.flatMap((b: any) => b.rowerUids ?? []);
            const map = await fetchRowersByUids(allUids);
            setRowerMap(map);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load results");
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    // Initial load
    useEffect(() => {
        loadPage({ pageNum: 1, lastDocId: null, category: "All" });
    }, [eventId]);

    const handleRefresh = () => {
        setPage(1);
        setLastDocId(null);
        loadPage({ pageNum: 1, lastDocId: null, category: selectedCategory });
    };

    const handlePrev = () => {
        // Re-fetch from beginning up to previous page
        // Simplest approach: go back to page 1 and step forward
        // For now, reset to page 1 (cursor-based pagination doesn't support backwards easily)
        setPage(1);
        setLastDocId(null);
        loadPage({ pageNum: 1, lastDocId: null, category: selectedCategory });
    };

    const handleNext = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPage({ pageNum: nextPage, lastDocId, category: selectedCategory });
    };

    const handleCategoryChange = (cat: string) => {
        setSelectedCategory(cat);
        setPage(1);
        setLastDocId(null);
        loadPage({ pageNum: 1, lastDocId: null, category: cat });
    };

    const handleTabChange = (newTab: "overall" | "category") => {
        setTab(newTab);
        setPage(1);
        setLastDocId(null);
        setSelectedCategory("All");
        loadPage({ pageNum: 1, lastDocId: null, category: "All" });
    };

    // Derive categories from loaded boats for the filter dropdown
    const categories = useMemo(() => {
        const cats = new Set(boats.map((b: any) => b.categoryName ?? b.category ?? "—"));
        return Array.from(cats);
    }, [boats]);

    const formatDate = (value: number | Date | string | null | undefined) => {
        if (!value) return "—";
        const ts = typeof value === "number" ? value
            : value instanceof Date ? value.getTime()
                : new Date(value).getTime();
        return isNaN(ts) ? "—" : new Date(ts).toDateString();
    };

    return (
        <>
            <Navbar />
            <main className="results-page">
                <div className="results-header">
                    <Link to="/events" className="btn-ghost">← Back to events</Link>
                    <h1>{event?.name} — Results</h1>
                    {event && (
                        <div className="event-meta">
                            {event.location} • {formatDate(event.startDate)} → {formatDate(event.endDate)}
                        </div>
                    )}
                    <div className="tab-buttons">
                        <button
                            className="btn-primary"
                            disabled={tab === "overall"}
                            onClick={() => handleTabChange("overall")}
                        >
                            Overall
                        </button>
                        <button
                            className="btn-primary"
                            disabled={tab === "category"}
                            onClick={() => handleTabChange("category")}
                        >
                            By Category
                        </button>
                        <button className="btn-primary" onClick={handleRefresh}>
                            Refresh
                        </button>
                    </div>

                    {tab === "category" && (
                        <div className="category-filter">
                            <label>Filter by category: </label>
                            <select
                                value={selectedCategory}
                                onChange={e => handleCategoryChange(e.target.value)}
                            >
                                <option value="All">All</option>
                                {categories.map(cat => (
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
                ) : boats.length === 0 ? (
                    <p>No finished results yet.</p>
                ) : tab === "overall" ? (
                    <OverallResults boats={boats} rowerMap={rowerMap} />
                ) : (
                    <CategoryResults
                        boats={boats}
                        rowerMap={rowerMap}
                        selectedCategory={selectedCategory}
                    />
                )}

                <div className="pagination">
                    <button
                        className="btn-primary"
                        disabled={page === 1 || loading}
                        onClick={handlePrev}
                    >
                        Previous
                    </button>
                    <span>Page {page}</span>
                    <button
                        className="btn-primary"
                        disabled={!hasMore || loading}
                        onClick={handleNext}
                    >
                        Next
                    </button>
                </div>
            </main>
        </>
    );
}