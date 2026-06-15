import type { Club } from "../../../auth/club";

type Props = {
    club:    Club;
    onClick?: () => void;
};

export default function ClubOverviewCard({ club, onClick }: Props) {
    return (
        <div
            className={`fa-club-card${club.status === "suspended" ? " fa-club-card--suspended" : ""}${onClick ? " fa-club-card--clickable" : ""}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
        >

            <div className="fa-club-card__header">
                <div>
                    <div className="fa-club-card__name">{club.name}</div>
                    {club.location?.city && (
                        <div className="fa-club-card__location">
                            {club.location.city}
                            {club.location.country ? `, ${club.location.country}` : ""}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {club.hidden && (
                        <span className="pa-status" style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted)", border: "1px solid rgba(255,255,255,0.12)" }}>
                            hidden
                        </span>
                    )}
                    <span className={`pa-status pa-status--${club.status === "pending_approval" ? "pending" : club.status}`}>
                        {club.status === "pending_approval" ? "pending" : club.status}
                    </span>
                </div>
            </div>

            <div className="fa-club-card__counts">
                <div className="fa-club-card__count">
                    <div className="fa-club-card__count-val">{club.rowerCount}</div>
                    <div className="fa-club-card__count-label">Rowers</div>
                </div>
                <div className="fa-club-card__count">
                    <div className="fa-club-card__count-val">{club.coachCount}</div>
                    <div className="fa-club-card__count-label">Coaches</div>
                </div>
                <div className="fa-club-card__count">
                    <div className="fa-club-card__count-val">{club.adminUids.length}</div>
                    <div className="fa-club-card__count-label">Admins</div>
                </div>
            </div>

            {club.contactEmail && (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {club.contactEmail}
                </div>
            )}

        </div>
    );
}
