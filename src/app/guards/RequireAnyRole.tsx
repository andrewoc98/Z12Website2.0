import { Navigate } from "react-router-dom";
import { DEV_MODE } from "../shared/lib/config.ts";
import RequireAuth from "../guards/RequiredAuth";
import { useRoles } from "../providers/RoleProvider";
import { useMockRoles } from "../providers/MockRoleProvider";
import type { JSX } from "react";

type Role = "rower" | "coach" | "admin" | "clubAdmin" | "federationAdmin" | "platformAdmin";

export default function RequireAnyRole({ roles, children }: { roles: Role[]; children: JSX.Element }) {
    if (DEV_MODE) {
        const { hasRole } = useMockRoles();
        return (
            <RequireAuth>
                {roles.some(r => hasRole(r)) ? children : <Navigate to="/" replace />}
            </RequireAuth>
        );
    }

    const { loading, hasRole } = useRoles();
    return (
        <RequireAuth>
            {loading
                ? <div style={{ padding: 16 }}>Loading…</div>
                : roles.some(r => hasRole(r)) ? children
                : <Navigate to="/" replace />}
        </RequireAuth>
    );
}
