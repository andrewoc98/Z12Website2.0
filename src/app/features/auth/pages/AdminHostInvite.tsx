import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { createAdminInvite } from "../api/users";
import { getFunctions, httpsCallable } from "firebase/functions";
import "../../profile/style/profile.css";

export default function HostAdminInvite() {
    const { profile } = useAuth();
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!profile?.roles?.host) return null;

    function isValidEmail(value: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    async function onInvite() {
        const trimmed = email.trim().toLowerCase();

        if (!isValidEmail(trimmed)) {
            setError("Please enter a valid email address.");
            return;
        }

        setError(null);
        setBusy(true);
        setSent(false);

        const uid = profile?.uid;
        if (!uid) {
            setBusy(false);
            return;
        }

        try {
            const inviteId = await createAdminInvite(uid, trimmed);
            const inviteLink = `${window.location.origin}/auth?adminInvite=${inviteId}`;

            const functions = getFunctions();
            const sendAdminInviteEmail = httpsCallable(functions, "sendAdminInviteEmail");
            await sendAdminInviteEmail({ email: trimmed, inviteLink });

            setSent(true);
            setEmail("");
        } catch (err) {
            console.error("Failed to send invite:", err);
            setError("Failed to send invite email. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    const emailValid = isValidEmail(email.trim());

    return (
        <section className="panel">
            <h3>Invite Admin</h3>

            <label>
                Admin email
                <input
                    type="email"
                    value={email}
                    onChange={e => {
                        setEmail(e.target.value);
                        setError(null);
                        setSent(false);
                    }}
                    onKeyDown={e => e.key === "Enter" && onInvite()}
                    placeholder="example@email.com"
                />
            </label>

            {error && <p className="error">{error}</p>}

            {sent && (
                <p className="success">Invite email sent successfully!</p>
            )}

            <button
                className="btn btn--brand"
                onClick={onInvite}
                disabled={busy || !emailValid}
            >
                {busy ? "Sending…" : "Send invite"}
            </button>
        </section>
    );
}