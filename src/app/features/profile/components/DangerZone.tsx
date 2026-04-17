import "../style/profile.css"
import {useState} from "react";
import {deleteUserAccount} from "../api/user.ts";
import type {User} from "firebase/auth";

type DangerZoneProps = {
    user: User | null;
};

export default function DangerZone({ user }: DangerZoneProps) {
    const [deleting, setDeleting] = useState(false);

    async function handleDeleteAccount() {
        if (!user) return;
        const confirmed = confirm(
            "Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone."
        );
        if (!confirmed) return;

        const doubleConfirmed = confirm("This is your last chance — delete account permanently?");
        if (!doubleConfirmed) return;

        setDeleting(true);
        try {
            await deleteUserAccount(user.uid);
            // Auth listener in AuthProvider will fire automatically,
            // setting user to null and redirecting to /auth
        } catch (e: any) {
            if (e.code === "auth/requires-recent-login") {
                alert("For security, please sign out and sign back in before deleting your account.");
            } else {
                alert(e.message ?? "Failed to delete account.");
            }
            setDeleting(false);
        }
    }

    return(
        <section className="card profile-section danger-zone">
            <h3 className="section-title">Danger zone</h3>
            <p className="muted">
                Permanently delete your account and all associated data.
                This action cannot be undone.
            </p>
            <button
                type="button"
                className="btn btn--danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
            >
                {deleting ? "Deleting…" : "Delete account"}
            </button>
        </section>
    )

}