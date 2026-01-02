import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";
import { upsertUserProfile } from "../api/users";
import { signInEmail, signInGoogle } from "../api/auth";
import type { UserProfile } from "../types";

type Mode = "signin" | "register";
type RoleChoice = "rower" | "host";

function friendlyError(message: string) {
    const m = (message || "").toLowerCase();
    if (m.includes("auth/invalid-credential") || m.includes("auth/wrong-password")) return "Incorrect email or password.";
    if (m.includes("auth/user-not-found")) return "No account found for that email.";
    if (m.includes("auth/email-already-in-use")) return "That email is already in use. Try signing in instead.";
    if (m.includes("auth/weak-password")) return "Password is too weak. Please use at least 6 characters.";
    if (m.includes("auth/invalid-email")) return "Please enter a valid email address.";
    if (m.includes("auth/configuration-not-found"))
        return "Firebase Auth isn’t enabled for this project. In Firebase Console → Authentication → Sign-in method, enable Email/Password.";
    return message || "Something went wrong.";
}

function normalizeFullName(name: string) {
    return name.trim().replace(/\s+/g, " ");
}

export default function AuthPage() {
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>("signin");

    // shared
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // register-only
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<RoleChoice>("rower");

    // rower fields
    const [club, setClub] = useState("");
    const [coach, setCoach] = useState("");

    // host fields
    const [location, setLocation] = useState("");

    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canSignIn = useMemo(() => email.trim().length > 0 && password.trim().length > 0, [email, password]);

    const canRegister = useMemo(() => {
        const cleanEmail = email.trim();
        const name = normalizeFullName(fullName);

        if (!cleanEmail) return false;
        if (password.trim().length < 6) return false;
        if (name.length < 2) return false;

        if (role === "rower") return club.trim().length >= 2; // coach optional
        return location.trim().length >= 2;
    }, [email, password, fullName, role, club, location]);

    function clearForm() {
        setEmail("");
        setPassword("");
        setFullName("");
        setRole("rower");
        setClub("");
        setCoach("");
        setLocation("");
        setErr(null);
    }

    async function onGoogle() {
        setErr(null);
        setBusy(true);
        try {
            await signInGoogle();
            // AuthProvider ensures base profile exists for any provider.
            // If you want Google users to pick role, redirect to onboarding:
            // navigate("/onboarding");
            navigate("/");
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Google sign-in failed"));
        } finally {
            setBusy(false);
        }
    }

    async function onSignIn() {
        setErr(null);
        setBusy(true);
        try {
            await signInEmail(email.trim(), password);
            navigate("/");
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
            const cleanEmail = email.trim();
            const name = normalizeFullName(fullName);

            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

            // Use full name as auth displayName
            await updateProfile(cred.user, { displayName: name });

            const profile: UserProfile = {
                uid: cred.user.uid,
                email: cred.user.email ?? cleanEmail,
                fullName: name,
                displayName: name,
                primaryRole: role,
                roles:
                    role === "rower"
                        ? { rower: { club: club.trim(), coach: coach.trim() ? coach.trim() : undefined } }
                        : { host: { location: location.trim() } },
            };

            await upsertUserProfile(cred.user.uid, profile);
            navigate("/");
        } catch (e: any) {
            setErr(friendlyError(e?.message ?? "Registration failed"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card">
                    <div className="space-between">
                        <div>
                            <h1 className="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
                            <p className="auth-subtitle">
                                {mode === "signin"
                                    ? "Sign in to register boats, manage events, and view results."
                                    : "Join Z12 to sign up for events or host your own races."}
                            </p>
                        </div>

                        <div className="row">
                            <button
                                type="button"
                                className={mode === "signin" ? "btn-primary" : "btn-ghost"}
                                onClick={() => {
                                    setErr(null);
                                    setMode("signin");
                                }}
                                disabled={busy}
                            >
                                Sign in
                            </button>
                            <button
                                type="button"
                                className={mode === "register" ? "btn-primary" : "btn-ghost"}
                                onClick={() => {
                                    setErr(null);
                                    setMode("register");
                                }}
                                disabled={busy}
                            >
                                Register
                            </button>
                        </div>
                    </div>

                    <hr />

                    <div className="card card--tight">
                        <div className="space-between">
                            <h3>Quick sign-in</h3>
                            <span className="badge">Fastest</span>
                        </div>

                        <div className="row auth-actions">
                            <button type="button" className="btn-primary" onClick={onGoogle} disabled={busy}>
                                {busy ? "Working…" : "Continue with Google"}
                            </button>
                            <span className="muted auth-hint">Recommended</span>
                        </div>
                    </div>

                    <div className="muted auth-or">Or use email</div>

                    <label>
                        Email
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@email.com"
                            autoComplete="email"
                            inputMode="email"
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                            autoComplete={mode === "register" ? "new-password" : "current-password"}
                        />
                    </label>

                    {mode === "register" && (
                        <>
                            <label>
                                Full name
                                <input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="e.g. Andrew O'Connor"
                                    autoComplete="name"
                                />
                            </label>

                            <div className="card card--tight auth-role-card">
                                <div className="space-between">
                                    <h3>Role</h3>
                                    <span className="badge badge--brand">You can add more later</span>
                                </div>

                                <div className="row auth-role-actions">
                                    <button
                                        type="button"
                                        className={role === "rower" ? "btn-primary" : "btn-ghost"}
                                        onClick={() => setRole("rower")}
                                        disabled={busy}
                                    >
                                        Rower
                                    </button>
                                    <button
                                        type="button"
                                        className={role === "host" ? "btn-primary" : "btn-ghost"}
                                        onClick={() => setRole("host")}
                                        disabled={busy}
                                    >
                                        Event Host
                                    </button>
                                </div>

                                {role === "rower" ? (
                                    <div className="auth-role-fields">
                                        <label>
                                            Club
                                            <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="e.g. Z12 RC" />
                                        </label>

                                        <label>
                                            Coach (optional)
                                            <input value={coach} onChange={(e) => setCoach(e.target.value)} placeholder="e.g. Coach Sam" />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="auth-role-fields">
                                        <label>
                                            Host location
                                            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dublin" />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {err && (
                        <div className="card card--tight auth-error">
                            <div className="auth-error-title">Oops</div>
                            <div className="muted auth-error-msg">{err}</div>
                        </div>
                    )}

                    <div className="row auth-footer-actions">
                        {mode === "signin" ? (
                            <button type="button" className="btn-primary" onClick={onSignIn} disabled={!canSignIn || busy}>
                                {busy ? "Signing in…" : "Sign in"}
                            </button>
                        ) : (
                            <button type="button" className="btn-primary" onClick={onRegister} disabled={!canRegister || busy}>
                                {busy ? "Creating…" : "Create account"}
                            </button>
                        )}

                        <button type="button" className="btn-ghost" onClick={clearForm} disabled={busy}>
                            Clear
                        </button>

                        <span className="muted auth-switch">
              {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => {
                                    setErr(null);
                                    setMode(mode === "signin" ? "register" : "signin");
                                }}
                                disabled={busy}
                            >
                {mode === "signin" ? "Register" : "Sign in"}
              </button>
            </span>
                    </div>

                    <div className="muted auth-terms">By continuing, you agree to our terms. (Placeholder copy.)</div>
                </div>

                <div className="muted auth-help">
                    <span>Need help?</span>{" "}
                    <Link to="/" className="muted">
                        Go home
                    </Link>
                </div>
            </main>
        </>
    );
}
