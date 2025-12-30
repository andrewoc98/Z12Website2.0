import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../shared/lib/firebase";
import { useAuth } from "./AuthProvider";
import type { UserProfile } from "../features/auth/types";

type RoleCtx = {
    profile: UserProfile | null;
    loading: boolean;
    hasRole: (r: "rower" | "host" | "admin") => boolean;
};

const Ctx = createContext<RoleCtx>({
    profile: null,
    loading: true,
    hasRole: () => false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const ref = doc(db, "users", user.uid);
        const unsub = onSnapshot(ref, (snap) => {
            setProfile((snap.data() as any) ?? null);
            setLoading(false);
        });

        return () => unsub();
    }, [user, authLoading]);

    const hasRole = useMemo(
        () => (r: "rower" | "host" | "admin") => !!profile?.roles?.[r],
        [profile]
    );

    return <Ctx.Provider value={{ profile, loading, hasRole }}>{children}</Ctx.Provider>;
}

export const useRoles = () => useContext(Ctx);
