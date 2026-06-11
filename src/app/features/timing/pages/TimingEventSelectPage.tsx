import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTimingEvents } from "../useTimingEvents";
import ConnectionBadge from "../components/ConnectionBadge";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer";

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === "function") return ts.toDate();
    return new Date(ts);
}

function formatDate(ts: any): string {
    const d = tsToDate(ts);
    if (!d) return "TBC";
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

function isActive(event: any): boolean {
    const now = new Date();
    const start = tsToDate(event.startAt);
    const end = tsToDate(event.endAt);
    if (!start || !end) return false;
    return now >= start && now <= end;
}

function isUpcoming(event: any): boolean {
    const now = new Date();
    const start = tsToDate(event.startAt);
    if (!start) return false;
    return start > now;
}

const sectionHeadingCls = "text-[0.8rem] font-bold tracking-[0.1em] uppercase text-muted mt-6 mb-[10px]";

const eventCardCls = "border-2 border-brand-warm rounded-[14px] px-5 py-4 bg-transparent cursor-pointer transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-[2px] hover:border-[#f5b457] hover:shadow-[0_4px_20px_rgba(254,185,89,0.15)]";

export default function TimingEventSelectPage() {
    const { events, loading } = useTimingEvents();
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const filtered = useMemo(() => events.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.location?.toLowerCase().includes(search.toLowerCase())
    ), [events, search]);

    const activeEvents = useMemo(() => filtered.filter(isActive), [filtered]);
    const upcomingEvents = useMemo(() => filtered.filter(isUpcoming).sort((a, b) => {
        const aDate = tsToDate(a.startAt)?.getTime() ?? 0;
        const bDate = tsToDate(b.startAt)?.getTime() ?? 0;
        return aDate - bDate;
    }), [filtered]);

    const header = (
        <div className="flex justify-between items-end gap-5 max-sm:flex-col max-sm:items-start">
            <div>
                <h1 className="font-condensed text-[40px] tracking-[2px] text-brand-warm m-0">TIMING</h1>
                <p className="mt-1 text-[14px] text-muted m-0">Select an event to begin timing.</p>
            </div>
            <ConnectionBadge />
        </div>
    );

    if (loading) return (
        <>
            <Navbar />
            <div className="grid gap-6 flex-1 content-start page">
                {header}
                <div className="grid gap-[14px]">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={eventCardCls}>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-sm:flex max-sm:flex-col max-sm:gap-3">
                                <div className="flex flex-col gap-[6px]">
                                    <div className="skeleton-bar" style={{ width: "55%", height: 24, borderRadius: 6 }} />
                                    <div className="skeleton-bar" style={{ width: 130, height: 13, borderRadius: 999 }} />
                                </div>
                                <div className="skeleton-bar" style={{ width: 90, height: 70, borderRadius: 14 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Footer />
        </>
    );

    const renderCard = (event: any, disabled: boolean) => (
        <div
            key={event.id}
            className={`${eventCardCls} ${disabled ? "opacity-50 cursor-default pointer-events-none" : ""}`}
            onClick={() => !disabled && navigate(`/timing/${event.id}`)}
        >
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-sm:flex max-sm:flex-col max-sm:gap-3">
                <div className="flex flex-col gap-[6px]">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 max-sm:flex max-sm:flex-wrap max-sm:gap-[6px] max-sm:items-center max-sm:flex-col">
                        <div className="font-condensed text-[28px] tracking-[1px] text-brand-warm">{event.name}</div>
                        {event.lengthMeters && (
                            <span className="text-[16px] text-muted">{event.lengthMeters}m Time Trial</span>
                        )}
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-[14px] text-muted max-sm:flex max-sm:flex-wrap max-sm:gap-[6px] max-sm:items-center max-sm:flex-col">
                        <span>{event.location}</span>
                        <div className="text-[13px] text-muted text-right max-sm:text-left">
                            <div>{formatDate(event.startAt)}</div>
                            <div>{formatDate(event.endAt)}</div>
                        </div>
                    </div>
                </div>
                <button
                    className="w-[90px] h-[70px] rounded-[14px] bg-brand-warm text-brand-ink font-bold text-[14px] leading-[1.2] border-0 cursor-pointer transition-[filter,transform] duration-150 min-h-[unset] hover:brightness-95 hover:scale-[1.03] hover:shadow-none disabled:bg-surface-2 disabled:text-muted disabled:cursor-default max-sm:w-full max-sm:h-[54px]"
                    disabled={disabled}
                >
                    {disabled ? "UPCOMING" : <>{`TIME`}<br />{`EVENT`}</>}
                </button>
            </div>
        </div>
    );

    return (
        <>
            <Navbar />
            <div className="grid gap-6 flex-1 content-start page" data-tour="timing-select">
                {header}

                {events.length > 1 && (
                    <div>
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="!rounded-[10px] focus:!border-brand-warm"
                        />
                    </div>
                )}

                {activeEvents.length === 0 && upcomingEvents.length === 0 && (
                    <p className="text-muted text-[14px]">No events found.</p>
                )}

                {activeEvents.length > 0 && (
                    <>
                        <h2 className={sectionHeadingCls}>Active</h2>
                        <div className="grid gap-[14px]">
                            {activeEvents.map(e => renderCard(e, false))}
                        </div>
                    </>
                )}

                {upcomingEvents.length > 0 && (
                    <>
                        <h2 className={sectionHeadingCls}>Upcoming</h2>
                        <div className="grid gap-[14px]">
                            {upcomingEvents.map(e => renderCard(e, true))}
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </>
    );
}
