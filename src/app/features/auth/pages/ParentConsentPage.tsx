import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    signOut,
} from "firebase/auth";
import { db, auth, onApproveAndCreate } from "../../../shared/lib/firebase";
import { upsertUserProfile } from "../api/users";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer";
import "../styles/auth.css";
import type { PendingUser } from "../types.ts";
import {EyeIcon} from "../components/EyeIcon.tsx";

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
    if (m.includes("auth/email-already-in-use")) return "A guardian account already exists for this email. Try signing in instead.";
    if (m.includes("auth/weak-password")) return "Password must be at least 6 characters.";
    if (m.includes("auth/invalid-email")) return "Please enter a valid email address.";
    return message || "Something went wrong.";
}

type Step = "consent" | "register" | "done";

export default function ParentConsentPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    // Data
    const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);

    // UI state
    const [step, setStep] = useState<Step>("consent");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Consent checkboxes
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [performanceTrackingAccepted, setPerformanceTrackingAccepted] = useState(false);
    const [dataSharingAccepted, setDataSharingAccepted] = useState(false);

    // Guardian registration fields
    const [guardianName, setGuardianName] = useState("");
    const [guardianEmail, setGuardianEmail] = useState("");
    const [guardianPassword, setGuardianPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // ── Fetch pending user ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) {
            setError("Invalid or missing consent token.");
            setLoading(false);
            return;
        }

        const fetchPendingUser = async () => {
            try {
                const docRef = doc(db, "pendingUsers", token);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) throw new Error("Consent link not found or already used.");
                const data = docSnap.data() as PendingUser;
                setPendingUser(data);
                // Pre-fill guardian email from the address we emailed
                setGuardianEmail(data.parentEmail ?? "");
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingUser();
    }, [token]);

    // ── Step 1: Accept consents ─────────────────────────────────────────────────
    const canProceedToRegister =
        termsAccepted && privacyAccepted && performanceTrackingAccepted;

    const onConsentNext = () => {
        if (!canProceedToRegister) {
            setError("Please accept all required consents before continuing.");
            return;
        }
        setError(null);
        setStep("register");
    };

    // ── Step 2: Create guardian account + approve child ─────────────────────────
    const canRegister =
        guardianName.trim().length >= 2 &&
        guardianEmail.trim().length > 5 &&
        guardianPassword.length >= 6 &&
        guardianPassword === confirmPassword;

    const onRegisterAndApprove = async () => {
        if (!pendingUser || !token) return;
        if (guardianPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setBusy(true);
        setError(null);

        try {
            // 1. Create Firebase auth account for guardian
            const cred = await createUserWithEmailAndPassword(
                auth,
                guardianEmail.trim().toLowerCase(),
                guardianPassword
            );

            await updateProfile(cred.user, { displayName: guardianName.trim() });
            await sendEmailVerification(cred.user);

            // 2. Write guardian profile to Firestore
            const now = new Date().toISOString();
            await upsertUserProfile(cred.user.uid, {
                uid: cred.user.uid,
                email: cred.user.email ?? guardianEmail.trim().toLowerCase(),
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
                status: {
                    isActive: true,
                    isVerified: false,
                    requiresParentalConsent: false,
                },
                consent: {
                    termsAcceptedAt: now,
                    privacyAcceptedAt: now,
                    performanceTrackingAccepted: performanceTrackingAccepted,
                    dataSharingAccepted: dataSharingAccepted,
                    givenBy: "self",
                    givenByUid: cred.user.uid,
                    updatedAt: now,
                },
                createdAt: now,
                updatedAt: now,
            });

            // 3. Approve and activate the child's pending account
            await onApproveAndCreate(pendingUser, token, {
                termsAccepted,
                privacyAccepted,
                performanceTrackingAccepted,
                dataSharingAccepted,
                guardianUid: cred.user.uid,
            });

            // 4. Sign out — guardian verifies their own email before logging in
            await signOut(auth);

            setStep("done");
        } catch (e: any) {
            setError(friendlyError(e?.message ?? "Registration failed."));
        } finally {
            setBusy(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    if (loading) return <p>Loading…</p>;
    if (error && !pendingUser) return <p className="error">{error}</p>;
    if (!pendingUser) return null;

    return (
        <>
            <Navbar />
            <main className="page-content">
                <div className="card auth-card">

                    {/* ── Step indicator ── */}
                    {step !== "done" && (
                        <div className="consent-steps">
                            <span className={`consent-step ${step === "consent" ? "active" : "complete"}`}>
                                1. Review &amp; Consent
                            </span>
                            <span className="consent-step-divider">›</span>
                            <span className={`consent-step ${step === "register" ? "active" : ""}`}>
                                2. Create Guardian Account
                            </span>
                        </div>
                    )}

                    {error && <p className="error">{error}</p>}

                    {/* ════════════════════════════════════════════
                        STEP 1 — Review child details + give consent
                    ════════════════════════════════════════════ */}
                    {step === "consent" && (
                        <>
                            <h3>Parental Consent</h3>
                            <p className="muted">
                                Review the details below and accept the required consents
                                to activate your child's account.
                            </p>

                            <div className="auth-register">
                                <span><b>{pendingUser.fullName}</b></span>
                                <span>{pendingUser.email}</span>
                                <span>{pendingUser.club}</span>
                            </div>

                            <div className="terms-checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={e => setTermsAccepted(e.target.checked)}
                                    />
                                    I agree to the <a href="/terms" target="_blank">Terms of Service</a>{" "}
                                    <span className="required-badge">Required</span>
                                </label>

                                <label>
                                    <input
                                        type="checkbox"
                                        checked={privacyAccepted}
                                        onChange={e => setPrivacyAccepted(e.target.checked)}
                                    />
                                    I agree to the <a href="/privacy" target="_blank">Privacy Policy</a>{" "}
                                    <span className="required-badge">Required</span>
                                </label>

                                <label>
                                    <input
                                        type="checkbox"
                                        checked={performanceTrackingAccepted}
                                        onChange={e => setPerformanceTrackingAccepted(e.target.checked)}
                                    />
                                    I consent to performance tracking{" "}
                                    <span className="required-badge">Required</span>
                                </label>

                                <label>
                                    <input
                                        type="checkbox"
                                        checked={dataSharingAccepted}
                                        onChange={e => setDataSharingAccepted(e.target.checked)}
                                    />
                                    I consent to data sharing with coaches / universities{" "}
                                    <span className="optional-badge">Optional</span>
                                </label>
                            </div>

                            <div className="auth-row">
                                <button
                                    className="auth-login-btn"
                                    onClick={onConsentNext}
                                    disabled={!canProceedToRegister}
                                >
                                    Continue →
                                </button>
                            </div>
                        </>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 2 — Guardian account registration
                    ════════════════════════════════════════════ */}
                    {step === "register" && (
                        <>
                            <h3>Create Your Guardian Account</h3>
                            <p className="muted">
                                Create an account so you can manage your child's profile
                                and update consents at any time.
                            </p>

                            <div className="form">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={guardianName}
                                    onChange={e => setGuardianName(e.target.value)}
                                    placeholder="Your full name"
                                />

                                <label>Email</label>
                                <input
                                    type="email"
                                    value={guardianEmail}
                                    onChange={e => setGuardianEmail(e.target.value)}
                                    placeholder="Your email address"
                                />

                                <label>Password</label>
                                <div className="password-wrapper">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={guardianPassword}
                                        onChange={e => setGuardianPassword(e.target.value)}
                                        placeholder="At least 6 characters"
                                    />
                                    <button
                                        type="button"
                                        className={`toggle-password ${showPassword ? "active" : ""}`}
                                        onClick={() => setShowPassword(v => !v)}
                                    >
                                        <EyeIcon />
                                    </button>
                                </div>

                                <label>Confirm Password</label>
                                <div className="password-wrapper">
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat password"
                                    />
                                    <button
                                        type="button"
                                        className={`toggle-password ${showConfirm ? "active" : ""}`}
                                        onClick={() => setShowConfirm(v => !v)}
                                    >
                                        <EyeIcon />
                                    </button>
                                </div>

                                {confirmPassword.length > 0 && guardianPassword !== confirmPassword && (
                                    <p className="error error--no-top-margin">Passwords do not match.</p>
                                )}

                                <div className="auth-row auth-row--actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => { setError(null); setStep("consent"); }}
                                        disabled={busy}
                                    >
                                        ← Back
                                    </button>

                                    <button
                                        className="auth-login-btn"
                                        onClick={onRegisterAndApprove}
                                        disabled={!canRegister || busy}
                                    >
                                        {busy ? "Creating account…" : "Approve & Create Account"}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 3 — Success
                    ════════════════════════════════════════════ */}
                    {step === "done" && (
                        <>
                            <h3>All Done! ✓</h3>
                            <p>
                                You've successfully given consent and created your guardian account.
                            </p>
                            <p className="muted">
                                <b>{pendingUser.fullName}'s</b> account is now active. We've sent
                                a verification link to <b>{guardianEmail}</b> — please verify your
                                own email before signing in.
                            </p>
                            <div className="auth-row auth-row--done">
                                <a className="auth-login-btn" href="/auth">
                                    Go to Sign In
                                </a>
                            </div>
                        </>
                    )}

                </div>
            </main>
            <Footer />
        </>
    );
}