import { useState } from "react";
import { inviteFederationAdmin } from "../../services/federationService";
import type { Federation } from "../../../auth/club";
import "../../styles/platformAdmin.css";

type Props = {
    federations: Federation[];
    onClose:     () => void;
    onInvited:   () => void;
};

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("already-exists") || m.includes("pending invite"))
        return "A pending invite already exists for this email and federation.";
    if (m.includes("not-found")) return "Federation not found.";
    if (m.includes("email"))     return "Please enter a valid email address.";
    return "Something went wrong. Please try again.";
}

export default function InviteFederationAdminModal({ federations, onClose, onInvited }: Props) {
    const [email,        setEmail]        = useState("");
    const [federationId, setFederationId] = useState(federations[0]?.id ?? "");
    const [busy,         setBusy]         = useState(false);
    const [error,        setError]        = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !federationId) return;

        setBusy(true);
        setError(null);

        try {
            await inviteFederationAdmin({ email: email.trim(), federationId });
            onInvited();
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div className="pa-modal" onClick={e => e.stopPropagation()}>

                <div className="pa-modal__header">
                    <h3 className="pa-modal__title">Invite Federation Admin</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form className="pa-modal__body" onSubmit={onSubmit}>

                    <label>
                        Federation *
                        <select
                            value={federationId}
                            onChange={e => setFederationId(e.target.value)}
                            required
                        >
                            {federations.length === 0 && (
                                <option value="" disabled>No federations yet</option>
                            )}
                            {federations.map(fed => (
                                <option key={fed.id} value={fed.id}>
                                    {fed.name} ({fed.country})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Invite email *
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@federation.org"
                            required
                            autoFocus
                        />
                    </label>

                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        The invitee will receive an email with a link valid for 72 hours.
                        They must sign in with this email address to accept.
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
                        disabled={busy || federations.length === 0}
                    >
                        {busy ? "Sending…" : "Send invite"}
                    </button>
                </div>

            </div>
        </div>
    );
}
