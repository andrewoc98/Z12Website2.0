import type { Club } from "../../../auth/club";
import "../../styles/platformAdmin.css";
import "../../styles/federationAdmin.css";

type Props = {
    club: Club;
};

export default function ClubOverviewCard({ club }: Props) {
    return (
        <div className={`fa-club-card${club.status === "suspended" ? " fa-club-card--suspended" : ""}`}>

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
                <span className={`pa-status pa-status--${club.status === "pending_approval" ? "pending" : club.status}`}>
                    {club.status === "pending_approval" ? "pending" : club.status}
                </span>
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
