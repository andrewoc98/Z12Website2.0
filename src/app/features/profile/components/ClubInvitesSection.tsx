import { useState, useEffect } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import {
    getPendingClubInvites,
    respondToClubInvite,
} from "../../admin/services/clubAdminService";
import type { ClubInvite } from "../../admin/types/admin.types";
import "../style/profile.css";

export function ClubInvitesSection() {
    const { user } = useAuth() as { user: { uid: string; email: string | null } | null };
    const [invites,  setInvites]  = useState<ClubInvite[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [busy,     setBusy]     = useState<string | null>(null);
    const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

    useEffect(() => {
        if (!user) return;
        getPendingClubInvites(user.uid, user.email ?? "")
            .then(setInvites)
            .catch(() => {/* silently ignore — section just stays hidden */})
            .finally(() => setLoading(false));
    }, [user]);

    function notify(msg: string, ok: boolean) {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    }

    async function respond(invite: ClubInvite, action: "accept" | "decline") {
        setBusy(invite.id);
        try {
            await respondToClubInvite({ inviteId: invite.id, action });
            setInvites(prev => prev.filter(i => i.id !== invite.id));
            notify(
                action === "accept"
                    ? `You've joined ${invite.clubName} as a ${invite.memberRole}.`
                    : `Declined invitation from ${invite.clubName}.`,
                action === "accept"
            );
        } catch {
            notify("Something went wrong. Please try again.", false);
        } finally {
            setBusy(null);
        }
    }

    if (loading || invites.length === 0) return null;

    return (
        <section className="card profile-section ci-section">
            <div className="ci-header">
                <h3 className="ci-title">Club Invitations</h3>
                <span className="ci-badge">{invites.length}</span>
            </div>

            <div className="ci-list">
                {invites.map(invite => (
                    <div key={invite.id} className="ci-row">
                        <div className="ci-row__icon">
                            {invite.clubName.charAt(0).toUpperCase()}
                        </div>
                        <div className="ci-row__body">
                            <p className="ci-row__club">{invite.clubName}</p>
                            <p className="ci-row__meta">
                                Invited as <strong>{invite.memberRole}</strong> by {invite.invitedByName}
                            </p>
                        </div>
                        <div className="ci-row__actions">
                            <button
                                className="ci-btn ci-btn--decline"
                                onClick={() => respond(invite, "decline")}
                                disabled={!!busy}
                                aria-label={`Decline invitation from ${invite.clubName}`}
                            >
                                {busy === invite.id ? "…" : "Decline"}
                            </button>
                            <button
                                className="ci-btn ci-btn--accept"
                                onClick={() => respond(invite, "accept")}
                                disabled={!!busy}
                                aria-label={`Accept invitation from ${invite.clubName}`}
                            >
                                {busy === invite.id ? "…" : "Accept"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {toast && (
                <div className={`ci-toast ${toast.ok ? "ci-toast--ok" : "ci-toast--err"}`}>
                    {toast.msg}
                </div>
            )}
        </section>
    );
}
