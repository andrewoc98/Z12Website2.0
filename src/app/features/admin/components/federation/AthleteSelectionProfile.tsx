import type { AthleteSelectionProfile } from "../../types/admin.types";
import { useUserResults, type UserRaceResult } from "../../../results/hooks/useUserResults";
import { formatLength, formatWingspan, formatWeight } from "../../../profile/api/user";

type HighlightDist = {
    label: string;
    perfKey: keyof AthleteSelectionProfile["performances"];
};

type Props = {
    athlete: AthleteSelectionProfile;
    onClose: () => void;
    isShortlisted: boolean;
    onToggleShortlist: () => void;
    highlightDist: HighlightDist;
    unit: "metric" | "imperial";
};

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(seconds?: number): string {
    if (seconds == null) return "—";
    if (seconds < 60) return seconds.toFixed(1);
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${m}:${s}`;
}


function fmtAge(dob: string): string {
    if (!dob) return "—";
    return String(new Date().getFullYear() - new Date(dob).getFullYear());
}

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
    return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function placeColor(place: number): string {
    if (place === 1) return "var(--brand)";
    if (place === 2) return "#b0b0b0";
    if (place === 3) return "#cd7f32";
    return "var(--muted)";
}

function MiniRaceList({ uid }: { uid: string }) {
    const { results, loading } = useUserResults(uid);

    if (loading) {
        return (
            <div className="fa-race-list">
                {[1, 2, 3].map(i => (
                    <div key={i} className="pa-skeleton-row" style={{ height: 38, borderRadius: 8 }} />
                ))}
            </div>
        );
    }

    if (!results.length) {
        return <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>No race results on record.</p>;
    }

    return (
        <div className="fa-race-list">
            {results.slice(0, 5).map((r: UserRaceResult) => (
                <div key={r.id} className="fa-race-row">
                    <span className="fa-race-place" style={{ color: placeColor(r.place) }}>
                        {ordinal(r.place)}
                        <span className="fa-race-of-total"> /{r.totalInCategory}</span>
                    </span>
                    <div className="fa-race-event">
                        <span className="fa-race-event-name">{r.eventName}</span>
                        <span className="fa-race-meta">{r.categoryName} · {fmtDate(r.finishedAt)}</span>
                    </div>
                    <div className="fa-race-times">
                        <span className="fa-race-time">{fmtMs(r.time)}</span>
                        <span className="fa-race-split">{splitPer500(r.time, r.eventLengthMeters)}/500m</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function AthleteSelectionProfileModal({
    athlete,
    onClose,
    isShortlisted,
    onToggleShortlist,
    highlightDist,
    unit,
}: Props) {
    const p = athlete.performances;
    const s = athlete.stats;

    const fmtHeight   = (val?: number) => val != null ? formatLength(val, unit)   : "—";
    const fmtWingspan = (val?: number) => val != null ? formatWingspan(val, unit)  : "—";
    const fmtWeight   = (val?: number) => val != null ? formatWeight(val, unit)    : "—";

    const performanceRows: [string, number | undefined][] = (
        [
            ["100m",   p.best100m],
            ["500m",   p.best500m],
            ["2000m",  p.best2000m],
            ["6000m",  p.best6000m],
            ["10000m", p.best10000m],
        ] as [string, number | undefined][]
    ).filter(([, val]) => val != null);

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div
                className="pa-modal"
                style={{ width: "min(560px, 100%)" }}
                onClick={e => e.stopPropagation()}
            >
                <div className="pa-modal__header">
                    <h3 className="pa-modal__title">Athlete Profile</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="pa-modal__body">

                    {/* Identity */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="fa-athlete-card__avatar" style={{ width: 56, height: 56, fontSize: "1.3rem" }}>
                            {initials(athlete.displayName)}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
                                {athlete.displayName}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 2 }}>
                                {athlete.clubName} · {athlete.gender} · {athlete.ageGroup}
                            </div>
                            {athlete.dateOfBirth && (
                                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                                    DOB: {athlete.dateOfBirth} (age {fmtAge(athlete.dateOfBirth)})
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Highlighted distance hero */}
                    <div className="fa-profile-2k-hero" style={{ marginTop: 16 }}>
                        <div className="fa-profile-2k-hero__time">{fmtTime(p[highlightDist.perfKey])}</div>
                        <div className="fa-profile-2k-hero__label">Best {highlightDist.label}</div>
                    </div>

                    <hr />

                    {/* Biometrics */}
                    <p className="fa-profile-section-title">Biometrics</p>
                    <div className="fa-profile-stat-grid">
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtHeight(s.heightCm)}</div>
                            <div className="fa-profile-stat__label">Height</div>
                        </div>
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtWingspan(s.wingspanCm)}</div>
                            <div className="fa-profile-stat__label">Wingspan</div>
                        </div>
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtWeight(s.weightKg)}</div>
                            <div className="fa-profile-stat__label">Weight</div>
                        </div>
                    </div>

                    {/* Erg performances */}
                    <p className="fa-profile-section-title" style={{ marginTop: 4 }}>Performances</p>
                    {performanceRows.length === 0 ? (
                        <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>No performances recorded.</p>
                    ) : (
                        <div
                            className="fa-profile-stat-grid"
                            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
                        >
                            {performanceRows.map(([label, val]) => (
                                <div
                                    key={label}
                                    className={`fa-profile-stat${label === highlightDist.label ? " fa-profile-stat--highlight" : ""}`}
                                >
                                    <div className="fa-profile-stat__val">{fmtTime(val)}</div>
                                    <div className="fa-profile-stat__label">{label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <hr />

                    {/* Mini race history */}
                    <p className="fa-profile-section-title">Recent Races</p>
                    <MiniRaceList uid={athlete.uid} />

                </div>

                <div className="pa-modal__footer">
                    <button
                        className="pa-btn"
                        style={isShortlisted ? {
                            background:  "rgba(255,212,0,0.15)",
                            color:       "var(--brand)",
                            borderColor: "rgba(255,212,0,0.35)",
                        } : {}}
                        onClick={onToggleShortlist}
                    >
                        {isShortlisted ? "★ Shortlisted" : "☆ Add to Shortlist"}
                    </button>
                    <button className="pa-btn pa-btn--ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
