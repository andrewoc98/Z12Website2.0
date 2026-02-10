import { useAuth } from "../../../providers/AuthProvider";
import { formatTime } from "../api/user";

export function PerformanceStats() {

    const { profile } = useAuth();
    const perf = profile?.roles?.rower?.performances;

    const safeTime = (val?: number) => val != null ? formatTime(val) : "-";

    return (
        <section className="card profile-section stats-section">
            <h3 className="section-title">Best Performances</h3>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{safeTime(perf?.best100m)}</div>
                    <div className="muted">100m</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{safeTime(perf?.best500m)}</div>
                    <div className="muted">500m</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{safeTime(perf?.best2000m)}</div>
                    <div className="muted">2000m</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{safeTime(perf?.best6000m)}</div>
                    <div className="muted">6000m</div>
                </div>
            </div>
        </section>
    );
}
