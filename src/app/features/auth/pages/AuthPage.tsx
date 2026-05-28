import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import {
    createUserWithEmailAndPassword,
    updateProfile,
    signOut,
} from "firebase/auth";
import {
    auth, checkPendingUserExists,
    createPendingUser,
    getUserProfile,
    sendParentConsentEmail, sendVerificationEmail,
} from "../../../shared/lib/firebase";
import {fetchAdminInvite, upsertUserProfile} from "../api/users";
import { isMinor, signInEmail } from "../api/auth";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";
import "../../../shared/styles/globals.css";
import "../styles/auth.css";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import DateOfBirthInput from "../components/DateOfBirthInput.tsx";
import { PhoneInput } from "../components/PhoneInput.tsx";
import { ClubPicker } from "../components/ClubPicker.tsx";
import type { ClubSelection } from "../components/ClubPicker.tsx";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "signin" | "register";
type RoleChoice = "rower" | "host" | "coach";

type AdminStep = "check-email" | "sign-in" | "register" | "add-mobile";

// ── CHANGED: club is now a ClubSelection object (id + name) instead of a string
interface RoleDetails {
    rower?: {
        gender:      "male" | "female";
        dateOfBirth: string;
        club:        ClubSelection | null; // ← was: string
        parentEmail: string;
    };
    coach?: {
        club: ClubSelection | null;        // ← was: string
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
    if (m.includes("auth/too-many-requests")) {
        return "Too many attempts. Your account has been temporarily locked — wait a few minutes and try again, or reset your password.";
    }
    if (m.includes("auth/user-disabled"))
        return "This account has been disabled. Please contact support.";
    if (m.includes("auth/expired-action-code"))
        return "This link has expired. Please request a new one.";
    if (m.includes("auth/invalid-action-code"))
        return "This link is invalid or has already been used.";
    if (m.includes("auth/requires-recent-login"))
        return "For security, please sign out and sign back in before doing this.";
    if (m.includes("auth/popup-closed-by-user"))
        return "Sign-in was cancelled. Please try again.";
    if (m.includes("auth/cancelled-popup-request"))
        return "";
    if (m.includes("auth/operation-not-allowed"))
        return "This sign-in method is not enabled. Please contact support.";
    if (m.includes("auth/account-exists-with-different-credential"))
        return "An account already exists with this email using a different sign-in method. Try signing in with your original method.";
    if (m.includes("auth/credential-already-in-use"))
        return "This credential is already linked to another account.";
    if (m.includes("auth/missing-email"))
        return "Please enter an email address.";
    if (m.includes("auth/missing-password"))
        return "Please enter a password.";
    if (m.includes("auth/popup-blocked"))
        return "Your browser blocked a sign-in popup. Please allow popups for this site and try again.";
    if (m.includes("auth/provider-already-linked"))
        return "This sign-in method is already linked to your account.";
    return message || "Something went wrong.";
}

function normalizeFullName(name: string) {
    return name.trim().replace(/\s+/g, " ");
}

const ALL_ROLES: RoleChoice[] = ["rower", "coach", "host"];

// ── CHANGED: default club is now null instead of ""
function defaultRoleDetails(): RoleDetails {
    return {
        rower: { gender: "male", dateOfBirth: "", club: null, parentEmail: "" },
        coach: { club: null },
        host:  { location: "" },
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
                            {role === "host"  && "Host events and manage registrations."}
                        </span>
                    </div>
                </label>
            ))}
        </div>
    );
}

// ─── Step 2 — Per-role detail tabs ─────────────────────────────────────────────
// ── CHANGED: club inputs replaced with ClubPicker

function StepRoleDetails({
                             selectedRoles,
                             details,
                             onChange,
                             userEmail,
                         }: {
    selectedRoles: RoleChoice[];
    details:       RoleDetails;
    onChange:      (d: RoleDetails) => void;
    userEmail:     string;
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
                                    {d.rower.parentEmail.length > 0 &&
                                        d.rower.parentEmail.trim().toLowerCase() === userEmail.trim().toLowerCase() && (
                                            <p className="error" style={{ marginTop: 0 }}>
                                                Parent email cannot be the same as your own email.
                                            </p>
                                        )}
                                </>
                            )}

                            {/* ── CHANGED: ClubPicker replaces plain text input ── */}
                            <label>Club <span className="optional-badge">Optional</span></label>
                            <ClubPicker
                                value={d.rower.club}
                                onChange={(club) => patch("rower", { club })}
                            />
                        </>
                    )}

                    {role === "coach" && d.coach && (
                        <>
                            {/* ── CHANGED: ClubPicker replaces plain text input ── */}
                            <label>Club <span className="optional-badge">Optional</span></label>
                            <ClubPicker
                                value={d.coach.club}
                                onChange={(club) => patch("coach", { club })}
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
                         acceptedTerms,         setAcceptedTerms,
                         acceptedPrivacy,       setAcceptedPrivacy,
                         acceptedDataSharing,   setAcceptedDataSharing,
                         acceptedPerformanceTracking, setAcceptedPerformanceTracking,
                     }: {
    selectedRoles: RoleChoice[];
    acceptedTerms: boolean;              setAcceptedTerms: (v: boolean) => void;
    acceptedPrivacy: boolean;            setAcceptedPrivacy: (v: boolean) => void;
    acceptedDataSharing: boolean;        setAcceptedDataSharing: (v: boolean) => void;
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

// ─── Admin Invite Flow ────────────────────────────────────────────────────────

function AdminInviteFlow({
                             invite,
                             onSuccess,
                         }: {
    invite:     any;
    onSuccess:  () => void;
}) {
    const [adminStep,     setAdminStep]     = useState<AdminStep>("check-email");
    const [adminEmail,    setAdminEmail]    = useState<string>(invite.email ?? "");
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [err,           setErr]           = useState<string | null>(null);
    const [busy,          setBusy]          = useState(false);
    const [password,      setPassword]      = useState("");
    const [showPassword,  setShowPassword]  = useState(false);
    const [signedInUid,   setSignedInUid]   = useState<string | null>(null);
    const [mobileValue,   setMobileValue]   = useState("");
    const [mobileValid,   setMobileValid]   = useState(false);
    const [fullName,           setFullName]           = useState("");
    const [newPassword,        setNewPassword]        = useState("");
    const [confirmPassword,    setConfirmPassword]    = useState("");
    const [showNewPassword,    setShowNewPassword]    = useState(false);
    const [showConfirmPassword,setShowConfirmPassword]= useState(false);
    const [regMobileValue,     setRegMobileValue]     = useState("");
    const [regMobileValid,     setRegMobileValid]     = useState(false);
    const [acceptedTerms,      setAcceptedTerms]      = useState(false);
    const [acceptedPrivacy,    setAcceptedPrivacy]    = useState(false);

    const assignAdminRoleSecure = httpsCallable(functions, "assignAdminRole");

    async function onCheckEmail() {
        const cleanEmail = adminEmail.trim().toLowerCase();
        if (!cleanEmail.includes("@")) { setErr("Please enter a valid email address."); return; }
        if (cleanEmail !== invite.email?.toLowerCase()) { setErr("This invite is restricted to: " + invite.email); return; }
        setErr(null);
        setCheckingEmail(true);
        try {
            const checkEmailExists = httpsCallable(functions, "checkEmailExists");
            const result = await checkEmailExists({ email: cleanEmail });
            setAdminStep((result.data as { exists: boolean }).exists ? "sign-in" : "register");
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Could not check email."));
        } finally {
            setCheckingEmail(false);
        }
    }

    async function onSignInAndAddRole() {
        setErr(null); setBusy(true);
        try {
            const cleanEmail = adminEmail.trim().toLowerCase();
            const cred = await signInEmail(cleanEmail, password);
            const profile = await getUserProfile(cred.user.uid);
            const hasMobile = !!(profile?.mobile?.replace(/\s/g, "").length >= 7);
            if (!hasMobile) { setSignedInUid(cred.user.uid); setAdminStep("add-mobile"); return; }
            await assignAdminRoleSecure({ inviteId: invite.id });
            onSuccess();
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Sign-in or invite assignment failed."));
        } finally {
            setBusy(false);
        }
    }

    async function onSaveMobileAndFinish() {
        if (!signedInUid || !mobileValid) return;
        setErr(null); setBusy(true);
        try {
            await upsertUserProfile(signedInUid, { mobile: mobileValue.trim(), updatedAt: new Date().toISOString() });
            await assignAdminRoleSecure({ inviteId: invite.id });
            onSuccess();
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Could not save mobile or process invite."));
        } finally {
            setBusy(false);
        }
    }

    async function onRegisterAndAddRole() {
        setErr(null);
        if (newPassword !== confirmPassword) { setErr("Passwords do not match."); return; }
        if (!acceptedTerms || !acceptedPrivacy) { setErr("Please accept the required consents."); return; }
        if (!regMobileValid) { setErr("Please enter a valid mobile number."); return; }
        setBusy(true);
        try {
            const cleanEmail = adminEmail.trim().toLowerCase();
            const name = normalizeFullName(fullName);
            const now  = new Date().toISOString();
            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, newPassword);
            await updateProfile(cred.user, { displayName: name });
            await sendVerificationEmail(cleanEmail);
            await upsertUserProfile(cred.user.uid, {
                uid: cred.user.uid, email: cred.user.email ?? cleanEmail,
                fullName: name, displayName: name, mobile: regMobileValue.trim(),
                status: { isActive: true, isVerified: false },
                consent: { termsAcceptedAt: now, privacyAcceptedAt: now, givenBy: "self", givenByUid: cred.user.uid, updatedAt: now },
                createdAt: now, updatedAt: now,
            });
            await assignAdminRoleSecure({ inviteId: invite.id });
            await signOut(auth);
            onSuccess();
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Registration failed."));
        } finally {
            setBusy(false);
        }
    }

    const canRegister =
        normalizeFullName(fullName).length >= 2 &&
        newPassword.length >= 6 &&
        newPassword === confirmPassword &&
        regMobileValid &&
        acceptedTerms &&
        acceptedPrivacy;

    const step2Label =
        adminStep === "sign-in"    ? "Sign In" :
            adminStep === "add-mobile" ? "Add Mobile" :
                adminStep === "register"   ? "Create Account" : "Account";

    return (
        <div className="form">
            <div className="consent-steps" style={{ marginBottom: "1rem" }}>
                <span className={`consent-step ${adminStep === "check-email" ? "active" : "complete"}`}>1. Verify Email</span>
                <span className="consent-step-divider">›</span>
                <span className={`consent-step ${adminStep !== "check-email" ? "active" : ""}`}>2. {step2Label}</span>
            </div>

            {err && <p className="error">{err}</p>}

            {adminStep === "check-email" && (
                <>
                    <p className="muted">You've been invited to manage a host event. Enter the email address this invite was sent to.</p>
                    <label>Email</label>
                    <input type="email" value={adminEmail} onChange={(e) => { setAdminEmail(e.target.value); setErr(null); }} placeholder={invite.email ?? "your@email.com"} />
                    <button className="auth-login-btn" style={{ marginTop: "0.75rem" }} disabled={checkingEmail || adminEmail.trim().length < 5} onClick={onCheckEmail}>
                        {checkingEmail ? "Checking…" : "Continue →"}
                    </button>
                </>
            )}

            {adminStep === "sign-in" && (
                <>
                    <p className="muted">We found an existing account for <b>{adminEmail}</b>. Sign in to add this host event to your admin role.</p>
                    <label>Password</label>
                    <div className="password-wrapper">
                        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
                        <button type="button" className={`toggle-password ${showPassword ? "active" : ""}`} onClick={() => setShowPassword(v => !v)}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        </button>
                    </div>
                    <div className="auth-row" style={{ marginTop: "1rem", gap: "0.75rem" }}>
                        <button className="btn-secondary" onClick={() => { setAdminStep("check-email"); setPassword(""); setErr(null); }} disabled={busy}>← Back</button>
                        <button className="auth-login-btn" disabled={password.length < 6 || busy} onClick={onSignInAndAddRole}>{busy ? "Signing in…" : "Sign In & Accept Invite"}</button>
                    </div>
                </>
            )}

            {adminStep === "add-mobile" && (
                <>
                    <p className="muted">Your account doesn't have a mobile number on file. Admins require a contact number — please add one to continue.</p>
                    <label>Mobile Number</label>
                    <PhoneInput value={mobileValue} onChange={(val, valid) => { setMobileValue(val); setMobileValid(valid); }} />
                    <div className="auth-row" style={{ marginTop: "1rem", gap: "0.75rem" }}>
                        <button className="btn-secondary" onClick={() => { setAdminStep("sign-in"); setErr(null); }} disabled={busy}>← Back</button>
                        <button className="auth-login-btn" disabled={!mobileValid || busy} onClick={onSaveMobileAndFinish}>{busy ? "Saving…" : "Save & Accept Invite"}</button>
                    </div>
                </>
            )}

            {adminStep === "register" && (
                <>
                    <p className="muted">No account found for <b>{adminEmail}</b>. Create one below to accept your host admin invite.</p>
                    <label>Full Name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                    <label>Mobile Number</label>
                    <PhoneInput value={regMobileValue} onChange={(val, valid) => { setRegMobileValue(val); setRegMobileValid(valid); }} />
                    <label>Password</label>
                    <div className="password-wrapper">
                        <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
                        <button type="button" className={`toggle-password ${showNewPassword ? "active" : ""}`} onClick={() => setShowNewPassword(v => !v)}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        </button>
                    </div>
                    <label>Confirm Password</label>
                    <div className="password-wrapper">
                        <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
                        <button type="button" className={`toggle-password ${showConfirmPassword ? "active" : ""}`} onClick={() => setShowConfirmPassword(v => !v)}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="error" style={{ marginTop: 0 }}>Passwords do not match.</p>
                    )}
                    <div className="terms-checkbox" style={{ marginTop: "1rem" }}>
                        <label><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />I agree to the terms and conditions<span className="required-badge">Required</span></label>
                        <label><input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />I agree to the privacy policy<span className="required-badge">Required</span></label>
                    </div>
                    <div className="auth-row" style={{ marginTop: "1rem", gap: "0.75rem" }}>
                        <button className="btn-secondary" onClick={() => { setAdminStep("check-email"); setErr(null); }} disabled={busy}>← Back</button>
                        <button className="auth-login-btn" disabled={!canRegister || busy} onClick={onRegisterAndAddRole}>{busy ? "Creating…" : "Create Account & Accept Invite"}</button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Main AuthPage ────────────────────────────────────────────────────────────

export default function AuthPage() {
    const navigate      = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteId      = searchParams.get("adminInvite");

    const goAfterAuth = () => {
        const raw = searchParams.get("returnTo");
        if (!raw) { navigate("/"); return; }
        let path = raw;
        try { path = decodeURIComponent(raw); } catch {}
        if (!path.startsWith("/")) { navigate("/"); return; }
        navigate(path);
    };

    const [mode,               setMode]               = useState<Mode>("signin");
    const [email,              setEmail]              = useState("");
    const [password,           setPassword]           = useState("");
    const [confirmPassword,    setConfirmPassword]    = useState("");
    const [showPassword,       setShowPassword]       = useState(false);
    const [showConfirmPassword,setShowConfirmPassword]= useState(false);
    const [fullName,           setFullName]           = useState("");
    const [err,                setErr]                = useState<string | null>(null);
    const [busy,               setBusy]               = useState(false);
    const [verificationSent,   setVerificationSent]   = useState(false);
    const [successType,        setSuccessType]        = useState<"email" | "parent" | "admin-existing" | "admin-new" | null>(null);
    const [adminInvite,        setAdminInvite]        = useState<any | null>(null);
    const [unverifiedEmail,    setUnverifiedEmail]    = useState<string | null>(null);
    const [resendCooldown,     setResendCooldown]     = useState(0);
    const [resendCount,        setResendCount]        = useState(0);
    const [resendSent,         setResendSent]         = useState(false);
    const [lockedOut,          setLockedOut]          = useState(false);

    const [wizardStep,    setWizardStep]    = useState<1 | 2 | 3>(1);
    const [selectedRoles, setSelectedRoles] = useState<RoleChoice[]>(["rower"]);
    const [roleDetails,   setRoleDetails]   = useState<RoleDetails>(defaultRoleDetails());

    const [acceptedTerms,               setAcceptedTerms]               = useState(false);
    const [acceptedPrivacy,             setAcceptedPrivacy]             = useState(false);
    const [acceptedDataSharing,         setAcceptedDataSharing]         = useState(false);
    const [acceptedPerformanceTracking, setAcceptedPerformanceTracking] = useState(false);

    const loc = useLocation();

    useEffect(() => {
        if (!loc.state) return;
        const s = loc.state as any;
        setEmail(s.email || "");
        setPassword(s.password || "");
        setFullName(s.fullName || "");
        if (s.mode === "register" || s.mode === "signin") setMode(s.mode);
    }, [loc.state]);

    useEffect(() => {
        if (!inviteId) return;
        fetchAdminInvite(inviteId).then((invite) => {
            if (!invite || invite.used) return;
            setAdminInvite(invite);
            setMode("register");
        });
    }, [inviteId]);

    const canSignIn = useMemo(
        () => email.trim().length > 0 && password.trim().length > 0,
        [email, password]
    );

    // ── CHANGED: club validation now checks ClubSelection object, not string length
    const step2Valid = useMemo(() => {
        for (const role of selectedRoles) {
            if (role === "rower") {
                const r = roleDetails.rower!;
                if (!r.dateOfBirth) return false;
                // Club is optional — no validation required
                if (isMinor(r.dateOfBirth)) {
                    if (!r.parentEmail || !r.parentEmail.includes("@")) return false;
                    if (r.parentEmail.trim().toLowerCase() === email.trim().toLowerCase()) return false;
                }
            }
            if (role === "host" && roleDetails.host!.location.trim().length < 2) return false;
            // Coach club is optional — no validation required
        }
        return true;
    }, [selectedRoles, roleDetails, email]);

    const canRegister = useMemo(() => {
        if (email.trim().length === 0) return false;
        if (password.trim().length < 6) return false;
        if (password !== confirmPassword) return false;
        if (normalizeFullName(fullName).length < 2) return false;
        if (!acceptedTerms || !acceptedPrivacy) return false;
        if (selectedRoles.includes("rower") && !acceptedPerformanceTracking) return false;
        return step2Valid;
    }, [email, password, fullName, confirmPassword, acceptedTerms, acceptedPrivacy, acceptedPerformanceTracking, selectedRoles, step2Valid]);

    function clearForm() {
        setEmail(""); setPassword(""); setFullName(""); setConfirmPassword("");
        setSelectedRoles(["rower"]); setRoleDetails(defaultRoleDetails());
        setWizardStep(1); setErr(null);
    }

    async function onSignIn() {
        setErr(null); setUnverifiedEmail(null); setResendSent(false); setBusy(true);
        try {
            const cred = await signInEmail(email.trim(), password);
            if (!cred.user.emailVerified) {
                await signOut(auth);
                setUnverifiedEmail(email.trim());
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
            const msg = e?.message ?? "";
            if (msg.includes("auth/too-many-requests")) { setLockedOut(true); setErr(null); }
            else setErr(friendlyError(msg));
        } finally {
            setBusy(false);
        }
    }

    async function onResendVerification() {
        if (resendCooldown > 0 || resendCount >= 3) return;
        setErr(null); setResendSent(false); setBusy(true);
        try {
            await sendVerificationEmail(unverifiedEmail!);
            setResendSent(true);
            setResendCount(c => c + 1);
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
            const name       = normalizeFullName(fullName);

            const pendingExists = await checkPendingUserExists(cleanEmail);
            if (pendingExists) {
                setErr("A consent request for this email is already pending. Please ask your parent or guardian to check their inbox (including spam).");
                return;
            }

            const rowerMinor =
                selectedRoles.includes("rower") &&
                isMinor(roleDetails.rower!.dateOfBirth);

            if (rowerMinor) {
                const r = roleDetails.rower!;
                const pendingId = await createPendingUser({
                    email:       cleanEmail,
                    fullName:    name,
                    dateOfBirth: r.dateOfBirth,
                    parentEmail: r.parentEmail,
                    // ── CHANGED: pass clubId instead of club string
                    clubId:      r.club?.clubId,
                    gender:      r.gender,
                });
                await sendParentConsentEmail(pendingId);
                setSuccessType("parent");
                setVerificationSent(true);
                return;
            }

            const checkEmailExists = httpsCallable(functions, "checkEmailExists");
            const result = await checkEmailExists({ email: cleanEmail });
            if ((result.data as { exists: boolean }).exists) {
                throw new Error("An account with this email already exists. Try signing in instead.");
            }

            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            await updateProfile(cred.user, { displayName: name });
            await sendVerificationEmail(cleanEmail);

            const now = new Date().toISOString();

            await upsertUserProfile(cred.user.uid, {
                uid:         cred.user.uid,
                email:       cred.user.email ?? cleanEmail,
                fullName:    name,
                displayName: name,
                gender:      selectedRoles.includes("rower") ? roleDetails.rower!.gender      : undefined,
                dateOfBirth: selectedRoles.includes("rower") ? roleDetails.rower!.dateOfBirth : undefined,
                birthYear:   selectedRoles.includes("rower") ? Number(roleDetails.rower!.dateOfBirth.slice(0, 4)) : undefined,
                isMinor:     false,
                consent: {
                    termsAcceptedAt:             now,
                    privacyAcceptedAt:           now,
                    performanceTrackingAccepted: acceptedPerformanceTracking,
                    dataSharingAccepted:         acceptedDataSharing,
                    givenBy:    "self",
                    givenByUid: cred.user.uid,
                    updatedAt:  now,
                },
                permissions: {
                    shareWithCoaches:      false,
                    shareWithUniversities: false,
                    shareWithFederations:  false,
                },
                status:    { isActive: true, isVerified: false },
                createdAt: now,
            });

            // ── CHANGED: setupUserRoles now receives clubId instead of club string.
            // The Cloud Function calls joinClub internally for each role that has a clubId.
            const setupUserRoles = httpsCallable(functions, "setupUserRoles");
            await setupUserRoles({
                roles: selectedRoles,
                roleDetails: {
                    rower:  selectedRoles.includes("rower")  ? { clubId: roleDetails.rower!.club?.clubId ?? null }     : undefined,
                    coach:  selectedRoles.includes("coach")  ? { clubId: roleDetails.coach!.club?.clubId ?? null }     : undefined,
                    host:   selectedRoles.includes("host")   ? { location: roleDetails.host!.location.trim() }        : undefined,
                },
            });

            await signOut(auth);
            setSuccessType("email");
            setVerificationSent(true);
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Registration failed"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <div className="page-container">
                <Navbar />
                <div className="page-content">
                    <main>
                        <div className="card auth-card">

                            {verificationSent ? (
                                <>
                                    {successType === "email" && (
                                        <>
                                            <h3>Verify your email</h3>
                                            <p className="muted">We've sent a verification link to <b>{email}</b>. Please verify your account before signing in.</p>
                                            <div className="row auth-footer-actions">
                                                <button className="btn-primary" onClick={() => { clearForm(); setMode("signin"); setVerificationSent(false); }}>Back to sign in</button>
                                            </div>
                                        </>
                                    )}
                                    {successType === "parent" && (
                                        <>
                                            <h3>Parental approval required</h3>
                                            <p className="muted">A consent request has been sent to <b>{roleDetails.rower?.parentEmail}</b>. Your account will be activated once your parent or guardian approves it.</p>
                                        </>
                                    )}
                                    {successType === "admin-existing" && (
                                        <>
                                            <h3>Host event added ✓</h3>
                                            <p className="muted">The new host event has been added to your admin account. You can sign in to manage it now.</p>
                                            <div className="row auth-footer-actions">
                                                <button className="btn-primary" onClick={() => { clearForm(); setMode("signin"); setVerificationSent(false); }}>Go to sign in</button>
                                            </div>
                                        </>
                                    )}
                                    {successType === "admin-new" && (
                                        <>
                                            <h3>Account created ✓</h3>
                                            <p className="muted">We've sent a verification link to <b>{adminInvite?.email}</b>. Please verify your email before signing in.</p>
                                            <div className="row auth-footer-actions">
                                                <button className="btn-primary" onClick={() => { clearForm(); setMode("signin"); setVerificationSent(false); }}>Back to sign in</button>
                                            </div>
                                        </>
                                    )}
                                </>

                            ) : mode === "signin" ? (
                                <>
                                    <h3>LOGIN</h3>
                                    {lockedOut && (
                                        <div className="alert alert-warning">
                                            <strong>Account temporarily locked.</strong>
                                            <p>Too many failed attempts. Wait a few minutes and try again, or{" "}
                                                <Link to="/forgot-password">reset your password</Link> to unlock immediately.
                                            </p>
                                        </div>
                                    )}
                                    {err && <p className="error">{err}</p>}
                                    {unverifiedEmail && (
                                        <div className="resend-verification">
                                            {resendCount >= 3 ? (
                                                <p className="muted">Maximum resend attempts reached. Check your spam folder or contact support.</p>
                                            ) : resendSent ? (
                                                <p className="muted">Verification email sent to <b>{unverifiedEmail}</b>. {` Please wait to resend again`}</p>
                                            ) : (
                                                <p className="muted">Didn't receive a verification email?</p>
                                            )}
                                            {resendCount < 3 && (
                                                <button className="btn-secondary" disabled={resendCooldown > 0 || busy} onClick={onResendVerification}>
                                                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resendSent ? "Resend again" : "Resend verification email"}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="form">
                                        <label>Email</label>
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                        <label>Password</label>
                                        <div className="password-wrapper">
                                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
                                            <button type="button" className={`toggle-password ${showPassword ? "active" : ""}`} onClick={() => setShowPassword(!showPassword)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Link to="/forgot-password">Forgot password?</Link>
                                        <div className="auth-actions">
                                            <div className="auth-row">
                                                <button className="auth-login-btn" disabled={!canSignIn || busy} onClick={onSignIn}>SIGN IN</button>
                                                <div className="auth-links">
                                                    <div className="auth-register">
                                                        <span>Don't have an account?</span>
                                                        <button className="btn-secondary" onClick={() => { setMode("register"); setWizardStep(1); setErr(null); }}>CREATE ONE</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>

                            ) : adminInvite ? (
                                <>
                                    <h3>ADMIN INVITE</h3>
                                    <p className="muted" style={{ marginBottom: "0.5rem" }}>You've been invited to manage a host event.</p>
                                    <AdminInviteFlow invite={adminInvite} onSuccess={() => { setSuccessType("admin-existing"); setVerificationSent(true); }} />
                                </>

                            ) : (
                                <>
                                    <h3>REGISTER</h3>
                                    {err && <p className="error">{err}</p>}

                                    {wizardStep === 1 && (
                                        <div className="form" style={{ marginBottom: "1rem" }}>
                                            <label>Email</label>
                                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                            <label>Password</label>
                                            <div className="password-wrapper">
                                                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                                                <button type="button" className={`toggle-password ${showPassword ? "active" : ""}`} onClick={() => setShowPassword(!showPassword)}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <label style={{ marginTop: "0.75rem" }}>Confirm Password</label>
                                            <div className="password-wrapper">
                                                <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" />
                                                <button type="button" className={`toggle-password ${showConfirmPassword ? "active" : ""}`} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FEB959" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle className="pupil" cx="12" cy="12" r="3" /><line className="slash" x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {confirmPassword.length > 0 && password !== confirmPassword && (
                                                <p className="error" style={{ marginTop: 0 }}>Passwords do not match.</p>
                                            )}
                                            <label>Full name</label>
                                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                                        </div>
                                    )}

                                    <WizardSteps step={wizardStep} />

                                    <div className="form" style={{ marginTop: "1rem" }}>
                                        {wizardStep === 1 && <StepPickRoles selectedRoles={selectedRoles} onChange={setSelectedRoles} />}
                                        {wizardStep === 2 && (
                                            <StepRoleDetails
                                                selectedRoles={selectedRoles}
                                                details={roleDetails}
                                                onChange={setRoleDetails}
                                                userEmail={email}
                                            />
                                        )}
                                        {wizardStep === 3 && (
                                            <StepConsent
                                                selectedRoles={selectedRoles}
                                                acceptedTerms={acceptedTerms}                     setAcceptedTerms={setAcceptedTerms}
                                                acceptedPrivacy={acceptedPrivacy}                 setAcceptedPrivacy={setAcceptedPrivacy}
                                                acceptedDataSharing={acceptedDataSharing}         setAcceptedDataSharing={setAcceptedDataSharing}
                                                acceptedPerformanceTracking={acceptedPerformanceTracking} setAcceptedPerformanceTracking={setAcceptedPerformanceTracking}
                                            />
                                        )}

                                        <div className="auth-actions" style={{ marginTop: "1.25rem" }}>
                                            <div className="auth-row">
                                                {wizardStep > 1 && (
                                                    <button className="btn-secondary" onClick={() => setWizardStep(s => (s - 1) as any)}>BACK</button>
                                                )}
                                                {wizardStep < 3 ? (
                                                    <button
                                                        className="auth-login-btn"
                                                        disabled={
                                                            wizardStep === 1
                                                                ? selectedRoles.length === 0 ||
                                                                email.trim().length === 0 ||
                                                                password.trim().length < 6 ||
                                                                password !== confirmPassword ||
                                                                normalizeFullName(fullName).length < 2
                                                                : !step2Valid
                                                        }
                                                        onClick={() => setWizardStep(s => (s + 1) as any)}
                                                    >
                                                        NEXT
                                                    </button>
                                                ) : (
                                                    <button className="auth-login-btn" disabled={!canRegister || busy} onClick={onRegister}>
                                                        {busy ? "CREATING…" : "CREATE ACCOUNT"}
                                                    </button>
                                                )}
                                                <div className="auth-links">
                                                    <div className="auth-register">
                                                        <span>Already have an account?</span>
                                                        <button className="btn-secondary" onClick={() => { setMode("signin"); setWizardStep(1); }}>SIGN IN</button>
                                                    </div>
                                                </div>
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