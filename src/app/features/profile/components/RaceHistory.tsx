import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { useUserResults, type UserRaceResult } from "../../results/hooks/useUserResults";
import { RaceDetailModal } from "./RaceDetailModal";

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

export function RaceHistory() {
    const { user } = useAuth();
    const { results, loading } = useUserResults(user?.uid ?? "");
    const [selected, setSelected] = useState<UserRaceResult | null>(null);

    if (loading) return (
        <section className="card profile-section">
            <h3 className="section-title">Recent Races</h3>
            <p className="muted">Loading…</p>
        </section>
    );

    if (!results.length) return null;

    return (
        <>
            <section className="card profile-section" data-tour="profile-race-history">
                <h3 className="section-title">Recent Races</h3>
                <div className="race-history-grid">
                    {results.slice(0, 5).map((r) => (
                        <div
                            key={r.id}
                            className="race-history-card"
                            onClick={() => setSelected(r)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === "Enter" && setSelected(r)}
                        >
                            <div className="rhc-position">
                                <span className="rhc-place">{ordinal(r.place)}</span>
                                <span className="rhc-total">of {r.totalInCategory}</span>
                            </div>
                            <div className="rhc-event">{r.eventName}</div>
                            <div className="rhc-category muted">{r.categoryName}</div>
                            <div className="rhc-stats">
                                <div className="rhc-stat">
                                    <span className="rhc-stat-value">{fmtMs(r.time)}</span>
                                    <span className="rhc-stat-label muted">time</span>
                                </div>
                                <div className="rhc-stat">
                                    <span className="rhc-stat-value">{splitPer500(r.time, r.eventLengthMeters)}</span>
                                    <span className="rhc-stat-label muted">/500m</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {selected && (
                <RaceDetailModal result={selected} onClose={() => setSelected(null)} />
            )}
        </>
    );
}
