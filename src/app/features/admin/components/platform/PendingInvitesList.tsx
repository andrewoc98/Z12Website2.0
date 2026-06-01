import type { FederationInvite } from "../../types/admin.types";
import "../../styles/platformAdmin.css";

type Props = {
    invites: FederationInvite[];
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IE", {
        day: "numeric", month: "short", year: "numeric",
    });
}

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}

export default function PendingInvitesList({ invites }: Props) {
    if (invites.length === 0) {
        return (
            <div className="pa-empty">
                <div className="pa-empty__icon">✉</div>
                <p className="pa-empty__text">No pending invites. Send one using the button above.</p>
            </div>
        );
    }

    return (
        <div className="stack">
            {invites.map(invite => {
                const expired = isExpired(invite.expiresAt);
                const statusLabel = expired ? "expired" : invite.status;

                return (
                    <div key={invite.id} className="pa-invite-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="pa-invite-row__email">{invite.invitedEmail}</div>
                            <div className="pa-invite-row__meta">
                                {invite.federationName} · Sent {formatDate(invite.createdAt)}
                                {" · "}
                                {expired
                                    ? <span style={{ color: "var(--muted)" }}>Expired {formatDate(invite.expiresAt)}</span>
                                    : <span>Expires {formatDate(invite.expiresAt)}</span>
                                }
                            </div>
                        </div>

                        <div className="pa-invite-row__right">
                            <span className={`pa-status pa-status--${expired ? "suspended" : "pending"}`}>
                                {statusLabel}
                            </span>
                            {/* Revoke available in a future iteration */}
                            <button className="pa-btn" disabled title="Revoke coming soon">
                                Revoke
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
