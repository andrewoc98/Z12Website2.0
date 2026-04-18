import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import {
    createUserWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    updateProfile,
    sendEmailVerification,
    signOut,
} from "firebase/auth";
import {
    auth,
    createPendingUser,
    getUserProfile,
    sendParentConsentEmail,
} from "../../../shared/lib/firebase";
import { fetchAdminInvite, markAdminInviteUsed, upsertUserProfile } from "../api/users";
import { isMinor, signInEmail } from "../api/auth";
import "../../../shared/styles/globals.css";
import "../styles/auth.css";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import DateOfBirthInput from "../components/DateOfBirthInput.tsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "signin" | "register";
type RoleChoice = "rower" | "host" | "coach";

interface RoleDetails {
    rower?: {
        gender: "male" | "female";
        dateOfBirth: string;
        club: string;
        parentEmail: string;
    };
    coach?: {
        club: string;
    };
    host?: {
        location: string;
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
    if (m.includes("network")) return "No internet connection. Please check your network and try again.";
    if (m.includes("auth/invalid-credential") || m.includes("auth/wrong-password")) return "Incorrect email or password.";
    if (m.includes("auth/user-not-found")) return "No account found for that email.";
    if (m.includes("auth/email-already-in-use")) return "That email is already in use. Try signing in instead.";
    if (m.includes("auth/weak-password")) return "Password must be at least 6 characters.";
    if (m.includes("auth/invalid-email")) return "Please enter a valid email.";
    return message || "Something went wrong.";
}

function normalizeFullName(name: string) {
    return name.trim().replace(/\s+/g, " ");
}

const ALL_ROLES: RoleChoice[] = ["rower", "coach", "host"];

function defaultRoleDetails(): RoleDetails {
    return {
        rower: { gender: "male", dateOfBirth: "", club: "", parentEmail: "" },
        coach: { club: "" },
        host: { location: "" },
    };
}

// ─── Wizard step indicators ────────────────────────────────────────────────────

function WizardSteps({ step }: { step: 1 | 2 | 3 }) {
    const labels = ["Choose roles", "Role details", "Consent & submit"];
    return (
        <div className="wizard-steps">
            {labels.map((label, i) => (
                <div key={i} className={`wizard-step ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
                    <span className="wizard-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                    <span className="wizard-step-label">{label}</span>
                    {i < labels.length - 1 && <span className="wizard-step-line" />}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1 — Role picker ──────────────────────────────────────────────────────

function StepPickRoles({
                           selectedRoles,
                           onChange,
                       }: {
    selectedRoles: RoleChoice[];
    onChange: (roles: RoleChoice[]) => void;
}) {
    function toggle(role: RoleChoice) {
        onChange(
            selectedRoles.includes(role)
                ? selectedRoles.filter((r) => r !== role)
                : [...selectedRoles, role]
        );
    }

    return (
        <div className="step-pick-roles">
            <p className="muted" style={{ marginBottom: "1rem" }}>
                Select all roles that apply. You can always add more later in your profile settings.
            </p>
            {ALL_ROLES.map((role) => (
                <label key={role} className="role-card-checkbox">
                    <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggle(role)}
                    />
                    <div className="role-card-body">
                        <span className="role-card-title">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                        <span className="role-card-desc">
                            {role === "rower" && "Track your performance and join events."}
                            {role === "coach" && "Manage athletes and review their data."}
                            {role === "host" && "Host events and manage registrations."}
                        </span>
                    </div>
                </label>
            ))}
        </div>
    );
}

// ─── Step 2 — Per-role detail tabs ─────────────────────────────────────────────

function StepRoleDetails({
                             selectedRoles,
                             details,
                             onChange,
                         }: {
    selectedRoles: RoleChoice[];
    details: RoleDetails;
    onChange: (d: RoleDetails) => void;
}) {
    const [activeTab, setActiveTab] = useState<RoleChoice>(selectedRoles[0]);

    function patch(role: RoleChoice, partial: any) {
        onChange({ ...details, [role]: { ...(details as any)[role], ...partial } });
    }

    const d = details;

    return (
        <div className="step-role-details">
            {selectedRoles.length > 1 && (
                <div className="role-tabs">
                    {selectedRoles.map((role) => (
                        <button
                            key={role}
                            type="button"
                            className={`role-tab ${activeTab === role ? "active" : ""}`}
                            onClick={() => setActiveTab(role)}
                        >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                        </button>
                    ))}
                </div>
            )}

            {(selectedRoles.length === 1 ? [selectedRoles[0]] : [activeTab]).map((role) => (
                <div key={role} className="role-tab-content">
                    {role === "rower" && d.rower && (
                        <>
                            <label>Gender</label>
                            <select
                                value={d.rower.gender}
                                onChange={(e) => patch("rower", { gender: e.target.value })}
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                            <DateOfBirthInput
                                value={d.rower.dateOfBirth}
                                onChange={(date) => patch("rower", { dateOfBirth: date })}
                            />

                            {isMinor(d.rower.dateOfBirth) && (
                                <>
                                    <label>Parent / Guardian Email</label>
                                    <input
                                        type="email"
                                        value={d.rower.parentEmail}
                                        onChange={(e) => patch("rower", { parentEmail: e.target.value })}
                                    />
                                </>
                            )}

                            <label>Club</label>
                            <input
                                value={d.rower.club}
                                onChange={(e) => patch("rower", { club: e.target.value })}
                            />
                        </>
                    )}

                    {role === "coach" && d.coach && (
                        <>
                            <label>Club</label>
                            <input
                                value={d.coach.club}
                                onChange={(e) => patch("coach", { club: e.target.value })}
                            />
                        </>
                    )}

                    {role === "host" && d.host && (
                        <>
                            <label>Location</label>
                            <input
                                value={d.host.location}
                                onChange={(e) => patch("host", { location: e.target.value })}
                            />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}


function StepConsent({
                         selectedRoles,
                         acceptedTerms, setAcceptedTerms,
                         acceptedPrivacy, setAcceptedPrivacy,
                         acceptedDataSharing, setAcceptedDataSharing,
                         acceptedPerformanceTracking, setAcceptedPerformanceTracking,
                     }: {
    selectedRoles: RoleChoice[];
    acceptedTerms: boolean; setAcceptedTerms: (v: boolean) => void;
    acceptedPrivacy: boolean; setAcceptedPrivacy: (v: boolean) => void;
    acceptedDataSharing: boolean; setAcceptedDataSharing: (v: boolean) => void;
    acceptedPerformanceTracking: boolean; setAcceptedPerformanceTracking: (v: boolean) => void;
}) {
    return (
        <div className="terms-checkbox">
            <label>
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                I agree to the terms and conditions
                <span className="required-badge">Required</span>
            </label>
            <label>
                <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
                I agree to the privacy policy
                <span className="required-badge">Required</span>
            </label>

            {selectedRoles.includes("rower") && (
                <label>
                    <input type="checkbox" checked={acceptedPerformanceTracking} onChange={(e) => setAcceptedPerformanceTracking(e.target.checked)} />
                    I agree to performance tracking
                    <span className="required-badge">Required</span>
                </label>
            )}
            <label>
                <input type="checkbox" checked={acceptedDataSharing} onChange={(e) => setAcceptedDataSharing(e.target.checked)} />
                I agree to share my data with coaches/universities
                <span className="optional-badge">Optional</span>
            </label>
        </div>
    );
}


export default function AuthPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const inviteId = searchParams.get("adminInvite");

    const goAfterAuth = () => {
        const raw = searchParams.get("returnTo");
        if (!raw) { navigate("/"); return; }
        let path = raw;
        try { path = decodeURIComponent(raw); } catch {}
        if (!path.startsWith("/")) { navigate("/"); return; }
        navigate(path);
    };

    // ── Shared state ────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [successType, setSuccessType] = useState<"email" | "parent" | null>(null);
    const [adminInvite, setAdminInvite] = useState<any | null>(null);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendCount, setResendCount] = useState(0);
    const [resendSent, setResendSent] = useState(false);

    // ── Wizard state ─────────────────────────────────────────────────────────────
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [selectedRoles, setSelectedRoles] = useState<RoleChoice[]>(["rower"]);
    const [roleDetails, setRoleDetails] = useState<RoleDetails>(defaultRoleDetails());

    // ── Consent ──────────────────────────────────────────────────────────────────
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedDataSharing, setAcceptedDataSharing] = useState(false);
    const [acceptedPerformanceTracking, setAcceptedPerformanceTracking] = useState(false);

    const loc = useLocation();

    // Restore state from router location (e.g. redirect back)
    useEffect(() => {
        if (!loc.state) return;
        const s = loc.state as any;
        setEmail(s.email || "");
        setPassword(s.password || "");
        setFullName(s.fullName || "");
        if (s.mode === "register" || s.mode === "signin") setMode(s.mode);
    }, [loc.state]);

    // Admin invite
    useEffect(() => {
        if (!inviteId) return;
        fetchAdminInvite(inviteId).then((invite) => {
            if (!invite || invite.used) return;
            setAdminInvite(invite);
            setMode("register");
        });
    }, [inviteId]);

    useEffect(() => {
        if (adminInvite) setEmail(adminInvite.email);
    }, [adminInvite]);

    // ── Validation ───────────────────────────────────────────────────────────────

    const canSignIn = useMemo(
        () => email.trim().length > 0 && password.trim().length > 0,
        [email, password]
    );

    const step2Valid = useMemo(() => {
        for (const role of selectedRoles) {
            if (role === "rower") {
                const r = roleDetails.rower!;
                if (!r.dateOfBirth) return false;
                if (r.club.trim().length < 2) return false;
                if (isMinor(r.dateOfBirth) && (!r.parentEmail || !r.parentEmail.includes("@"))) return false;
            }
            if (role === "coach" && roleDetails.coach!.club.trim().length < 2) return false;
            if (role === "host" && roleDetails.host!.location.trim().length < 2) return false;
        }
        return true;
    }, [selectedRoles, roleDetails]);

    const canRegister = useMemo(() => {
        if (email.trim().length === 0) return false;
        if (password.trim().length < 6) return false;
        if (normalizeFullName(fullName).length < 2) return false;
        if (!acceptedTerms || !acceptedPrivacy) return false;
        if (selectedRoles.includes("rower") && !acceptedPerformanceTracking) return false;
        if (adminInvite) return true;
        return step2Valid;
    }, [email, password, fullName, acceptedTerms, acceptedPrivacy, acceptedPerformanceTracking, selectedRoles, step2Valid, adminInvite]);

    // ── Handlers ─────────────────────────────────────────────────────────────────

    function clearForm() {
        setEmail(""); setPassword(""); setFullName("");
        setSelectedRoles(["rower"]); setRoleDetails(defaultRoleDetails());
        setWizardStep(1); setErr(null);
    }

    async function onSignIn() {
        setErr(null);
        setUnverifiedEmail(null);
        setResendSent(false);
        setBusy(true);
        try {
            const cred = await signInEmail(email.trim(), password);
            if (!cred.user.emailVerified) {
                await signOut(auth);
                setUnverifiedEmail(email.trim()); // reveal resend UI
                setErr("Please verify your email before signing in.");
                return;
            }
            const profile = await getUserProfile(cred.user.uid);
            if (profile?.status?.requiresParentalConsent) {
                await signOut(auth);
                setErr("Parental consent required before access.");
                return;
            }
            goAfterAuth();
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Sign-in failed"));
        } finally {
            setBusy(false);
        }
    }

    async function onResendVerification() {
        if (resendCooldown > 0 || resendCount >= 3) return;
        setErr(null);
        setResendSent(false);
        setBusy(true);
        try {
            // Re-authenticate to get a live credential — proves they know the password
            const cred = await signInEmail(unverifiedEmail!, password);
            await sendEmailVerification(cred.user);
            await signOut(auth);
            setResendSent(true);
            setResendCount((c) => c + 1);

            // Start 60-second cooldown
            let secs = 60;
            setResendCooldown(secs);
            const timer = setInterval(() => {
                secs -= 1;
                setResendCooldown(secs);
                if (secs <= 0) clearInterval(timer);
            }, 1000);
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Could not resend verification email."));
        } finally {
            setBusy(false);
        }
    }

    async function onRegister() {
        setErr(null); setBusy(true);
        try {
            const cleanEmail = email.trim().toLowerCase();
            const name = normalizeFullName(fullName);

            const rowerMinor =
                selectedRoles.includes("rower") &&
                isMinor(roleDetails.rower!.dateOfBirth);

            // Minor rower → pending consent flow
            if (rowerMinor && !adminInvite) {
                const r = roleDetails.rower!;
                const pendingId = await createPendingUser({
                    email: cleanEmail,
                    fullName: name,
                    dateOfBirth: r.dateOfBirth,
                    parentEmail: r.parentEmail,
                    club: r.club,
                });
                await sendParentConsentEmail(r.parentEmail, pendingId);
                setSuccessType("parent");
                setVerificationSent(true);
                return;
            }

            // Guard: check for existing account before attempting creation
            const existingMethods = await fetchSignInMethodsForEmail(auth, cleanEmail);
            if (existingMethods.length > 0) {
                throw new Error("An account with this email already exists. Try signing in instead.");
            }

            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            await updateProfile(cred.user, { displayName: name });
            await sendEmailVerification(cred.user);

            const now = new Date().toISOString();

            const profileBase: any = {
                uid: cred.user.uid,
                email: cred.user.email ?? cleanEmail,
                fullName: name,
                displayName: name,
                primaryRole: adminInvite ? "admin" : selectedRoles[0],
                roles: {},
                createdAt: now,
                updatedAt: now,
            };

            if (adminInvite) {
                if (cleanEmail !== adminInvite.email) throw new Error("This invite is restricted to a specific email.");
                profileBase.primaryRole = "admin";
                profileBase.inviteId = adminInvite.id;
                profileBase.roles.admin = { hostId: adminInvite.hostId };
            } else {
                // Build each selected role
                for (const role of selectedRoles) {
                    if (role === "rower") {
                        const r = roleDetails.rower!;
                        profileBase.roles.rower = { club: r.club.trim() };
                        profileBase.gender = r.gender;
                        profileBase.dateOfBirth = r.dateOfBirth;
                        profileBase.birthYear = Number(r.dateOfBirth.slice(0, 4));
                        profileBase.isMinor = false;
                        profileBase.consent = {
                            termsAcceptedAt: now,
                            privacyAcceptedAt: now,
                            performanceTrackingAccepted: acceptedPerformanceTracking,
                            dataSharingAccepted: acceptedDataSharing,
                            givenBy: "self",
                            givenByUid: cred.user.uid,
                            updatedAt: now,
                        };
                        profileBase.permissions = {
                            shareWithCoaches: false,
                            shareWithUniversities: false,
                            shareWithFederations: false,
                        };
                        profileBase.status = { isActive: true, isVerified: false };
                    } else if (role === "coach") {
                        profileBase.roles.coach = { club: roleDetails.coach!.club.trim() };
                    } else if (role === "host") {
                        profileBase.roles.host = { location: roleDetails.host!.location.trim() };
                    }
                }
            }

            await upsertUserProfile(cred.user.uid, profileBase);
            if (adminInvite) await markAdminInviteUsed(adminInvite.id);

            await signOut(auth);
            setSuccessType("email");
            setVerificationSent(true);
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Registration failed"));
        } finally {
            setBusy(false);
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="page-container">
                <Navbar />

                <div className="page-content">
                    <main>
                        <div className="card auth-card">

                            {/* ── Success screens ─────────────────────────────── */}
                            {verificationSent ? (
                                <>
                                    {successType === "email" && (
                                        <>
                                            <h3>Verify your email</h3>
                                            <p className="muted">
                                                We've sent a verification link to <b>{email}</b>.
                                                Please verify your account before signing in.
                                            </p>
                                            <div className="row auth-footer-actions">
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => { clearForm(); setMode("signin"); setVerificationSent(false); }}
                                                >
                                                    Back to sign in
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    {successType === "parent" && (
                                        <>
                                            <h3>Parental approval required</h3>
                                            <p className="muted">
                                                A consent request has been sent to <b>{roleDetails.rower?.parentEmail}</b>.
                                                Your account will be activated once your parent or guardian approves it.
                                            </p>
                                        </>
                                    )}
                                </>

                            ) : mode === "signin" ? (

                                /* ── Sign-in form ──────────────────────────────── */
                                <>
                                    <h3>LOGIN</h3>
                                    {err && <p className="error">{err}</p>}

                                    {unverifiedEmail && (
                                        <div className="resend-verification">
                                            {resendCount >= 3 ? (
                                                <p className="muted">
                                                    Maximum resend attempts reached. Check your spam folder or contact support.
                                                </p>
                                            ) : resendSent ? (
                                                <p className="muted">
                                                    Verification email sent to <b>{unverifiedEmail}</b>.
                                                    {` Please wait to resend again`}
                                                </p>
                                            ) : (
                                                <p className="muted">
                                                    Didn't receive a verification email?
                                                </p>
                                            )}
                                            {resendCount < 3 && (
                                                <button
                                                    className="btn-secondary"
                                                    disabled={resendCooldown > 0 || busy}
                                                    onClick={onResendVerification}
                                                >
                                                    {resendCooldown > 0
                                                        ? `Resend in ${resendCooldown}s`
                                                        : resendSent
                                                            ? "Resend again"
                                                            : "Resend verification email"}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="form">
                                        <label>Email</label>
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

                                        <label>Password</label>
                                        <div className="password-wrapper">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter password"
                                            />
                                            <button
                                                type="button"
                                                className={`toggle-password ${showPassword ? "active" : ""}`}
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle className="pupil" cx="12" cy="12" r="3" />
                                                    <line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            </button>
                                        </div>

                                        <Link to="/forgot-password">Forgot password?</Link>

                                        <div className="auth-actions">
                                            <div className="auth-row">
                                                <button
                                                    className="auth-login-btn"
                                                    disabled={!canSignIn || busy}
                                                    onClick={onSignIn}
                                                >
                                                    SIGN IN
                                                </button>
                                                <div className="auth-links">
                                                    <div className="auth-register">
                                                        <span>Don't have an account?</span>
                                                        <button className="btn-secondary" onClick={() => { setMode("register"); setWizardStep(1); setErr(null) }}>
                                                            CREATE ONE
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>

                            ) : (

                                /* ── Registration wizard ───────────────────────── */
                                <>
                                    <h3>REGISTER</h3>
                                    {err && <p className="error">{err}</p>}

                                    {/* Account fields always visible at top */}
                                    {wizardStep === 1 && (
                                        <div className="form" style={{ marginBottom: "1rem" }}>
                                            <label>Email</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                disabled={!!adminInvite}
                                            />

                                            <label>Password</label>
                                            <div className="password-wrapper">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="At least 6 characters"
                                                />
                                                <button
                                                    type="button"
                                                    className={`toggle-password ${showPassword ? "active" : ""}`}
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                        <circle className="pupil" cx="12" cy="12" r="3" />
                                                        <line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <label>Full name</label>
                                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                                        </div>
                                    )}

                                    {/* Wizard steps */}
                                    {!adminInvite && <WizardSteps step={wizardStep} />}

                                    <div className="form" style={{ marginTop: "1rem" }}>

                                        {!adminInvite && wizardStep === 1 && (
                                            <StepPickRoles selectedRoles={selectedRoles} onChange={setSelectedRoles} />
                                        )}

                                        {!adminInvite && wizardStep === 2 && (
                                            <StepRoleDetails
                                                selectedRoles={selectedRoles}
                                                details={roleDetails}
                                                onChange={setRoleDetails}
                                            />
                                        )}

                                        {(adminInvite || wizardStep === 3) && (
                                            <StepConsent
                                                selectedRoles={selectedRoles}
                                                acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms}
                                                acceptedPrivacy={acceptedPrivacy} setAcceptedPrivacy={setAcceptedPrivacy}
                                                acceptedDataSharing={acceptedDataSharing} setAcceptedDataSharing={setAcceptedDataSharing}
                                                acceptedPerformanceTracking={acceptedPerformanceTracking} setAcceptedPerformanceTracking={setAcceptedPerformanceTracking}
                                            />
                                        )}

                                        {/* Navigation buttons */}
                                        <div className="auth-actions" style={{ marginTop: "1.25rem" }}>
                                            <div className="auth-row">

                                                {/* Back */}
                                                {!adminInvite && wizardStep > 1 && (
                                                    <button
                                                        className="btn-secondary"
                                                        onClick={() => setWizardStep((s) => (s - 1) as any)}
                                                    >
                                                        BACK
                                                    </button>
                                                )}

                                                {/* Next / Submit */}
                                                {!adminInvite && wizardStep < 3 ? (
                                                    <button
                                                        className="auth-login-btn"
                                                        disabled={
                                                            wizardStep === 1
                                                                ? selectedRoles.length === 0 ||
                                                                email.trim().length === 0 ||
                                                                password.trim().length < 6 ||
                                                                normalizeFullName(fullName).length < 2
                                                                : !step2Valid
                                                        }
                                                        onClick={() => setWizardStep((s) => (s + 1) as any)}
                                                    >
                                                        NEXT
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="auth-login-btn"
                                                        disabled={!canRegister || busy}
                                                        onClick={onRegister}
                                                    >
                                                        {busy ? "CREATING…" : "CREATE ACCOUNT"}
                                                    </button>
                                                )}

                                                {!adminInvite && (
                                                    <div className="auth-links">
                                                        <div className="auth-register">
                                                            <span>Already have an account?</span>
                                                            <button className="btn-secondary" onClick={() => { setMode("signin"); setWizardStep(1); }}>
                                                                SIGN IN
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </>
                            )}
                        </div>
                    </main>
                </div>

                <Footer />
            </div>
        </>
    );
}