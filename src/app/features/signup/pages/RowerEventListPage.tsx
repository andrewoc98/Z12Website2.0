import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc } from "../../events/types";

import Footer from "../../../shared/components/Footer/Footer.tsx";
import { formatDate } from "../../events/lib/categories.ts";
import { useAuth } from "../../../providers/AuthProvider";
import { useRoles } from "../../../providers/RoleProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_ROWER_EVENTS } from "../../home/components/tourMockData";

type Mode = "upcoming" | "past";

const PAGE_SIZE = 10;

const skeletonBar = "rounded-full [background:linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-2)_50%,var(--color-surface)_75%)] [background-size:600px_100%] animate-[sk-shimmer_1.4s_infinite_linear]";

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts);
}

function getEventAction(event: EventDoc) {
    const { user } = useAuth();
    const { hasRole } = useRoles();
    const isRower = !!user && hasRole("rower");

    const now = new Date();
    const closing = tsToDate(event.closingDate);
    const start = tsToDate(event.startDate);
    const end = tsToDate(event.endDate);

    if (!start || !end) return { type: "none", label: "Unavailable" };

    if (now > end) {
        return { type: "results", label: "View Results", link: `/rower/events/${event.id}/results` };
    }

    if (now >= start && now <= end) {
        return { type: "results", label: "View Results", link: `/rower/events/${event.id}/results` };
    }

    if (now < start) {
        if (isRower) {
            if (closing && now > closing) {
                return { type: "disabled", label: "Reg Closed" };
            }
            return { type: "signup", label: "Enter Race", link: `/rower/events/${event.id}/signup` };
        }

        if (!isRower) {
            return { type: "view", label: "View Start List", link: `/events/${event.id}/view` };
        }

        return { type: "login", label: "Login to Enter", link: "/auth" };
    }

    return { type: "none", label: "Unavailable" };
}

export default function RowerEventListPage() {
    const { isTourActive } = useTourMock();

    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("upcoming");
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (isTourActive) {
            setEvents(TOUR_ROWER_EVENTS);
            setLoading(false);
            return;
        }

        (async () => {
            setLoading(true);
            setErr(null);

            try {
                const all = await listEvents();
                setEvents(all);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load events");
            } finally {
                setLoading(false);
            }
        })();
    }, [isTourActive]);

    useEffect(() => setPage(1), [mode]);

    const visible = useMemo(() => {
        return events
            .filter(e => {
                const start = tsToDate(e.startDate);
                const end = tsToDate(e.endDate);
                if (!start || !end) return false;

                if (mode === "past") return end < new Date();
                return end >= new Date();
            })
            .sort((a, b) => {
                const aStart = new Date(a.startDate).getTime();
                const bStart = new Date(b.startDate).getTime();
                return mode === "past" ? bStart - aStart : aStart - bStart;
            });
    }, [events, mode]);

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const pageItems = useMemo(() => {
        const startIdx = (clampedPage - 1) * PAGE_SIZE;
        return visible.slice(startIdx, startIdx + PAGE_SIZE);
    }, [visible, clampedPage]);

    return (
        <>
            <Navbar />
            <div className="grid gap-6 flex-1 content-start page" data-tour="events-list">
                <div className="flex justify-between items-end gap-5 max-[700px]:flex-col max-[700px]:items-start">
                    <div>
                        <h1>RACES</h1>
                        <p>Sign up for upcoming events, or view results for past events.</p>
                    </div>
                    <div className="flex bg-bg border-2 border-brand-warm rounded-[14px] overflow-hidden">
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

                {loading && (
                    <div>
                        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                            <div className={skeletonBar} style={{ width: 120, height: 26 }} />
                            <div className={skeletonBar} style={{ width: 90, height: 26 }} />
                        </div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="border-2 border-brand-warm rounded-[14px] px-5 py-4 bg-transparent mb-[14px]">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div className={skeletonBar} style={{ width: "55%", height: 18, marginBottom: 10 }} />
                                        <div className={skeletonBar} style={{ width: "30%", height: 14, marginBottom: 14 }} />
                                        <div className={skeletonBar} style={{ width: "40%", height: 12, marginBottom: 6 }} />
                                        <div className={skeletonBar} style={{ width: "36%", height: 12, marginBottom: 6 }} />
                                        <div className={skeletonBar} style={{ width: "38%", height: 12 }} />
                                    </div>
                                    <div className={skeletonBar} style={{ width: 110, height: 38, borderRadius: 8, flexShrink: 0 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {err && <p className="text-danger">{err}</p>}
                {!loading && !err && visible.length === 0 && (
                    <p>No {mode === "past" ? "past" : "upcoming"} events found.</p>
                )}

                {!loading && !err && visible.length > 0 && (
                    <>
                        <div className="flex gap-[10px] my-4">
                            <span className="badge">
                                {visible.length} {mode === "past" ? "past" : "upcoming"} events
                            </span>
                            <span className="badge">
                                Page {clampedPage} / {totalPages}
                            </span>
                        </div>

                        <div className="grid gap-[14px]">
                            {pageItems.map((e) => {
                                const action = getEventAction(e);
                                return (
                                    <div key={e.id} className="border-2 border-brand-warm rounded-[14px] px-5 py-4 bg-transparent transition-[border-color,transform,box-shadow] hover:border-[#f5b457] hover:-translate-y-[2px]">
                                        <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-[640px]:flex max-[640px]:flex-col max-[640px]:gap-3">
                                            <div className="flex flex-col gap-[6px]">
                                                <div className="grid grid-cols-[1fr_auto] items-center gap-2 max-[640px]:flex max-[640px]:flex-wrap max-[640px]:gap-[6px] max-[640px]:flex-col max-[640px]:items-start">
                                                    <span className="font-condensed text-[28px] tracking-[1px] text-brand-warm max-[640px]:text-[2rem]">{e.name}</span>
                                                    <span className="text-[16px] text-muted max-[640px]:text-[0.9rem]">{e.lengthMeters}m Time Trial</span>
                                                </div>
                                                <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-[14px] text-muted max-[640px]:flex max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[2px]">
                                                    <span>{e.location}</span>
                                                    <div className="flex flex-col gap-1 mt-1 text-[0.85em]">
                                                        <div>Closes: {formatDate(e.closingDate)}</div>
                                                        <div>Starts: {formatDate(e.startDate)}</div>
                                                        <div>Ends: {formatDate(e.endDate)}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="max-[640px]:mt-[10px] max-[640px]:w-full">
                                                {action.type === "signup" || action.type === "results"
                                                || action.type === "login" || action.type === "view" ? (
                                                    <Link to={action.link!}>
                                                        <button className="w-[90px] h-[70px] rounded-[14px] bg-brand-warm text-brand-ink font-bold text-[14px] leading-[1.1] border-none transition-[filter] hover:brightness-95 hover:shadow-none max-[640px]:w-full max-[640px]:h-[54px]">{action.label}</button>
                                                    </Link>
                                                ) : action.type === "disabled" ? (
                                                    <button className="w-[90px] h-[70px] rounded-[14px] bg-brand-warm text-brand-ink font-bold text-[14px] leading-[1.1] border-none opacity-35 cursor-not-allowed max-[640px]:w-full max-[640px]:h-[54px]" disabled>
                                                        {action.label}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-bg border-2 border-brand-warm rounded-[14px] p-[14px] my-[22px]">
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
            </div>
            <Footer />
        </>
    );
}
