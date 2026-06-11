import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { formatTime } from "../api/user";
import { WORLD_RECORDS, LIGHTWEIGHT_THRESHOLD_KG, type DistanceKey } from "../data/worldRecords";
import type { UserProfile } from "../../auth/types";

function calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const dob = new Date(dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function resolveCategory(profile: UserProfile): string {
    const gender = profile.gender === "female" ? "female" : "male";
    const weightKg = profile.roles?.rower?.stats?.weightKg;

    // Junior check: stored ageGroup takes priority, otherwise derive from dateOfBirth
    const isJunior =
        profile.ageGroup === "junior" ||
        profile.ageGroup === "u19" ||
        (!profile.ageGroup && !!profile.dateOfBirth && calculateAge(profile.dateOfBirth) < 19);

    if (isJunior) return `${gender}_junior`;

    // Lightweight applies to all non-junior athletes
    if (weightKg != null && weightKg < LIGHTWEIGHT_THRESHOLD_KG[gender]) {
        return `${gender}_lightweight`;
    }

    return `${gender}_senior`;
}

function getWrPercentage(userSeconds: number, wrSeconds: number): string {
    return ((wrSeconds / userSeconds) * 100).toFixed(1);
}

const DISTANCE_LABELS: Record<DistanceKey, string> = {
    best100m: "100m",
    best500m: "500m",
    best2000m: "2,000m",
    best6000m: "6,000m",
    best10000m: "10,000m",
};

export function PerformanceStats() {
    const { profile } = useAuth();
    const [hoveredKey, setHoveredKey] = useState<DistanceKey | null>(null);

    const perf = profile?.roles?.rower?.performances;
    const safeTime = (val?: number) => (val != null ? formatTime(val) : "-");

    const categoryKey = profile ? resolveCategory(profile) : null;
    const categoryEntry = categoryKey ? (WORLD_RECORDS[categoryKey] ?? WORLD_RECORDS[`${categoryKey.split("_")[0]}_senior`]) : null;

    const distances: DistanceKey[] = ["best100m", "best500m", "best2000m", "best6000m", "best10000m"];

    return (
        <section className="card profile-section stats-section" data-tour="profile-performances">
            <h3 className="section-title">Best Erg Scores</h3>
            {categoryEntry && (
                <p className="wr-category-label muted">
                    Comparing to {categoryEntry.label} world records
                </p>
            )}
            <div className="stats-grid">
                {distances.map((key) => {
                    const userVal = perf?.[key];
                    const wrVal = categoryEntry?.records[key];
                    const isHovered = hoveredKey === key;
                    const pct = userVal != null && wrVal != null ? getWrPercentage(userVal, wrVal) : null;

                    return (
                        <div
                            key={key}
                            className="stat-card stat-card--wr"
                            onMouseEnter={() => setHoveredKey(key)}
                            onMouseLeave={() => setHoveredKey(null)}
                        >
                            <div className="stat-value">{safeTime(userVal)}</div>
                            <div className="muted">{DISTANCE_LABELS[key]}</div>
                            {isHovered && categoryEntry && (
                                <div className="wr-tooltip">
                                    {pct != null ? (
                                        <>
                                            <span className="wr-tooltip__pct">{pct}%</span>
                                            <span className="wr-tooltip__label"> of WR</span>
                                            <div className="wr-tooltip__wr">
                                                WR: {wrVal != null ? formatTime(wrVal) : "—"}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="wr-tooltip__label">No score recorded</span>
                                    )}
                                    <div className="wr-tooltip__cat">{categoryEntry.label}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
