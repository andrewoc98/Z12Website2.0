import type { AthleteSelectionProfile } from "../../types/admin.types";
import "../../styles/platformAdmin.css";
import "../../styles/federationAdmin.css";

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
};

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(seconds?: number): string {
    if (seconds == null) return "—";
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function fmtStat(val?: number, unit?: string): string {
    if (val == null) return "—";
    return unit ? `${val} ${unit}` : String(val);
}

function fmtAge(dob: string): string {
    if (!dob) return "—";
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    return String(age);
}

export default function AthleteSelectionProfile({
    athlete,
    onClose,
    isShortlisted,
    onToggleShortlist,
    highlightDist,
}: Props) {
    const p = athlete.performances;
    const s = athlete.stats;

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

                    {/* Active sort metric hero */}
                    <div className="fa-profile-2k-hero" style={{ marginTop: 16 }}>
                        <div className="fa-profile-2k-hero__time">{fmtTime(p[highlightDist.perfKey])}</div>
                        <div className="fa-profile-2k-hero__label">Best {highlightDist.label}</div>
                    </div>

                    <hr />

                    {/* Biometrics */}
                    <p className="fa-profile-section-title">Biometrics</p>
                    <div className="fa-profile-stat-grid">
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtStat(s.heightCm, "cm")}</div>
                            <div className="fa-profile-stat__label">Height</div>
                        </div>
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtStat(s.wingspanCm, "cm")}</div>
                            <div className="fa-profile-stat__label">Wingspan</div>
                        </div>
                        <div className="fa-profile-stat">
                            <div className="fa-profile-stat__val">{fmtStat(s.weightKg, "kg")}</div>
                            <div className="fa-profile-stat__label">Weight</div>
                        </div>
                    </div>

                    {/* Performances — only distances with recorded times */}
                    <p className="fa-profile-section-title" style={{ marginTop: 4 }}>Performances</p>
                    {performanceRows.length === 0 ? (
                        <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
                            No performances recorded.
                        </p>
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
