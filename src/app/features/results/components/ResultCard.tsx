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
}

export default function ResultCard({ boat, rank, inProgress, profiles }: ResultCardProps) {
    const [open, setOpen] = useState(false);

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

    return (
        <li className={`result-card ${inProgress ? "result-card--in-progress" : ""}`} onClick={() => setOpen(!open)}>
            <div className="result-card-main">
                <div className="result-card-left">
                    {!inProgress && rank && (
                        <span className="result-rank">#{rank}</span>
                    )}
                    {inProgress && (
                        <span className="result-on-course-dot" title="On course" />
                    )}
                    <div className="result-card-info">
                        <span className="result-card-name">{boat.clubName}</span>
                        <span className="result-card-sub">{rowerNames}</span>
                        <span className="result-card-sub">
                            Bow {boat.bowNumber ?? "—"} • {boat.categoryName ?? boat.category ?? "—"}
                        </span>
                    </div>
                </div>
                <div className="result-card-right">
                    {inProgress ? (
                        <span className="result-on-course-label">ON COURSE</span>
                    ) : (
                        <span className="result-time">{formatElapsed(adjustedElapsedMs)}</span>
                    )}
                    <span className="result-chevron">{open ? "▲" : "▼"}</span>
                </div>
            </div>

            {open && (
                <div className="result-card-details">
                    <div><strong>Club:</strong> {boat.clubName}</div>
                    <div><strong>Rowers:</strong> {rowerNames}</div>
                    <div><strong>Boat size:</strong> {boat.boatSize}</div>
                    <div><strong>Started:</strong> {displayStarted}</div>
                </div>
            )}
        </li>
    );
}