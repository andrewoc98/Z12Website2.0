import { createContext, useContext } from "react";
import { useMockAuth } from "./MockAuthProvider";

type RoleCtx = {
    hasRole: (r: "rower" | "host" | "admin") => boolean;
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

    function hasRole(role: "rower" | "host" | "admin") {
        return !!user?.roles?.[role];
    }

    return (
        <Ctx.Provider value={{ hasRole }}>
            {children}
        </Ctx.Provider>
    );
}

export const useMockRoles = () => useContext(Ctx);
