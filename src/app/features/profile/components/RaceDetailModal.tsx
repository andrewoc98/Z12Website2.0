import { useEffect } from "react";
import type { UserRaceResult } from "../../results/hooks/useUserResults";
import "../style/profile.css";

function fmtMs(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

function splitPer500(ms: number, distanceM: number): string {
    return fmtMs((ms / distanceM) * 500);
}

function ordinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric",
    });
}

interface Props {
    result: UserRaceResult;
    onClose: () => void;
}

export function RaceDetailModal({ result, onClose }: Props) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="rdm-backdrop" onClick={onClose}>
            <div className="rdm-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="rdm-header">
                    <div className="rdm-position">
                        <span className="rdm-place">{ordinal(result.place)}</span>
                        <span className="rdm-of-total">of {result.totalInCategory}</span>
                    </div>
                    <button className="rdm-close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="rdm-event-name">{result.eventName}</div>
                <div className="rdm-meta">
                    <span>{result.categoryName}</span>
                    <span className="rdm-dot">·</span>
                    <span>{fmtDate(result.finishedAt)}</span>
                </div>

                <div className="rdm-stats-grid">
                    <div className="rdm-stat">
                        <span className="rdm-stat-label">Time</span>
                        <span className="rdm-stat-value">{fmtMs(result.time)}</span>
                    </div>
                    <div className="rdm-stat">
                        <span className="rdm-stat-label">Split /500m</span>
                        <span className="rdm-stat-value">{splitPer500(result.time, result.eventLengthMeters)}</span>
                    </div>
                    <div className="rdm-stat">
                        <span className="rdm-stat-label">Distance</span>
                        <span className="rdm-stat-value">{result.eventLengthMeters.toLocaleString()}m</span>
                    </div>
                    <div className="rdm-stat">
                        <span className="rdm-stat-label">Club</span>
                        <span className="rdm-stat-value">{result.clubName}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
