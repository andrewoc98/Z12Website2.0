import { useAuth } from "../../../providers/AuthProvider";
import { formatLength, formatWeight } from "../api/user";

export function AthleteStats({ unit }: { unit: "metric" | "imperial" }) {

    const { profile } = useAuth();
    const stats = profile?.roles?.rower?.stats;

    // Returns formatted value or "-"
    const safeLength = (val?: number) => val != null ? formatLength(val, unit) : "-";
    const safeWeight = (val?: number) => val != null ? formatWeight(val, unit) : "-";

    return (
        <section className="card profile-section stats-section">
            <h3 className="section-title">Athlete Stats</h3>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{safeLength(stats?.heightCm)}</div>
                    <div className="muted">Height</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{safeLength(stats?.wingspanCm)}</div>
                    <div className="muted">Wingspan</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{safeWeight(stats?.weightKg)}</div>
                    <div className="muted">Weight</div>
                </div>
            </div>
        </section>
    );
}
