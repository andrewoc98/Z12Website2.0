import { createContext, useContext, useState } from "react";
import type { MockUser } from "../shared/lib/mockUsers";

type MockAuthCtx = {
    user: MockUser | null;
    loginAs: (role: "rower" | "host" | "admin") => void;
    logout: () => void;
};

const Ctx = createContext<MockAuthCtx>({
    user: null,
    loginAs: () => {},
    logout: () => {},
});

export function MockAuthProvider({
                                     children,
                                 }: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<MockUser | null>(null);

    function loginAs(role: "rower" | "host" | "admin") {
        import("../shared/lib/mockUsers").then(({ MOCK_USERS }) => {
            setUser(MOCK_USERS[role]);
        });
    }

    function logout() {
        setUser(null);
    }

    return (
        <Ctx.Provider value={{ user, loginAs, logout }}>
            {children}
        </Ctx.Provider>
    );
}

export const useMockAuth = () => useContext(Ctx);
