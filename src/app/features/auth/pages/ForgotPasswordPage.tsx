import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { resetPassword } from "../api/auth";

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();

    if (m.includes("auth/user-not-found"))
        return "No account found for that email.";

    if (m.includes("auth/invalid-email"))
        return "Please enter a valid email address.";

    return message || "Something went wrong.";
}

export default function ForgotPasswordPage() {

    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit() {

        if (!email.trim()) {
            setErr("Enter your email.");
            return;
        }

        setBusy(true);
        setErr(null);

        try {
            await resetPassword(email.trim());
            setSent(true);
        } catch (e: any) {
            setErr(friendlyError(e?.message));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />

            <main>
                <div className="card auth-card">

                    <h1 className="auth-title">
                        Reset your password
                    </h1>

                    <p className="auth-subtitle">
                        Enter your email and we'll send you a reset link.
                    </p>

                    <hr />

                    {!sent && (
                        <>
                            <label>
                                Email
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@email.com"
                                    autoComplete="email"
                                />
                            </label>

                            {err && (
                                <div className="card card--tight auth-error">
                                    <div className="auth-error-title">Oops</div>
                                    <div className="muted">{err}</div>
                                </div>
                            )}

                            <div className="row auth-footer-actions">
                                <button
                                    className="btn-primary"
                                    onClick={onSubmit}
                                    disabled={busy}
                                >
                                    {busy ? "Sending…" : "Send reset link"}
                                </button>

                                <Link to="/auth" className="btn-ghost">
                                    Back to sign in
                                </Link>
                            </div>
                        </>
                    )}

                    {sent && (
                        <div className="card card--tight">
                            <div className="auth-success-title">
                                Check your inbox
                            </div>

                            <div className="muted">
                                We sent a password reset link to <b>{email}</b>.
                            </div>

                            <div className="row auth-footer-actions">
                                <Link to="/auth" className="btn-primary">
                                    Back to sign in
                                </Link>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </>
    );
}