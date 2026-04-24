import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "../../../shared/components/Footer/Footer";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { auth, db, functions, onApproveAndCreate } from "../../../shared/lib/firebase";
import { upsertUserProfile } from "../api/users";
import { EyeIcon } from "../components/EyeIcon.tsx";
import "../styles/auth.css";
import type { PendingUser } from "../types.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
    if (m.includes("auth/wrong-password") || m.includes("auth/invalid-credential"))
        return "Incorrect password. Please try again.";
    if (m.includes("auth/too-many-requests"))
        return "Too many attempts. Please wait a moment and try again.";
    if (m.includes("auth/weak-password"))
        return "Password must be at least 6 characters.";
    if (m.includes("auth/invalid-email"))
        return "Please enter a valid email address.";
    return message || "Something went wrong.";
}

type Step = "consent" | "account" | "done";

// ─── Password field with toggle ───────────────────────────────────────────────

function PasswordInput({
                           value,
                           onChange,
                           placeholder,
                       }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="password-wrapper">
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder ?? "Password"}
            />
            <button
                type="button"
                className={`toggle-password ${show ? "active" : ""}`}
                onClick={() => setShow((v) => !v)}
            >
                <EyeIcon />
            </button>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ParentConsentPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    // Data
    const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);

    // UI state
    const [step, setStep]       = useState<Step>("consent");
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [busy, setBusy]       = useState(false);

    // Consent checkboxes
    const [termsAccepted, setTermsAccepted]                           = useState(false);
    const [privacyAccepted, setPrivacyAccepted]                       = useState(false);
    const [performanceTrackingAccepted, setPerformanceTrackingAccepted] = useState(false);
    const [dataSharingAccepted, setDataSharingAccepted]               = useState(false);

    // Account step — shared
    const [guardianEmail, setGuardianEmail] = useState("");

    // "existing account" branch
    const [accountExists, setAccountExists]   = useState<boolean | null>(null); // null = not yet checked
    const [checkingEmail, setCheckingEmail]   = useState(false);
    const [guardianPassword, setGuardianPassword] = useState("");

    // "new account" branch
    const [guardianName, setGuardianName]         = useState("");
    const [newPassword, setNewPassword]           = useState("");
    const [confirmPassword, setConfirmPassword]   = useState("");

    // ── Fetch pending user ────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) {
            setError("Invalid or missing consent token.");
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const snap = await getDoc(doc(db, "pendingUsers", token));
                if (!snap.exists()) throw new Error("Consent link not found or already used.");
                const data = snap.data() as PendingUser;
                setPendingUser(data);
                setGuardianEmail(data.parentEmail ?? "");
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    // ── Step 1: consent validation ────────────────────────────────────────────
    const canProceedToAccount = termsAccepted && privacyAccepted && performanceTrackingAccepted;

    function onConsentNext() {
        if (!canProceedToAccount) {
            setError("Please accept all required consents before continuing.");
            return;
        }
        setError(null);
        setStep("account");
    }

    async function checkEmail() {
        const email = guardianEmail.trim().toLowerCase();
        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address.");
            return;
        }
        setError(null);
        setCheckingEmail(true);
        try {
            const checkEmailExists = httpsCallable(functions, "checkEmailExists");
            const result = await checkEmailExists({ email });
            setAccountExists((result.data as { exists: boolean }).exists);
        } catch (e: any) {
            setError(friendlyError(e?.message ?? "Could not check email."));
        } finally {
            setCheckingEmail(false);
        }
    }

    // Reset account-check state when email changes
    function onEmailChange(v: string) {
        setGuardianEmail(v);
        setAccountExists(null);
        setError(null);
    }

    // ── Validation per branch ─────────────────────────────────────────────────
    const canSignInAndApprove =
        accountExists === true &&
        guardianPassword.length >= 6;

    const canRegisterAndApprove =
        accountExists === false &&
        guardianName.trim().length >= 2 &&
        newPassword.length >= 6 &&
        newPassword === confirmPassword;

    // ── Shared approve logic (called after auth) ──────────────────────────────
    async function approveChild(guardianUid: string) {
        await onApproveAndCreate(pendingUser!, token!, {
            termsAccepted,
            privacyAccepted,
            performanceTrackingAccepted,
            dataSharingAccepted,
            guardianUid,
        });
    }

    // ── Existing guardian: sign in → approve ─────────────────────────────────
    async function onSignInAndApprove() {
        if (!pendingUser || !token) return;
        setBusy(true);
        setError(null);
        try {
            const cred = await signInWithEmailAndPassword(
                auth,
                guardianEmail.trim().toLowerCase(),
                guardianPassword
            );
            await approveChild(cred.user.uid);
            await signOut(auth);
            setStep("done");
        } catch (e: any) {
            setError(friendlyError(e?.message ?? "Sign-in failed."));
        } finally {
            setBusy(false);
        }
    }

    // ── New guardian: create account → approve ────────────────────────────────
async function onRegisterAndApprove() {
        if (busy) return;
        if (!pendingUser || !token) return;
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const cleanEmail = guardianEmail.trim().toLowerCase();
            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, newPassword);
            await updateProfile(cred.user, { displayName: guardianName.trim() });
            await sendEmailVerification(cred.user);

            const now = new Date().toISOString();
            await upsertUserProfile(cred.user.uid, {
                uid: cred.user.uid,
                email: cred.user.email ?? cleanEmail,
                fullName: guardianName.trim(),
                displayName: guardianName.trim(),
                primaryRole: "guardian",
                roles: {
                    guardian: {
                        linkedChildPendingId: token,
                        linkedChildName: pendingUser.fullName,
                    },
                },
                gender: "unknown" as const,
                dateOfBirth: "",
                isMinor: false,
                permissions: {
                    shareWithCoaches: false,
                    shareWithUniversities: false,
                    shareWithFederations: false,
                },
                status: { isActive: true, isVerified: false, requiresParentalConsent: false },
                consent: {
                    termsAcceptedAt: now,
                    privacyAcceptedAt: now,
                    performanceTrackingAccepted,
                    dataSharingAccepted,
                    givenBy: "self",
                    givenByUid: cred.user.uid,
                    updatedAt: now,
                },
                createdAt: now,
                updatedAt: now,
            });

            await approveChild(cred.user.uid);
            await signOut(auth);
            setStep("done");
        } catch (e: any) {
            const msg = e?.message ?? "";
            if (msg.includes("auth/email-already-in-use")) {
                setAccountExists(true);
                setError("An account with this email already exists. Please sign in below.");
                setBusy(false);
                return;
            }
            setError(friendlyError(msg ?? "Registration failed."));
        } finally {
            setBusy(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) return <p>Loading…</p>;
    if (error && !pendingUser) return <p className="error">{error}</p>;
    if (!pendingUser) return null;

    const accountStepLabel =
        accountExists === true  ? "Sign In" :
            accountExists === false ? "Create Account" :
                "Your Account";

    return (
        <>
            <Navbar />
            <main className="page-content">
                <div className="card auth-card">

                    {/* ── Step indicator ───────────────────────────────────── */}
                    {step !== "done" && (
                        <div className="consent-steps">
                            <span className={`consent-step ${step === "consent" ? "active" : "complete"}`}>
                                1. Review &amp; Consent
                            </span>
                            <span className="consent-step-divider">›</span>
                            <span className={`consent-step ${step === "account" ? "active" : ""}`}>
                                2. {accountStepLabel}
                            </span>
                        </div>
                    )}

                    {error && <p className="error">{error}</p>}

                    {/* ══════════════════════════════════════════════
                        STEP 1 — Review child details + give consent
                    ══════════════════════════════════════════════ */}
                    {step === "consent" && (
                        <>
                            <h3>Parental Consent</h3>
                            <p className="muted">
                                Review the details below and accept the required consents
                                to activate your child's account.
                            </p>

                            <div className="consent-child-summary">
                                <span className="consent-child-name">{pendingUser.fullName}</span>
                                <span className="consent-child-meta">{pendingUser.email}</span>
                                <span className="consent-child-meta">{pendingUser.club}</span>
                            </div>

                            <div className="terms-checkbox">
                                <label>
                                    <input type="checkbox" checked={termsAccepted}
                                           onChange={e => setTermsAccepted(e.target.checked)} />
                                    I agree to the <a href="/terms" target="_blank">Terms of Service</a>{" "}
                                    <span className="required-badge">Required</span>
                                </label>
                                <label>
                                    <input type="checkbox" checked={privacyAccepted}
                                           onChange={e => setPrivacyAccepted(e.target.checked)} />
                                    I agree to the <a href="/privacy" target="_blank">Privacy Policy</a>{" "}
                                    <span className="required-badge">Required</span>
                                </label>
                                <label>
                                    <input type="checkbox" checked={performanceTrackingAccepted}
                                           onChange={e => setPerformanceTrackingAccepted(e.target.checked)} />
                                    I consent to performance tracking{" "}
                                    <span className="required-badge">Required</span>
                                </label>
                                <label>
                                    <input type="checkbox" checked={dataSharingAccepted}
                                           onChange={e => setDataSharingAccepted(e.target.checked)} />
                                    I consent to data sharing with coaches / universities{" "}
                                    <span className="optional-badge">Optional</span>
                                </label>
                            </div>

                            <div className="auth-row">
                                <button
                                    className="auth-login-btn"
                                    onClick={onConsentNext}
                                    disabled={!canProceedToAccount}
                                >
                                    Continue →
                                </button>
                            </div>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        STEP 2 — Account (existing or new)
                    ══════════════════════════════════════════════ */}
                    {step === "account" && (
                        <>
                            {/* ── Email entry + check ───────────────────────── */}
                            <h3>
                                {accountExists === true  ? "Sign In to Approve" :
                                    accountExists === false ? "Create Your Guardian Account" :
                                        "Your Email"}
                            </h3>

                            {accountExists === null && (
                                <p className="muted">
                                    Enter the email address you'd like to use as guardian.
                                    We'll check if you already have an account.
                                </p>
                            )}

                            {accountExists === true && (
                                <p className="muted">
                                    We found an existing account for <b>{guardianEmail}</b>.
                                    Sign in below to approve your child's registration.
                                </p>
                            )}

                            {accountExists === false && (
                                <p className="muted">
                                    No account found for <b>{guardianEmail}</b>.
                                    Create one below to manage your child's profile.
                                </p>
                            )}

                            <div className="form">

                                {/* Email row — always shown, locked after check */}
                                <label>Email</label>
                                <div className="email-check-row">
                                    <input
                                        type="email"
                                        value={guardianEmail}
                                        onChange={(e) => onEmailChange(e.target.value)}
                                        placeholder="your@email.com"
                                        disabled={accountExists !== null}
                                    />
                                    {accountExists !== null && (
                                        <button
                                            type="button"
                                            className="btn-secondary email-change-btn"
                                            onClick={() => {
                                                setAccountExists(null);
                                                setGuardianPassword("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                                setError(null);
                                            }}
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>

                                {/* Check email button */}
                                {accountExists === null && (
                                    <button
                                        type="button"
                                        className="auth-login-btn"
                                        onClick={checkEmail}
                                        disabled={checkingEmail || guardianEmail.trim().length < 5}
                                        style={{ marginTop: "0.5rem" }}
                                    >
                                        {checkingEmail ? "Checking…" : "Continue →"}
                                    </button>
                                )}

                                {/* ── Existing account: sign-in fields ─────── */}
                                {accountExists === true && (
                                    <>
                                        <label>Password</label>
                                        <PasswordInput
                                            value={guardianPassword}
                                            onChange={setGuardianPassword}
                                            placeholder="Your password"
                                        />

                                        <div className="auth-row auth-row--actions" style={{ marginTop: "1rem" }}>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => { setAccountExists(null); setError(null); }}
                                                disabled={busy}
                                            >
                                                ← Back
                                            </button>
                                            <button
                                                type="button"
                                                className="auth-login-btn"
                                                onClick={onSignInAndApprove}
                                                disabled={!canSignInAndApprove || busy}
                                            >
                                                {busy ? "Approving…" : "Sign In & Approve"}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ── New account: registration fields ─────── */}
                                {accountExists === false && (
                                    <>
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            value={guardianName}
                                            onChange={(e) => setGuardianName(e.target.value)}
                                            placeholder="Your full name"
                                        />

                                        <label>Password</label>
                                        <PasswordInput
                                            value={newPassword}
                                            onChange={setNewPassword}
                                            placeholder="At least 6 characters"
                                        />

                                        <label>Confirm Password</label>
                                        <PasswordInput
                                            value={confirmPassword}
                                            onChange={setConfirmPassword}
                                            placeholder="Repeat password"
                                        />

                                        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                            <p className="error error--no-top-margin">Passwords do not match.</p>
                                        )}

                                        <div className="auth-row auth-row--actions" style={{ marginTop: "1rem" }}>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => { setAccountExists(null); setError(null); }}
                                                disabled={busy}
                                            >
                                                ← Back
                                            </button>
                                            <button
                                                type="button"
                                                className="auth-login-btn"
                                                onClick={onRegisterAndApprove}
                                                disabled={!canRegisterAndApprove || busy}
                                            >
                                                {busy ? "Creating account…" : "Approve & Create Account"}
                                            </button>
                                        </div>
                                    </>
                                )}

                            </div>

                            {/* Back to consent */}
                            {accountExists === null && (
                                <div style={{ marginTop: "0.75rem" }}>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => { setStep("consent"); setError(null); }}
                                    >
                                        ← Back to consent
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        STEP 3 — Success
                    ══════════════════════════════════════════════ */}
                    {step === "done" && (
                        <>
                            <h3>All Done! ✓</h3>
                            <p>
                                You've successfully given consent
                                {accountExists === false && " and created your guardian account"}.
                            </p>
                            <p className="muted">
                                <b>{pendingUser.fullName}'s</b> account is now active.
                                {accountExists === false && (
                                    <> We've sent a verification link to <b>{guardianEmail}</b> — please
                                        verify your email before signing in.</>
                                )}
                            </p>
                            <div className="auth-row auth-row--done">
                                <a className="auth-login-btn" href="/auth">Go to Sign In</a>
                            </div>
                        </>
                    )}

                </div>
            </main>
            <Footer />
        </>
    );
}