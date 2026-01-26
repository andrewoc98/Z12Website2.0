import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { createAdminInvite } from "../api/users";

export default function HostAdminInvite() {
    const { profile } = useAuth();
    const [email, setEmail] = useState("");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    if (!profile?.roles?.host) return null;

    async function onInvite() {
        setBusy(true);
        setInviteLink(null);

        try {
            const inviteId = await createAdminInvite(
                profile.uid,
                email.trim().toLowerCase()
            );

            setInviteLink(
                `${window.location.origin}/auth?adminInvite=${inviteId}`
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="panel">
            <h3>Invite Admin</h3>

            <label>
                Admin email
                <input value={email} onChange={e => setEmail(e.target.value)} />
            </label>

            <button className="btn btn--brand" onClick={onInvite} disabled={busy}>
                Generate invite link
            </button>

            {inviteLink && (
                <div className="panel panel--soft">
                    <p className="muted">Share this link:</p>
                    <code>{inviteLink}</code>
                </div>
            )}
        </section>
    );
}
