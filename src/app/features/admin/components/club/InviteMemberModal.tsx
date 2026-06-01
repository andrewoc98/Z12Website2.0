import { useState } from "react";
import { inviteClubMember } from "../../services/clubAdminService";
import "../../styles/platformAdmin.css";

type Props = {
    onClose:   () => void;
    onInvited: (msg: string) => void;
};

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("already-exists") || m.includes("already a member"))
        return "That user is already an active member of this club.";
    if (m.includes("already-exists") || m.includes("pending invite"))
        return "A pending invite already exists for this email.";
    if (m.includes("not active"))
        return "This club is not currently accepting members.";
    return "Something went wrong. Please try again.";
}

export default function InviteMemberModal({ onClose, onInvited }: Props) {
    const [email,      setEmail]      = useState("");
    const [memberRole, setMemberRole] = useState<"rower" | "coach">("rower");
    const [busy,       setBusy]       = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !email.trim()) return;

        setBusy(true);
        setError(null);

        try {
            const result = await inviteClubMember({ targetEmail: email.trim(), memberRole });
            const msg = result.isExistingUser
                ? `Invite sent to ${email.trim()}. They'll be notified to accept.`
                : `Invite sent to ${email.trim()}. They'll receive a signup email.`;
            onInvited(msg);
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div className="pa-modal" onClick={e => e.stopPropagation()}>

                <div className="pa-modal__header">
                    <h3 className="pa-modal__title">Invite Member</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form className="pa-modal__body" onSubmit={onSubmit}>

                    <label>
                        Email address *
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="athlete@email.com"
                            required
                            autoFocus
                        />
                    </label>

                    <label>
                        Role *
                        <select
                            value={memberRole}
                            onChange={e => setMemberRole(e.target.value as "rower" | "coach")}
                        >
                            <option value="rower">Rower</option>
                            <option value="coach">Coach</option>
                        </select>
                    </label>

                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        If the email belongs to a Z12 Challenge account, they'll receive a
                        notification to accept or decline. Otherwise, they'll get a signup
                        invitation by email.
                    </p>

                    {error && <div className="pa-error">{error}</div>}

                </form>

                <div className="pa-modal__footer">
                    <button className="pa-btn pa-btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        className="pa-btn pa-btn--primary"
                        onClick={onSubmit as any}
                        disabled={busy || !email.trim()}
                    >
                        {busy ? "Sending…" : "Send invite"}
                    </button>
                </div>

            </div>
        </div>
    );
}
