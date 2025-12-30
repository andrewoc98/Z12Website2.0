import { Navigate } from "react-router-dom";
import { DEV_MODE } from "../shared/lib/config";

// Firebase auth (used when DEV_MODE = false)
import { useAuth } from "../providers/AuthProvider";

// Mock auth (used when DEV_MODE = true)
import { useMockAuth } from "../providers/MockAuthProvider";
import type {JSX} from "react";

export default function RequireAuth({
                                        children,
                                    }: {
    children: JSX.Element;
}) {
    // DEV MODE (mock users)
    if (DEV_MODE) {
        const { user } = useMockAuth();
        return user ? children : <Navigate to="/" replace />;
    }

    // REAL AUTH (Firebase)
    const { user, loading } = useAuth();

    if (loading) {
        return <div style={{ padding: 16 }}>Loading...</div>;
    }

    return user ? children : <Navigate to="/signin" replace />;
}
