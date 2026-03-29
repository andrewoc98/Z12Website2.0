import { useState, useMemo } from "react";

export interface Boat {
    id:string;
    clubName: string;
    boatSize: number;
    bowNumber?: number;
    categoryName?: string;
    category?: string;
    elapsedMs: number;
    startedAt: string | number | Date;
    finishedAt: string | number | Date;
    adjustmentMs?: number;
}

interface ResultCardProps {
    boat: Boat;
    rank: number;
}

export default function ResultCard({ boat, rank }: ResultCardProps) {
    const [open, setOpen] = useState(false);

    const adjustedElapsedMs = useMemo(() => {
        return boat.elapsedMs + ((boat.adjustmentMs ?? 0) * 1000);
    }, [boat.elapsedMs, boat.adjustmentMs]);

    const formatElapsed = (ms: number) => {

        let totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);
        return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
    };

    const displayName = boat.boatSize === 1 ? `${boat.clubName} Single` : boat.clubName;
    const displayStarted = new Date(boat.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <li className="card result-card" onClick={() => setOpen(!open)}>
            <div className="card-header">
                <b>#{rank} {displayName}</b>
                <span className="card-time">{formatElapsed(adjustedElapsedMs)}</span>
            </div>
            <div className="card-subinfo">
                Bow {boat.bowNumber ?? "—"} • {boat.categoryName ?? boat.category ?? "—"}
            </div>
            {open && (
                <div className="card-details">
                    <div><strong>Club:</strong> {boat.clubName}</div>
                    <div><strong>Boat size:</strong> {boat.boatSize}</div>
                    <div><strong>Started:</strong> {displayStarted}</div>
                </div>
            )}
        </li>
    );
}