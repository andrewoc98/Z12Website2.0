import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";
import Navbar from "../../../shared/components/Navbar/Navbar";

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
    if (m.includes("expired") || m.includes("invalid")) return "This reset link has expired or already been used. Please request a new one.";
    if (m.includes("weak-password")) return "Password must be at least 6 characters.";
    return message || "Something went wrong.";
}

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get("oobCode");

    const [password,     setPassword]     = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit() {
        if (!oobCode) { setErr("Invalid reset link."); return; }
        if (password.trim().length < 6) { setErr("Password must be at least 6 characters."); return; }

        setBusy(true);
        setErr(null);

        try {
            await confirmPasswordReset(auth, oobCode, password);
            setDone(true);
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Reset failed."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card">
                    <h1 className="auth-title">Reset your password</h1>
                    <hr />

                    {done ? (
                        <div className="card card--tight">
                            <div className="auth-success-title">Password updated</div>
                            <div className="muted">You can now sign in with your new password.</div>
                            <div className="row auth-footer-actions">
                                <Link to="/auth" className="auth-login-btn">Back to sign in</Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            <label>
                                New password
                                <div className="password-wrapper">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="At least 6 characters"
                                    />
                                    <button type="button" className={`toggle-password ${showPassword ? "active" : ""}`} onClick={() => setShowPassword(v => !v)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    </button>
                                </div>
                            </label>

                            {err && (
                                <div className="card card--tight auth-error">
                                    <div className="auth-error-title">Oops</div>
                                    <div className="muted">{err}</div>
                                </div>
                            )}

                            {!oobCode && (
                                <div className="card card--tight auth-error">
                                    <div className="muted">Invalid or missing reset link. Please request a new one.</div>
                                </div>
                            )}

                            <div className="row auth-footer-actions">
                                <button
                                    className="auth-login-btn"
                                    onClick={onSubmit}
                                    disabled={busy || !oobCode}
                                >
                                    {busy ? "Updating…" : "Set new password"}
                                </button>
                                <Link to="/auth" className="btn-ghost">Back to sign in</Link>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}