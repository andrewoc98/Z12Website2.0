import type { Federation } from "../../../auth/club";
import "../../styles/platformAdmin.css";

type Props = {
    federations:     Federation[];
    loading:         boolean;
    onInviteClick:   (fed: Federation) => void;
};

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function SkeletonRows() {
    return (
        <div className="stack">
            {[1, 2, 3].map(i => (
                <div key={i} className="pa-skeleton-row" />
            ))}
        </div>
    );
}

export default function FederationTable({ federations, loading, onInviteClick }: Props) {
    if (loading) return <SkeletonRows />;

    if (federations.length === 0) {
        return (
            <div className="pa-empty">
                <div className="pa-empty__icon">🌐</div>
                <p className="pa-empty__text">
                    No federations yet. Create one to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="stack">
            {federations.map(fed => (
                <div key={fed.id} className="pa-fed-row">
                    <div className="pa-fed-row__avatar">
                        {initials(fed.shortName ?? fed.name)}
                    </div>

                    <div className="pa-fed-row__body">
                        <div className="pa-fed-row__name">{fed.name}</div>
                        <div className="pa-fed-row__meta">
                            <span>{fed.country}</span>
                            <span>·</span>
                            <span>{fed.adminUids.length} admin{fed.adminUids.length !== 1 ? "s" : ""}</span>
                            {fed.contactEmail && (
                                <>
                                    <span>·</span>
                                    <span>{fed.contactEmail}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="pa-fed-row__actions">
                        <span className={`pa-status pa-status--${fed.status}`}>
                            {fed.status}
                        </span>
                        <button
                            className="pa-btn"
                            onClick={() => onInviteClick(fed)}
                            title="Invite a federation admin"
                        >
                            + Invite admin
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
