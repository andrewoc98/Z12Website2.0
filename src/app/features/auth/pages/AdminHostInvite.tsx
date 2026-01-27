import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { createAdminInvite } from "../api/users";

export default function HostAdminInvite() {
    const { profile } = useAuth();
    const [email, setEmail] = useState("");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!profile?.roles?.host) return null;

    async function onInvite() {
        setBusy(true);
        setInviteLink(null);
        setCopied(false);

        try {
            const inviteId = await createAdminInvite(
                profile.uid,
                email.trim().toLowerCase()
            );

            const link = `${window.location.origin}/auth?adminInvite=${inviteId}`;
            setInviteLink(link);
        } finally {
            setBusy(false);
        }
    }

    async function copyLink() {
        if (!inviteLink) return;
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // reset after 2s
        } catch (err) {
            console.error("Failed to copy:", err);
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
                {busy ? "Generating…" : "Generate invite link"}
            </button>

            {inviteLink && (
                <div className="panel panel--soft mt-2">
                    <p className="muted">Share this link:</p>
                    <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                        <code style={{ flex: 1, overflowX: "auto" }}>{inviteLink}</code>
                        <button className="btn btn--ghost" onClick={copyLink}>
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
