import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";
import { upsertUserProfile } from "../api/users";

type RoleChoice = "rower" | "host";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<RoleChoice>("rower");

    // rower fields
    const [club, setClub] = useState("");
    const [coach, setCoach] = useState("");

    // host fields
    const [location, setLocation] = useState("");

    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function onRegister() {
        setErr(null);
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (displayName.trim()) {
                await updateProfile(cred.user, { displayName });
            }

            const base = {
                email: cred.user.email ?? email,
                displayName: displayName || cred.user.displayName || "",
                roles: {} as any,
            };

            if (role === "rower") {
                base.roles.rower = { club, coach };
            } else {
                base.roles.host = { name: displayName, email: base.email, location };
            }

            await upsertUserProfile(cred.user.uid, base);
        } catch (e: any) {
            setErr(e?.message ?? "Registration failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <h1>Register</h1>

                <label>
                    Name
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>

                <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>

                <label>
                    Password
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>

                <fieldset style={{ marginTop: 12 }}>
                    <legend>Choose role</legend>
                    <label>
                        <input
                            type="radio"
                            name="role"
                            checked={role === "rower"}
                            onChange={() => setRole("rower")}
                        />
                        Rower
                    </label>
                    <label style={{ marginLeft: 12 }}>
                        <input
                            type="radio"
                            name="role"
                            checked={role === "host"}
                            onChange={() => setRole("host")}
                        />
                        Event Host
                    </label>
                </fieldset>

                {role === "rower" ? (
                    <div style={{ marginTop: 12 }}>
                        <label>
                            Club
                            <input value={club} onChange={(e) => setClub(e.target.value)} />
                        </label>
                        <label>
                            Coach
                            <input value={coach} onChange={(e) => setCoach(e.target.value)} />
                        </label>
                    </div>
                ) : (
                    <div style={{ marginTop: 12 }}>
                        <label>
                            Host Location
                            <input value={location} onChange={(e) => setLocation(e.target.value)} />
                        </label>
                    </div>
                )}

                {err && <p style={{ color: "crimson" }}>{err}</p>}

                <button disabled={busy} onClick={onRegister} style={{ marginTop: 12 }}>
                    {busy ? "Creating..." : "Create account"}
                </button>
            </main>
        </>
    );
}
