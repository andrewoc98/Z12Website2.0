import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { DEV_MODE } from "../shared/lib/config";

// Firebase auth (used when DEV_MODE = false)
import { useAuth } from "../providers/AuthProvider";

// Mock auth (used when DEV_MODE = true)
import { useMockAuth } from "../providers/MockAuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
    // DEV MODE (mock users)
    if (DEV_MODE) {
        const { user } = useMockAuth();
        return user ? children : <Navigate to="/" replace />;
    }

    // REAL AUTH (Firebase)
    const { user, loading } = useAuth();

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

    return user ? children : <Navigate to="/auth" replace />;
}
