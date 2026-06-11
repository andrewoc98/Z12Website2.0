import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { listEvents } from "../api/events";
import type { EventDoc } from "../types";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_HOST_EVENTS } from "../../home/components/tourMockData";
import { formatDate, getEventStatus } from "../lib/categories.ts";

type Mode = "active" | "finished";

const skeletonBar = "rounded-full [background:linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-2)_50%,var(--color-surface)_75%)] [background-size:600px_100%] animate-[sk-shimmer_1.4s_infinite_linear]";

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts);
}

export default function HostEventListPage() {
    const mock = DEV_MODE ? useMockAuth() : null;
    const fb = !DEV_MODE ? useAuth() : null;
    const hostUid = DEV_MODE ? mock?.user?.uid ?? null : fb?.user?.uid ?? null;

    const { isTourActive } = useTourMock();

    const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>("active");

    useEffect(() => {
        if (isTourActive) {
            setEvents(TOUR_HOST_EVENTS);
            setLoading(false);
            return;
        }
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
    }, [hostUid, isTourActive]);

    const visible = useMemo(() => {
        return events
            .filter((e) => {
                const status = getEventStatus(e);
                return mode === "finished"
                    ? status === "finished"
                    : status !== "finished";
            })
            .sort((a, b) => {
                const aStart = tsToDate(a.startDate)?.getTime() ?? 0;
                const bStart = tsToDate(b.startDate)?.getTime() ?? 0;
                return mode === "finished" ? bStart - aStart : aStart - bStart;
            });
    }, [events, mode]);

    return (
        <>
            <Navbar />
            <div className="grid gap-6 flex-1 content-start page" data-tour="host-events-list">
                <div className="flex justify-between items-end gap-5 max-[700px]:flex-col max-[700px]:items-start">
                    <div>
                        <h1>MY EVENTS</h1>
                        <p>Manage registrations and boats for your events.</p>
                    </div>
                    <div className="flex bg-bg border-2 border-brand-warm rounded-[14px] overflow-hidden">
                        <button
                            className={mode === "active" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("active")}
                        >
                            Active
                        </button>
                        <button
                            className={mode === "finished" ? "btn-primary" : "btn-ghost"}
                            onClick={() => setMode("finished")}
                        >
                            Finished
                        </button>
                    </div>
                </div>

                {loading && (
                    <div>
                        <div className="flex gap-[10px] my-4">
                            <div className={skeletonBar} style={{ width: 130, height: 32, borderRadius: 999 }} />
                        </div>

                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="border-2 border-brand-warm rounded-[14px] px-5 py-4 bg-transparent mb-[14px]">
                                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                                    <div className="flex flex-col gap-[6px]">
                                        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                            <div className={skeletonBar} style={{ width: "50%", height: 28, borderRadius: 6 }} />
                                            <div className={skeletonBar} style={{ width: 160, height: 16, borderRadius: 999 }} />
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-muted">
                                            <div className={skeletonBar} style={{ width: 120, height: 14, borderRadius: 999 }} />
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                                                <div className={skeletonBar} style={{ width: 160, height: 12, borderRadius: 999 }} />
                                                <div className={skeletonBar} style={{ width: 150, height: 12, borderRadius: 999 }} />
                                                <div className={skeletonBar} style={{ width: 155, height: 12, borderRadius: 999 }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className={skeletonBar} style={{ width: 90, height: 70, borderRadius: 14 }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {err && <p className="text-danger">{err}</p>}
                {!loading && !err && visible.length === 0 && (
                    <p>No {mode === "finished" ? "finished" : "active"} events found.</p>
                )}

                {!loading && !err && visible.length > 0 && (
                    <>
                        <div className="flex gap-[10px] my-4">
                            <span className="badge">
                                {visible.length} {mode === "finished" ? "finished" : "active"} events
                            </span>
                        </div>

                        <div className="grid gap-[14px]">
                            {visible.map((e) => {
                                const status = getEventStatus(e);
                                return (
                                    <Link
                                        key={e.id}
                                        to={`/host/events/${e.id}`}
                                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                                    >
                                        <div className="border-2 border-brand-warm rounded-[14px] px-5 py-4 bg-transparent transition-[border-color,transform,box-shadow] hover:border-[#f5b457] hover:-translate-y-[2px]">
                                            <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-[640px]:flex max-[640px]:flex-col max-[640px]:gap-3">
                                                <div className="flex flex-col gap-[6px]">
                                                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 max-[640px]:flex max-[640px]:flex-wrap max-[640px]:gap-[6px]">
                                                        <span className="font-condensed text-[28px] tracking-[1px] text-brand-warm max-[640px]:text-[2rem]">{e.name}</span>
                                                        <span className="text-[16px] text-muted max-[640px]:text-[0.9rem]">{e.lengthMeters}m Time Trial</span>
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-[14px] text-muted max-[640px]:flex max-[640px]:flex-col max-[640px]:items-start">
                                                        <span>{e.location}</span>
                                                        <div className="flex flex-col gap-1 mt-1 text-[0.85em]">
                                                            <div>Closes: {formatDate(e.closingDate)}</div>
                                                            <div>Starts: {formatDate(e.startDate)}</div>
                                                            <div>Ends: {formatDate(e.endDate)}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="max-[640px]:mt-[10px] max-[640px]:w-full">
                                                    <button className="w-[90px] h-[70px] rounded-[14px] bg-brand-warm text-brand-ink font-bold text-[14px] leading-[1.1] border-none transition-[filter] hover:brightness-95 hover:shadow-none max-[640px]:w-full max-[640px]:h-[54px]">
                                                        {status === "finished" ? "View" : "Manage"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
