import { Navigate } from "react-router-dom";
import { DEV_MODE } from "../shared/lib/config";
import RequireAuth from "./RequiredAuth";
import { useRoles } from "../providers/RoleProvider";
import { useMockRoles } from "../providers/MockRoleProvider";

export default function RequireTimingAccess({ children }: { children: React.ReactElement }) {
    if (DEV_MODE) {
        const { hasRole } = useMockRoles();
        const hasAccess = hasRole("host") || hasRole("admin");
        return <RequireAuth>{hasAccess ? children : <Navigate to="/" replace />}</RequireAuth>;
    }

    const { loading, hasRole } = useRoles();
    const hasAccess = hasRole("host") || hasRole("admin");

    return (
        <RequireAuth>
            {loading ? (
                <div style={{ padding: 16 }}>Loading...</div>
            ) : hasAccess ? (
                children
            ) : (
                <Navigate to="/" replace />
            )}
        </RequireAuth>
    );
}