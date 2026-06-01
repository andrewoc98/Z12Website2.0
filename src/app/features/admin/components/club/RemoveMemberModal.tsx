import { useState } from "react";
import type { ClubMembership } from "../../../auth/club";
import { adminRemoveMember } from "../../services/clubAdminService";
import "../../styles/platformAdmin.css";

type Props = {
    member:   ClubMembership;
    onClose:  () => void;
    onRemoved: (msg: string) => void;
};

export default function RemoveMemberModal({ member, onClose, onRemoved }: Props) {
    const [reason, setReason] = useState("");
    const [busy,   setBusy]   = useState(false);
    const [error,  setError]  = useState<string | null>(null);

    async function onConfirm(e: React.FormEvent) {
        e.preventDefault();
        if (!reason.trim()) return;

        setBusy(true);
        setError(null);

        try {
            await adminRemoveMember({
                targetUid:  member.uid,
                memberRole: member.role as "rower" | "coach",
                reason:     reason.trim(),
            });
            onRemoved(`${member.displayName} has been removed.`);
        } catch (err: any) {
            setError(err?.message ?? "Failed to remove member.");
            setBusy(false);
        }
    }

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div className="pa-modal" onClick={e => e.stopPropagation()}>

                <div className="pa-modal__header">
                    <h3 className="pa-modal__title">Remove Member</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form className="pa-modal__body" onSubmit={onConfirm}>
                    <p style={{ margin: 0, color: "var(--text)" }}>
                        You are about to remove{" "}
                        <strong>{member.displayName}</strong>{" "}
                        ({member.role}) from the club.
                    </p>
                    <p className="muted" style={{ fontSize: 13 }}>
                        This action is logged for audit purposes. The member will lose their club
                        affiliation but retain their platform account.
                    </p>

                    <label style={{ marginTop: 0 }}>
                        Reason *
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Provide a reason for removal (required)"
                            style={{ minHeight: 80, resize: "vertical" }}
                            required
                            autoFocus
                        />
                    </label>

                    {error && <div className="pa-error">{error}</div>}
                </form>

                <div className="pa-modal__footer">
                    <button className="pa-btn pa-btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        className="pa-btn"
                        style={{ color: "var(--danger)", borderColor: "rgba(255,77,109,0.3)" }}
                        onClick={onConfirm as any}
                        disabled={busy || !reason.trim()}
                    >
                        {busy ? "Removing…" : "Remove member"}
                    </button>
                </div>

            </div>
        </div>
    );
}
