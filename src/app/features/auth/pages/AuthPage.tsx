import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";
import { upsertUserProfile } from "../api/users";
import { signInEmail, signInGoogle } from "../api/auth";

type Mode = "signin" | "register";
type RoleChoice = "rower" | "host";

function friendlyError(message: string) {
    const m = message.toLowerCase();
    if (m.includes("auth/invalid-credential") || m.includes("auth/wrong-password")) return "Incorrect email or password.";
    if (m.includes("auth/user-not-found")) return "No account found for that email.";
    if (m.includes("auth/email-already-in-use")) return "That email is already in use. Try signing in instead.";
    if (m.includes("auth/weak-password")) return "Password is too weak. Please use at least 6 characters.";
    if (m.includes("auth/invalid-email")) return "Please enter a valid email address.";
    return message || "Something went wrong.";
}

export default function AuthPage() {
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>("signin");

    // shared fields
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // register-only fields
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<RoleChoice>("rower");

    // rower fields
    const [club, setClub] = useState("");
    const [coach, setCoach] = useState("");

    // host fields
    const [location, setLocation] = useState("");

    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canSignIn = useMemo(() => email.trim() && password.trim().length >= 1, [email, password]);

    const canRegister = useMemo(() => {
        if (!email.trim() || password.trim().length < 6) return false;
        if (!displayName.trim()) return false;

        if (role === "rower") {
            // allow blanks if you want, but this keeps it cleaner
            return club.trim().length >= 2;
        }
        // host
        return location.trim().length >= 2;
    }, [email, password, displayName, role, club, location]);

    async function onGoogle() {
        setErr(null);
        setBusy(true);
        try {
            await signInGoogle();
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
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

            const name = displayName.trim();
            if (name) {
                await updateProfile(cred.user, { displayName: name });
            }

            const base = {
                email: cred.user.email ?? email.trim(),
                displayName: name || cred.user.displayName || "",
                roles: {} as any,
            };

            if (role === "rower") {
                base.roles.rower = { club: club.trim(), coach: coach.trim() };
            } else {
                base.roles.host = { name: base.displayName, email: base.email, location: location.trim() };
            }

            await upsertUserProfile(cred.user.uid, base);

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
                <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
                    <div className="space-between">
                        <div>
                            <h1 style={{ margin: 0 }}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
                            <p style={{ marginTop: 6 }}>
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

                        <div className="row" style={{ marginTop: 10 }}>
                            <button type="button" className="btn-primary" onClick={onGoogle} disabled={busy}>
                                {busy ? "Working…" : "Continue with Google"}
                            </button>
                            <span className="muted">Recommended</span>
                        </div>
                    </div>

                    <div className="muted" style={{ marginTop: 12, fontWeight: 700 }}>
                        Or use email
                    </div>

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
                                Name
                                <input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="e.g. Andrew O'Connor"
                                    autoComplete="name"
                                />
                            </label>

                            <div className="card card--tight" style={{ marginTop: 12 }}>
                                <div className="space-between">
                                    <h3>Role</h3>
                                    <span className="badge">You can add more later</span>
                                </div>

                                <div className="row" style={{ marginTop: 10 }}>
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
                                    <div style={{ marginTop: 10 }}>
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
                                    <div style={{ marginTop: 10 }}>
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
                        <div className="card card--tight" style={{ marginTop: 12, borderColor: "rgba(225, 29, 72, 0.35)" }}>
                            <div style={{ color: "#9f1239", fontWeight: 800 }}>Oops</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                                {err}
                            </div>
                        </div>
                    )}

                    <div className="row" style={{ marginTop: 14 }}>
                        {mode === "signin" ? (
                            <button type="button" className="btn-primary" onClick={onSignIn} disabled={!canSignIn || busy}>
                                {busy ? "Signing in…" : "Sign in"}
                            </button>
                        ) : (
                            <button type="button" className="btn-primary" onClick={onRegister} disabled={!canRegister || busy}>
                                {busy ? "Creating…" : "Create account"}
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                                setEmail("");
                                setPassword("");
                                setErr(null);
                            }}
                            disabled={busy}
                        >
                            Clear
                        </button>

                        <span className="muted" style={{ fontWeight: 700 }}>
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

                    <div className="muted" style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>
                        By continuing, you agree to our terms. (Placeholder copy.)
                    </div>
                </div>

                <div className="muted" style={{ marginTop: 12, textAlign: "center" }}>
                    <span>Need help?</span>{" "}
                    <Link to="/" className="muted">
                        Go home
                    </Link>
                </div>
            </main>
        </>
    );
}
