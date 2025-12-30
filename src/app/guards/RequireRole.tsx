import { Navigate } from "react-router-dom";
import { useRoles } from "../providers/RoleProvider";
import RequireAuth from "./RequiredAuth";
import type {JSX} from "react";

export default function RequireRole({
                                        role,
                                        children,
                                    }: {
    role: "rower" | "host" | "admin";
    children: JSX.Element;
}) {
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
