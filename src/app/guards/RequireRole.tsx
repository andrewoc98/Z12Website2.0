import { Navigate } from "react-router-dom";
import { DEV_MODE } from "../shared/lib/config.ts";
import RequireAuth from "../guards/RequiredAuth";

// Firebase roles (used when DEV_MODE = false)
import { useRoles } from "../providers/RoleProvider";

// Mock roles (used when DEV_MODE = true)
import { useMockRoles } from "../providers/MockRoleProvider";
import type {JSX} from "react";

type Role = "rower" | "host" | "admin";

export default function RequireRole({
                                        role,
                                        children,
                                    }: {
    role: Role;
    children: JSX.Element;
}) {
    // ----------------------------
    // DEV MODE (mock roles)
    // ----------------------------
    if (DEV_MODE) {
        const { hasRole } = useMockRoles();

        return (
            <RequireAuth>
                {hasRole(role) ? children : <Navigate to="/" replace />}
            </RequireAuth>
        );
    }

    // ----------------------------
    // REAL MODE (Firebase roles)
    // ----------------------------
    const { loading, hasRole } = useRoles();

    return (
        <RequireAuth>
            {loading ? (
                <div style={{ padding: 16 }}>Loading...</div>
            ) : hasRole(role) ? (
                children
            ) : (
                <Navigate to="/" replace />
            )}
        </RequireAuth>
    );
}
