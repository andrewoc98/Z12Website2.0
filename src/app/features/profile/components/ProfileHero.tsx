import type { UserProfile } from "../../auth/types.ts";
import "../style/profile.css";

export function ProfileHero({
                                profile,
                                unit,
                                toggleUnit,
                            }: {
    profile: UserProfile;
    unit: "metric" | "imperial";
    toggleUnit: () => void;
}) {
    const roles = profile.roles ?? {};

    const roleLabels = [
        roles.rower && "Rower",
        roles.coach && "Coach",
        roles.host  && "Host",
        roles.admin && "Admin",
    ].filter(Boolean) as string[];

    const subtitle = roleLabels.join(" · ") || "Member";

    return (
        <section className="profile-hero card">
            <div className="profile-avatar">
                {(profile.displayName || profile.fullName)?.charAt(0) ?? "?"}
            </div>
            <div>
                <h2>{profile.displayName || profile.fullName}</h2>
                <p className="muted">{subtitle}</p>

                {roles.rower?.club && (
                    <p className="muted">Club: {roles.rower.club}</p>
                )}

                {roleLabels.length > 0 && (
                    <div className="chips">
                        {roleLabels.map(r => (
                            <span key={r} className="chip">{r}</span>
                        ))}
                    </div>
                )}

                {roles.rower && (
                    <button className="btn-toggle" onClick={toggleUnit}>
                        Switch to {unit === "metric" ? "Imperial" : "Metric"}
                    </button>
                )}
            </div>
        </section>
    );
}