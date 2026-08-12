import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../../events/api/events";
import type { EventDoc, EventSeriesType } from "../../events/types";

import Footer from "../../../shared/components/Footer/Footer.tsx";
import { formatDate } from "../../events/lib/categories.ts";
import { useAuth } from "../../../providers/AuthProvider";
import { useRoles } from "../../../providers/RoleProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_ROWER_EVENTS } from "../../home/components/tourMockData";

type SeriesConfig = {
    label: string;
    icon: string;
    stripBg: string;
    stripText: string;
    stripPadding: string;
    stripFontSize: string;
    stripFontWeight: number;
    stripLetterSpacing: string;
    borderColor: string;
    cardShadow?: string;
};

const SERIES_CONFIG: Record<EventSeriesType, SeriesConfig> = {
    regional_series: {
        label:              "Regional Series",
        icon:               "◈",
        stripBg:            "rgba(255,212,0,0.07)",
        stripText:          "rgba(255,212,0,0.5)",
        stripPadding:       "4px 20px",
        stripFontSize:      "0.62rem",
        stripFontWeight:    700,
        stripLetterSpacing: "0.10em",
        borderColor:        "rgba(255,212,0,0.35)",
    },
    national_series: {
        label:              "National Series",
        icon:               "◉",
        stripBg:            "rgba(255,212,0,0.14)",
        stripText:          "#ffd400",
        stripPadding:       "7px 20px",
        stripFontSize:      "0.68rem",
        stripFontWeight:    800,
        stripLetterSpacing: "0.13em",
        borderColor:        "rgba(255,212,0,0.65)",
    },
    national_event: {
        label:              "National Event",
        icon:               "★",
        stripBg:            "#ffd400",
        stripText:          "#141414",
        stripPadding:       "9px 20px",
        stripFontSize:      "0.75rem",
        stripFontWeight:    800,
        stripLetterSpacing: "0.15em",
        borderColor:        "#ffd400",
        cardShadow:         "0 0 0 1px rgba(255,212,0,0.25), 0 0 24px rgba(255,212,0,0.1)",
    },
};

const TIER_PRIORITY: Record<EventSeriesType, number> = {
    national_event:  3,
    national_series: 2,
    regional_series: 1,
};

type Mode = "upcoming" | "past";

const PAGE_SIZE = 10;

const skeletonBar = "rounded-full [background:linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-2)_50%,var(--color-surface)_75%)] [background-size:600px_100%] animate-[sk-shimmer_1.4s_infinite_linear]";

function feeSummary(event: EventDoc): { min: number; max: number; varies: boolean } | null {
    const fees = (event.categories ?? [])
        .map(c => c.feeCents ?? 0)
        .filter(f => f > 0);
    if (fees.length === 0) return null;
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    return { min, max, varies: min !== max };
}

function formatUsd(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

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
    const start = tsToDate(event.startDate);
    const end = tsToDate(event.endDate);

    if (!start || !end) return { type: "none", label: "Unavailable" };

    if (now > end) {
        return { type: "results", label: "View Results", link: `/events/${event.id}?tab=results` };
    }

    if (now >= start && now <= end) {
        return { type: "results", label: "View Results", link: `/events/${event.id}?tab=results` };
    }

    if (now < start) {
        if (isRower) {
            return { type: "signup", label: "Enter Race", link: `/events/${event.id}?tab=entries` };
        }

        if (!isRower) {
            return { type: "view", label: "View Start List", link: `/events/${event.id}?tab=entries` };
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

    // Highest-tier soonest event is pinned as the featured hero card (upcoming only)
    const featured = useMemo<(EventDoc & { id: string }) | null>(() => {
        if (mode !== "upcoming" || !visible.length) return null;
        return [...visible].sort((a, b) => {
            const aPri = a.seriesType ? TIER_PRIORITY[a.seriesType] : 0;
            const bPri = b.seriesType ? TIER_PRIORITY[b.seriesType] : 0;
            if (aPri !== bPri) return bPri - aPri;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        })[0] ?? null;
    }, [visible, mode]);

    // Secondary list: everything except the featured event
    const secondary = useMemo(() =>
        visible.filter(e => !featured || e.id !== featured.id),
    [visible, featured]);

    const totalPages = Math.max(1, Math.ceil(secondary.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const pageItems = useMemo(() => {
        const startIdx = (clampedPage - 1) * PAGE_SIZE;
        return secondary.slice(startIdx, startIdx + PAGE_SIZE);
    }, [secondary, clampedPage]);

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
                        {/* Hero skeleton card */}
                        <div style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface)", border: "1px solid rgba(254,185,89,0.25)", marginBottom: 8 }}>
                            {/* Gradient top area */}
                            <div className={skeletonBar} style={{ height: 100, borderRadius: 0 }} />
                            {/* Body row */}
                            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div className={skeletonBar} style={{ width: "50%", height: 13, marginBottom: 6 }} />
                                    <div className={skeletonBar} style={{ width: "35%", height: 11 }} />
                                </div>
                                <div className={skeletonBar} style={{ width: 110, height: 38, borderRadius: 6, flexShrink: 0 }} />
                            </div>
                        </div>

                        {/* Secondary 2-column grid skeleton */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                    {/* 3px accent strip */}
                                    <div className={skeletonBar} style={{ height: 3, borderRadius: 0 }} />
                                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                                        <div className={skeletonBar} style={{ width: "80%", height: 13 }} />
                                        <div className={skeletonBar} style={{ width: "60%", height: 11 }} />
                                        <div className={skeletonBar} style={{ width: "50%", height: 11 }} />
                                        <div className={skeletonBar} style={{ width: "30%", height: 11 }} />
                                        <div style={{ marginTop: "auto", paddingTop: 8 }}>
                                            <div className={skeletonBar} style={{ width: "100%", height: 32, borderRadius: 6 }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {err && <p className="text-danger">{err}</p>}
                {!loading && !err && visible.length === 0 && (
                    <p>No {mode === "past" ? "past" : "upcoming"} events found.</p>
                )}

                {!loading && !err && visible.length > 0 && (
                    <>
                        {/* ── Featured hero card ── */}
                        {featured && (() => {
                            const action = getEventAction(featured);
                            const cfg = featured.seriesType ? SERIES_CONFIG[featured.seriesType] : null;
                            const actionLink = action.link ?? `/events/${featured.id}`;
                            const borderCol = cfg?.borderColor ?? "rgba(254,185,89,0.4)";
                            return (
                                <div
                                    style={{
                                        borderRadius: 14,
                                        overflow: "hidden",
                                        background: "var(--surface)",
                                        border: `1px solid ${borderCol}`,
                                        boxShadow: cfg?.cardShadow ?? "0 4px 24px rgba(0,0,0,0.4)",
                                        transition: "transform 0.15s ease",
                                    }}
                                    className="hover:-translate-y-[2px]"
                                >
                                    {/* Hero gradient area — 100px with animated pan + subtle zoom */}
                                    <div style={{ position: "relative", height: 100, overflow: "hidden" }}>
                                        <div style={{
                                            position: "absolute", inset: 0,
                                            background: "linear-gradient(155deg, #32302a 0%, #2a2a30 45%, #1e1e22 100%)",
                                            backgroundSize: "220% 220%",
                                            animation: "gradPan 11s ease-in-out infinite alternate, heroZoom 14s ease-in-out infinite alternate",
                                        }} />
                                        {/* Bottom fade blends gradient into card body */}
                                        <div style={{
                                            position: "absolute", inset: 0,
                                            background: "linear-gradient(to top, var(--surface) 0%, transparent 55%)",
                                        }} />

                                        {/* Top-right: tier badge (pulsing for national events) */}
                                        {cfg && (
                                            <div style={{
                                                position: "absolute", top: 10, right: 12,
                                                background: "rgba(254,185,89,0.10)",
                                                border: "1px solid rgba(254,185,89,0.22)",
                                                color: "#FEB959",
                                                fontSize: "10px", fontWeight: 500,
                                                letterSpacing: "0.06em", textTransform: "uppercase",
                                                padding: "3px 9px", borderRadius: 4,
                                                whiteSpace: "nowrap",
                                                animation: featured.seriesType === "national_event"
                                                    ? "selGold 2.4s ease-in-out infinite"
                                                    : undefined,
                                            }}>
                                                {cfg.icon} {cfg.label}
                                            </div>
                                        )}

                                        {/* Bottom-left: location label + event name */}
                                        <div style={{ position: "absolute", bottom: 10, left: 14, right: cfg ? 140 : 14 }}>
                                            <div style={{
                                                fontSize: "10px", fontWeight: 500,
                                                letterSpacing: "0.10em", textTransform: "uppercase",
                                                color: "rgba(254,185,89,0.45)", marginBottom: 4,
                                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                                {featured.location}
                                            </div>
                                            <Link to={`/events/${featured.id}`} style={{
                                                fontSize: "20px", fontWeight: 500,
                                                color: "#f0eee8", textDecoration: "none",
                                                display: "block", lineHeight: 1.15,
                                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                                {featured.name}
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Card body */}
                                    <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                                                {formatDate(featured.startDate)} · {featured.lengthMeters}m
                                            </div>
                                            {featured.closingDate && (
                                                <div style={{ fontSize: "11px", color: "rgba(254,185,89,0.65)", marginTop: 2 }}>
                                                    Closes {formatDate(featured.closingDate)}
                                                </div>
                                            )}
                                            {(() => {
                                                const fs = feeSummary(featured);
                                                if (!fs) return null;
                                                return (
                                                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                                                        <div style={{
                                                            display: "inline-flex", alignItems: "center", gap: 4,
                                                            padding: "2px 8px",
                                                            background: "rgba(254,185,89,0.12)",
                                                            border: "1px solid rgba(254,185,89,0.30)",
                                                            borderRadius: 4, fontSize: "11px",
                                                            color: "#FEB959", fontWeight: 600,
                                                        }}>
                                                            {fs.varies ? `From ${formatUsd(fs.min)}` : formatUsd(fs.min)}
                                                        </div>
                                                        {fs.varies && (
                                                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", paddingLeft: 2 }}>
                                                                up to {formatUsd(fs.max)} · rates vary by boat class
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <Link to={actionLink} style={{ flexShrink: 0 }}>
                                            <button style={{
                                                background: "#FEB959", color: "#111",
                                                border: "none", borderRadius: 6,
                                                padding: "11px 26px", fontSize: 14,
                                                fontWeight: 500, cursor: "pointer",
                                                letterSpacing: "0.02em",
                                            }}>
                                                {action.label}
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Section label ── */}
                        {secondary.length > 0 && (
                            <div style={{
                                fontSize: "11px", fontWeight: 500,
                                color: "rgba(255,255,255,0.30)",
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                marginTop: 10, marginBottom: 2,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                                <span>
                                    {secondary.length} {mode === "past" ? "past" : "upcoming"} {secondary.length === 1 ? "event" : "events"}
                                </span>
                                {totalPages > 1 && (
                                    <span>Page {clampedPage} / {totalPages}</span>
                                )}
                            </div>
                        )}

                        {/* ── Secondary cards — 2-column Dice.fm grid ── */}
                        {pageItems.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                                {pageItems.map((e) => {
                                    const action = getEventAction(e);
                                    const cfg = e.seriesType ? SERIES_CONFIG[e.seriesType] : null;
                                    const actionLink = action.link ?? `/events/${e.id}`;
                                    const stripColor = cfg?.borderColor ?? "rgba(254,185,89,0.25)";
                                    const tierTextColor = cfg
                                        ? (cfg.stripText === "#141414" ? "#ffd400" : cfg.stripText)
                                        : undefined;

                                    return (
                                        <div key={e.id} style={{
                                            background: "var(--surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            display: "flex",
                                            flexDirection: "column",
                                            transition: "transform 0.1s ease",
                                        }} className="hover:-translate-y-[1px]">
                                            {/* Tier accent — 3px coloured strip at top */}
                                            <div style={{ height: 3, background: stripColor, flexShrink: 0 }} />

                                            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                                                {/* Tier label */}
                                                {cfg && (
                                                    <div style={{
                                                        fontSize: "10px", fontWeight: 500,
                                                        color: tierTextColor,
                                                        letterSpacing: "0.08em",
                                                        textTransform: "uppercase",
                                                    }}>
                                                        {cfg.icon} {cfg.label}
                                                    </div>
                                                )}

                                                {/* Event name — up to 2 lines */}
                                                <Link to={`/events/${e.id}`} style={{
                                                    fontSize: "13px", fontWeight: 500,
                                                    color: "#f0eee8", textDecoration: "none",
                                                    lineHeight: 1.3,
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                } as React.CSSProperties}>
                                                    {e.name}
                                                </Link>

                                                {/* Venue + date */}
                                                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.45 }}>
                                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {e.location}
                                                    </div>
                                                    <div>{formatDate(e.startDate)}</div>
                                                </div>

                                                {/* Distance */}
                                                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)" }}>
                                                    {e.lengthMeters}m
                                                </div>

                                                {/* Entry fee badge */}
                                                {(() => {
                                                    const fs = feeSummary(e);
                                                    if (!fs) return null;
                                                    return (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignSelf: "flex-start" }}>
                                                            <div style={{
                                                                display: "inline-flex", alignItems: "center",
                                                                padding: "2px 7px",
                                                                background: "rgba(254,185,89,0.10)",
                                                                border: "1px solid rgba(254,185,89,0.28)",
                                                                borderRadius: 4, fontSize: "10px",
                                                                color: "#FEB959", fontWeight: 600,
                                                            }}>
                                                                {fs.varies ? `From ${formatUsd(fs.min)}` : formatUsd(fs.min)}
                                                            </div>
                                                            {fs.varies && (
                                                                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.30)", paddingLeft: 1 }}>
                                                                    up to {formatUsd(fs.max)} · varies by class
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* CTA — full width, pinned to bottom */}
                                                <div style={{ marginTop: "auto", paddingTop: 8 }}>
                                                    <Link to={actionLink} style={{ display: "block" }}>
                                                        <button style={{
                                                            width: "100%",
                                                            background: "#FEB959", color: "#141414",
                                                            border: "none", borderRadius: 6,
                                                            padding: "8px 10px", fontSize: "12px",
                                                            fontWeight: 600, cursor: "pointer",
                                                            letterSpacing: "0.02em",
                                                        }}>
                                                            {action.label}
                                                        </button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Pagination ── */}
                        {totalPages > 1 && (
                            <div className="bg-bg border-2 border-brand-warm rounded-[14px] p-[14px] my-[22px]">
                                <div className="space-between">
                                    <button
                                        className="btn-ghost"
                                        disabled={clampedPage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        ← Prev
                                    </button>
                                    <span className="badge">Page {clampedPage} / {totalPages}</span>
                                    <button
                                        className="btn-ghost"
                                        disabled={clampedPage >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <Footer />
        </>
    );
}
