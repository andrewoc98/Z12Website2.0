import { useAuth } from "../../../providers/AuthProvider";
import { formatErgTime } from "../../events/api/ergScores";
import type { ErgBestKey } from "../../auth/types";

const DISTANCE_LABELS: Record<ErgBestKey, string> = {
    best100m: "100m",
    best500m: "500m",
    best1000m: "1,000m",
    best2000m: "2,000m",
    best6000m: "6,000m",
};

/**
 * The distances an indoor event can be run over — ERG_DISTANCES on the backend.
 * 10,000m is deliberately absent: no event is held over it, so no verified time
 * could ever appear there.
 */
const DISTANCES: ErgBestKey[] = ["best100m", "best500m", "best1000m", "best2000m", "best6000m"];

export function PerformanceStats() {
    const { profile } = useAuth();

    // Verified event times only — the self-reported roles.rower.performances
    // are still edited in the profile editor, but they are not shown here.
    const bests = profile?.roles?.rower?.ergBests;
    const hasAny = DISTANCES.some((key) => bests?.[key] != null);

    return (
        <section className="card profile-section stats-section" data-tour="profile-performances">
            <h3 className="section-title">Best Erg Scores</h3>
            <p className="wr-category-label muted">
                Your fastest verified time at each distance, from the indoor events you have entered.
            </p>
            <div className="stats-grid">
                {DISTANCES.map((key) => {
                    const best = bests?.[key];
                    return (
                        <div key={key} className="stat-card">
                            <div className="stat-value">
                                {best != null ? formatErgTime(best.timeMs) : "-"}
                            </div>
                            <div className="muted">{DISTANCE_LABELS[key]}</div>
                        </div>
                    );
                })}
            </div>
            {!hasAny && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
                    Connect your Concept2 Logbook and enter an indoor virtual event — your times
                    appear here once they are ranked.
                </p>
            )}
        </section>
    );
}
