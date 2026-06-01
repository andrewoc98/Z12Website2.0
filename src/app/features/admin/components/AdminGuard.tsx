import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import RequireAuth from "../../../guards/RequiredAuth";
import { useAdminClaims } from "../hooks/useAdminClaims";
import type { AdminRole } from "../types/admin.types";

function homeForRole(adminRole: AdminRole | null): string {
    switch (adminRole) {
        case "platformAdmin":   return "/admin/platform";
        case "federationAdmin": return "/admin/federation";
        case "clubAdmin":       return "/admin/club";
        default:                return "/";
    }
}

/**
 * Higher-privilege roles can access lower-privilege dashboards.
 * e.g. a federationAdmin who created a club can manage it via /admin/club.
 */
function canAccess(userRole: AdminRole | null, requiredRole: AdminRole): boolean {
    if (userRole === requiredRole) return true;
    if (userRole === "platformAdmin") return true;
    if (userRole === "federationAdmin" && requiredRole === "clubAdmin") return true;
    return false;
}

type Props = {
    role:     AdminRole;
    children: JSX.Element;
};

/**
 * Wraps admin portal routes. Requires:
 *   1. An authenticated session (delegates to RequireAuth).
 *   2. The user's `role` custom claim matches the required role.
 *
 * On mismatch, redirects to the user's own appropriate dashboard rather
 * than a 403. Admin nav items should never render unless the claim matches,
 * so reaching here via direct URL is the primary failure case.
 */
export default function AdminGuard({ role, children }: Props) {
    return (
        <RequireAuth>
            <AdminRoleCheck role={role}>{children}</AdminRoleCheck>
        </RequireAuth>
    );
}

function AdminRoleCheck({ role, children }: Props) {
    const { adminRole, loading } = useAdminClaims();

    if (loading) {
        return (
            <main>
                <div className="card auth-guard-loading">
                    <div className="space-between">
                        <h3>Loading</h3>
                        <span className="badge">Admin</span>
                    </div>
                    <p>Checking permissions…</p>
                </div>
            </main>
        );
    }

    if (!canAccess(adminRole, role)) {
        return <Navigate to={homeForRole(adminRole)} replace />;
    }

    return children;
}
