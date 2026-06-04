import type { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { DEV_MODE } from "../shared/lib/config";
import { auth } from "../shared/lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import { useMockAuth } from "../providers/MockAuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
    const location = useLocation();

    // Always call hooks
    const realAuth = useAuth();
    const mockAuth = useMockAuth();

    const user    = DEV_MODE ? mockAuth.user    : realAuth.user;
    const profile = DEV_MODE ? null             : realAuth.profile;
    const loading = DEV_MODE ? false            : realAuth.loading;

    if (loading) {
        return (
            <main>
                <div className="card auth-guard-loading">
                    <div className="space-between">
                        <h3>Loading</h3>
                        <span className="badge">Auth</span>
                    </div>
                    <p>Checking your session…</p>
                </div>
            </main>
        );
    }

    if (!user) {
        const returnTo = encodeURIComponent(
            location.pathname + location.search
        );

        return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
    }

    if (profile?.status?.requiresParentalConsent) {
        signOut(auth);
        return <Navigate to="/auth?error=parental-consent" replace />;
    }

    return children;
}
