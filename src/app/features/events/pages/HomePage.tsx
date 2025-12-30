import Navbar from "../../../shared/components/Navbar/Navbar";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";

export default function HomePage() {
    // In DEV_MODE we rely on mock auth. When DEV_MODE=false you’ll switch this page
    // to use the real Firebase auth hook (useAuth) again.
    const { user, loginAs, logout } = useMockAuth();

    return (
        <>
            <Navbar />
            <main>
                <h1>Z12 Rowing Events</h1>
                <p>
                    Welcome to Z12 rowing events. Sign in to register for events, manage timing,
                    or create events (depending on your role).
                </p>

                <hr style={{ margin: "16px 0" }} />

                {DEV_MODE && (
                    <section>
                        <h2>DEV: Quick Login</h2>

                        {user ? (
                            <>
                                <p>
                                    <b>Signed in as:</b> {user.displayName} ({user.email})
                                </p>

                                <p>
                                    <b>Roles:</b>{" "}
                                    {Object.keys(user.roles).length
                                        ? Object.keys(user.roles).join(", ")
                                        : "none"}
                                </p>

                                <button onClick={logout}>Log out</button>
                            </>
                        ) : (
                            <>
                                <p>Pick a role to simulate sign-in:</p>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button onClick={() => loginAs("rower")}>Login as Rower</button>
                                    <button onClick={() => loginAs("host")}>Login as Host</button>
                                    <button onClick={() => loginAs("admin")}>Login as Admin</button>
                                </div>
                            </>
                        )}
                    </section>
                )}

                {!DEV_MODE && (
                    <section>
                        <p>
                            DEV_MODE is off. This page should use Firebase auth state (useAuth) instead.
                        </p>
                    </section>
                )}
            </main>
        </>
    );
}
