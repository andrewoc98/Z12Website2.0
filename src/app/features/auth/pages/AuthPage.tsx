import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    signOut
} from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";
import { fetchAdminInvite, markAdminInviteUsed, upsertUserProfile } from "../api/users";
import { signInEmail } from "../api/auth";
import "../../../shared/styles/globals.css"
import "../styles/auth.css"
import Footer from "../../../shared/components/Footer/Footer.tsx";

type Mode = "signin" | "register";
type RoleChoice = "rower" | "host" | "coach";

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
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

export default function AuthPage() {

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const inviteId = searchParams.get("adminInvite");
    const isAdminInvite = Boolean(inviteId);

    const goAfterAuth = () => {
        const raw = searchParams.get("returnTo");

        if (!raw) {
            navigate("/");
            return;
        }

        let path = raw;

        try {
            path = decodeURIComponent(raw);
        } catch {}

        if (!path.startsWith("/")) {
            navigate("/");
            return;
        }

        navigate(path);
    };

    const [mode, setMode] = useState<Mode>("signin");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<RoleChoice>("rower");

    const [gender, setGender] = useState<"male" | "female">("male");
    const [dateOfBirth, setDateOfBirth] = useState("");

    const [club, setClub] = useState("");
    const [location, setLocation] = useState("");

    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    const [adminInvite, setAdminInvite] = useState<any | null>(null);

    useEffect(() => {
        if (!inviteId) return;

        fetchAdminInvite(inviteId).then(invite => {
            if (!invite || invite.used) return;
            setAdminInvite(invite);
            setMode("register");
        });
    }, [inviteId]);

    useEffect(() => {
        if (adminInvite) {
            setEmail(adminInvite.email);
            setRole("admin" as any);
        }
    }, [adminInvite]);

    const canSignIn = useMemo(
        () => email.trim().length > 0 && password.trim().length > 0,
        [email, password]
    );

    const canRegister = useMemo(() => {

        const cleanEmail = email.trim();
        const name = normalizeFullName(fullName);

        if (!cleanEmail) return false;
        if (password.trim().length < 6) return false;
        if (name.length < 2) return false;

        if (role === "rower" && !dateOfBirth) return false;

        if (isAdminInvite) return true;

        if (role === "rower" || role === "coach")
            return club.trim().length >= 2;

        if (role === "host")
            return location.trim().length >= 2;

        return false;

    }, [email, password, fullName, role, club, location, dateOfBirth, isAdminInvite]);

    function clearForm() {
        setEmail("");
        setPassword("");
        setFullName("");
        setRole("rower");
        setClub("");
        setLocation("");
        setErr(null);
    }

    async function onSignIn() {

        setErr(null);
        setBusy(true);

        try {

            const cred = await signInEmail(email.trim(), password);

            if (!cred.user.emailVerified) {
                await signOut(auth);
                setErr("Please verify your email before signing in.");
                return;
            }

            goAfterAuth();

        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Sign-in failed"));
        } finally {
            setBusy(false);
        }
    }

    async function onRegister() {

        setErr(null);
        setBusy(true);

        try {

            const cleanEmail = email.trim().toLowerCase();
            const name = normalizeFullName(fullName);

            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

            await updateProfile(cred.user, { displayName: name });

            await sendEmailVerification(cred.user);

            const profileBase: any = {
                uid: cred.user.uid,
                email: cred.user.email ?? cleanEmail,
                fullName: name,
                displayName: name,
                primaryRole: role,
                roles: {},
            };

            if (adminInvite) {

                if (cleanEmail !== adminInvite.email)
                    throw new Error("This invite is restricted to a specific email.");

                profileBase.primaryRole = "admin";
                profileBase.inviteId = adminInvite.id;

                profileBase.roles.admin = {
                    hostId: adminInvite.hostId,
                };

            } else if (role === "rower") {

                profileBase.gender = gender;
                profileBase.dateOfBirth = dateOfBirth;
                profileBase.birthYear = Number(dateOfBirth.slice(0, 4));

                profileBase.roles.rower = {
                    club: club.trim(),
                };

            } else if (role === "coach") {

                profileBase.roles.coach = {
                    club: club.trim(),
                };

            } else if (role === "host") {

                profileBase.roles.host = {
                    location: location.trim(),
                };
            }

            await upsertUserProfile(cred.user.uid, profileBase);

            if (adminInvite)
                await markAdminInviteUsed(adminInvite.id);

            await signOut(auth);

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
                            <h3>Verify your email</h3>

                            <p className="muted">
                                We've sent a verification link to <b>{email}</b>.
                                Please check your inbox and verify your account before signing in.
                            </p>

                            <div className="row auth-footer-actions">
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        clearForm();
                                        setMode("signin");
                                        setVerificationSent(false);
                                    }}
                                >
                                    Back to sign in
                                </button>
                            </div>
                        </>

                    ) : (

                        <>
                            <h3>{mode === "signin" ? "LOGIN" : "REGISTER"}</h3>

                            {err && <p className="error">{err}</p>}

                            <div className="form">

                                <label>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />

                                <label>Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                {mode === "signin" && (<Link to="/forgot-password">Forgot password?</Link>)}

                                {mode === "register" && (
                                    <>
                                        <label>Full name</label>
                                        <input
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />

                                        <label>Role</label>
                                        <select
                                            value={role}
                                            onChange={(e) => setRole(e.target.value as RoleChoice)}
                                        >
                                            <option value="rower">Rower</option>
                                            <option value="coach">Coach</option>
                                            <option value="host">Host</option>
                                        </select>

                                        {role === "rower" && (
                                            <>
                                                <label>Gender</label>
                                                <select
                                                    value={gender}
                                                    onChange={(e) => setGender(e.target.value as any)}
                                                >
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                </select>

                                                <label>Date of Birth</label>
                                                <input
                                                    type="date"
                                                    value={dateOfBirth}
                                                    onChange={(e) => setDateOfBirth(e.target.value)}
                                                />

                                                <label>Club</label>
                                                <input
                                                    value={club}
                                                    onChange={(e) => setClub(e.target.value)}
                                                />
                                            </>
                                        )}

                                        {role === "coach" && (
                                            <>
                                                <label>Club</label>
                                                <input
                                                    value={club}
                                                    onChange={(e) => setClub(e.target.value)}
                                                />
                                            </>
                                        )}

                                        {role === "host" && (
                                            <>
                                                <label>Location</label>
                                                <input
                                                    value={location}
                                                    onChange={(e) => setLocation(e.target.value)}
                                                />
                                            </>
                                        )}
                                    </>
                                )}

                                <div className="auth-actions">

                                    {mode === "signin" ? (
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

                                                    <button
                                                        className="btn-secondary"
                                                        onClick={() => setMode("register")}
                                                    >
                                                        CREATE ONE
                                                    </button>
                                                </div>

                                            </div>

                                        </div>
                                    ) : (
                                        <div className="auth-row">

                                            <button
                                                className="auth-login-btn"
                                                disabled={!canRegister || busy}
                                                onClick={onRegister}
                                            >
                                                CREATE ACCOUNT
                                            </button>

                                            <div className="auth-links">

                                                <div className="auth-register">
                                                    <span>Already have an account?</span>

                                                    <button
                                                        className="btn-secondary"
                                                        onClick={() => setMode("signin")}
                                                    >
                                                        SIGN IN
                                                    </button>
                                                </div>

                                            </div>

                                        </div>
                                    )}

                                </div>

                            </div>
                        </>
                    )}

                </div>
            </main>
            </div>
            <Footer/>
        </div>
        </>
    );
}