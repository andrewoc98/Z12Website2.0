import { createContext, useContext } from "react";
import { useMockAuth } from "./MockAuthProvider";

type CheckableRole = "rower" | "host" | "admin" | "clubAdmin" | "federationAdmin" | "platformAdmin";

type RoleCtx = {
    hasRole: (r: CheckableRole) => boolean;
};

const Ctx = createContext<RoleCtx>({
    hasRole: () => false,
});

export function MockRoleProvider({
                                     children,
                                 }: {
    children: React.ReactNode;
}) {
    const { user } = useMockAuth();

    function hasRole(role: CheckableRole) {
        return !!(user?.roles as Record<string, unknown>)?.[role];
    }

    return (
        <Ctx.Provider value={{ hasRole }}>
            {children}
        </Ctx.Provider>
    );
}

export const useMockRoles = () => useContext(Ctx);
