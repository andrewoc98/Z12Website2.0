import { useState, useMemo } from "react";
import { formatRowerNames } from "../../timing/lib/utils";

export interface Boat {
    id: string;
    clubName: string;
    boatSize: number;
    bowNumber?: number;
    categoryName?: string;
    category?: string;
    elapsedMs: number;
    startedAt: string | number | Date;
    finishedAt?: string | number | Date;
    adjustmentMs?: number;
    status?: string;
    rowerUids?: string[];
}

interface ResultCardProps {
    boat: Boat;
    rank?: number;
    inProgress?: boolean;
    profiles: Record<string, any>;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
}

export default function ResultCard({ boat, rank, inProgress, profiles, currentUserUid, linkedAthleteUids }: ResultCardProps) {
    const isMe = !!(currentUserUid && (boat.rowerUids ?? []).includes(currentUserUid));
    const isMyAthlete = !isMe && !!(linkedAthleteUids?.size && (boat.rowerUids ?? []).some(uid => linkedAthleteUids.has(uid)));
    const [open, setOpen] = useState(false);
    const status = boat.status?.toUpperCase();
    const isSpecialStatus = status === "DNF" || status === "DNS";

    const adjustedElapsedMs = useMemo(() => {
        return boat.elapsedMs + ((boat.adjustmentMs ?? 0) * 1000);
    }, [boat.elapsedMs, boat.adjustmentMs]);

    const formatElapsed = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);
        return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
    };

    const rowerNames = formatRowerNames(boat.rowerUids ?? [], profiles, boat.boatSize);
    const displayStarted = new Date(boat.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const cardCls = [
        "bg-surface border rounded-sm px-4 py-[14px] cursor-pointer transition-[border-color] duration-150 max-sm:px-3",
        inProgress           ? "border-[#3b82f6] bg-[rgba(59,130,246,0.05)]" : "",
        isMe && !inProgress  ? "border-brand bg-[rgba(255,212,0,0.03)] animate-[mine-glow_3s_ease-in-out_infinite] hover:border-brand" : "",
        isMyAthlete          ? "border-[#10b981] bg-[rgba(16,185,129,0.03)] hover:border-[#10b981]" : "",
        !inProgress && !isMe && !isMyAthlete ? "border-border hover:border-brand" : "",
    ].filter(Boolean).join(" ");

    return (
        <li className={cardCls} onClick={() => setOpen(!open)}>
            <div className="flex justify-between items-center gap-3 max-sm:flex-wrap max-sm:gap-2">
                <div className="flex items-center gap-3 min-w-0 max-sm:flex-1 max-sm:min-w-0">
                    {!inProgress && rank && !isSpecialStatus && (
                        <span className="text-[1rem] font-bold text-brand min-w-8 max-sm:min-w-6 max-sm:text-[0.9rem]">#{rank}</span>
                    )}
                    {isSpecialStatus && (
                        <span className="text-[1rem] font-bold text-brand min-w-8 max-sm:min-w-6 max-sm:text-[0.9rem]">—</span>
                    )}
                    {inProgress && (
                        <span className="w-[10px] h-[10px] rounded-full bg-[#3b82f6] shrink-0 animate-[pulse_1.5s_infinite]" title="On course" />
                    )}
                    <div className="flex flex-col gap-[2px] min-w-0">
                        <span className="font-semibold text-text truncate max-sm:text-[0.9rem] max-sm:max-w-[160px]">
                            {boat.clubName}
                            {isMe && (
                                <span className="inline-flex items-center px-[7px] py-[1px] rounded-full bg-brand/15 border border-brand/35 text-brand text-[0.62rem] font-bold tracking-[0.07em] align-middle ml-[7px] font-sans">YOU</span>
                            )}
                            {isMyAthlete && (
                                <span className="inline-flex items-center px-[7px] py-[1px] rounded-full bg-[#10b981]/12 border border-[#10b981]/35 text-[#10b981] text-[0.62rem] font-bold tracking-[0.07em] align-middle ml-[7px] font-sans">ATHLETE</span>
                            )}
                        </span>
                        <span className="text-[0.8rem] text-muted max-sm:text-[0.75rem]">{rowerNames}</span>
                        <span className="text-[0.8rem] text-muted max-sm:text-[0.75rem]">
                            Bow {boat.bowNumber ?? "—"} • {boat.categoryName ?? boat.category ?? "—"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto max-sm:shrink-0 max-sm:ml-auto">
                    {inProgress ? (
                        <span className="text-[0.75rem] font-bold tracking-[0.08em] text-[#3b82f6]">ON COURSE</span>
                    ) : isSpecialStatus ? (
                        <span className="font-mono font-bold text-[1rem] text-[#d9534f] max-sm:text-[0.9rem]">{status}</span>
                    ) : (
                        <span className="font-mono font-bold text-[1rem] text-brand max-sm:text-[0.9rem]">{formatElapsed(adjustedElapsedMs)}</span>
                    )}
                    <span className="text-[0.7rem] text-muted">{open ? "▲" : "▼"}</span>
                </div>
            </div>

            {open && (
                <div className="mt-3 pt-3 border-t border-border grid gap-1 text-[0.85rem] text-muted">
                    <div><strong className="text-text">Status:</strong> {status || "Finished"}</div>
                    <div><strong className="text-text">Club:</strong> {boat.clubName}</div>
                    <div><strong className="text-text">Rowers:</strong> {rowerNames}</div>
                    <div><strong className="text-text">Boat size:</strong> {boat.boatSize}</div>
                    <div><strong className="text-text">Started:</strong> {displayStarted}</div>
                </div>
            )}
        </li>
    );
}
