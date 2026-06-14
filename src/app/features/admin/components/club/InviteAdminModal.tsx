import { useState } from "react";
import { appointClubAdmin } from "../../services/clubAdminService";

type Props = {
    clubName:  string;
    onClose:   () => void;
    onInvited: (msg: string) => void;
};

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("already-exists"))   return "A pending invite already exists for that email, or they are already an admin.";
    if (m.includes("permission-denied")) return "You do not have permission to manage admins.";
    return "Something went wrong. Please try again.";
}

export default function InviteAdminModal({ clubName, onClose, onInvited }: Props) {
    const [email,           setEmail]           = useState("");
    const [canManageAdmins, setCanManageAdmins] = useState(false);
    const [busy,            setBusy]            = useState(false);
    const [error,           setError]           = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !email.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const result = await appointClubAdmin({ targetEmail: email.trim(), canManageAdmins });
            const msg = result.isExistingUser
                ? `${email.trim()} has been appointed as an admin of ${clubName}.`
                : `Invite sent to ${email.trim()}. They'll receive an email to sign up and claim the role.`;
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
                    <h3 className="pa-modal__title">Invite Club Admin</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form className="pa-modal__body" onSubmit={onSubmit}>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        Enter an email address. If the person already has a Z12 account they'll be
                        appointed immediately. If not, they'll receive a signup invitation and their
                        admin role will activate once they register.
                    </p>

                    <label>
                        Email address *
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@club.org"
                            required
                            autoFocus
                        />
                    </label>

                    <label style={{ flexDirection: "row", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={canManageAdmins}
                            onChange={e => setCanManageAdmins(e.target.checked)}
                            style={{ width: "auto", margin: 0 }}
                        />
                        <span style={{ fontWeight: 500 }}>Allow this admin to invite and remove other admins</span>
                    </label>

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
                        {busy ? "Appointing…" : "Appoint admin"}
                    </button>
                </div>

            </div>
        </div>
    );
}
