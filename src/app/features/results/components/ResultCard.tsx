import { useState, useMemo } from "react";

export interface Boat {
    id: string;
    clubName: string;
    boatSize: number;
    bowNumber?: number;
    categoryName?: string;
    category?: string;
    elapsedMs: number;
    startedAt: string | number | Date;
    finishedAt: string | number | Date;
    adjustmentMs?: number;
    rowerUids: string[];
}

interface ResultCardProps {
    boat: Boat;
    rank: number;
    rowerMap: Map<string, string>;
}

export default function ResultCard({ boat, rank, rowerMap }: ResultCardProps) {
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

    const crewNames = useMemo(() => {
        const names = (boat.rowerUids ?? []).map(uid => rowerMap.get(uid) ?? "Unknown");
        if (names.length === 0) return "—";
        if (names.length === 1) return names[0];
        const last = names[names.length - 1];
        return `${names.slice(0, -1).join(", ")} & ${last}`;
    }, [boat.rowerUids, rowerMap]);

    const displayStarted = new Date(boat.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <li className="card result-card" onClick={() => setOpen(!open)}>
            <div className="card-header">
                <b>#{rank} {crewNames}</b>
                <span className="card-time">{formatElapsed(adjustedElapsedMs)}</span>
            </div>
            <div className="card-subinfo">
                {boat.clubName} • Bow {boat.bowNumber ?? "—"} • {boat.categoryName ?? boat.category ?? "—"}
            </div>
            {open && (
                <div className="card-details">
                    <div><strong>Club:</strong> {boat.clubName}</div>
                    <div><strong>Crew:</strong> {crewNames}</div>
                    <div><strong>Boat size:</strong> {boat.boatSize}</div>
                    <div><strong>Started:</strong> {displayStarted}</div>
                </div>
            )}
        </li>
    );
}