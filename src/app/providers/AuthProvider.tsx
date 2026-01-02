import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../shared/lib/firebase";
import type { UserProfile } from "../features/auth/types";

type AuthCtx = {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {

    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // 1) Auth state
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setProfile(null);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // 2) Profile snapshot (read-only)
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const ref = doc(db, "users", user.uid);

        const unsub = onSnapshot(
            ref,
            (snap) => {
                setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
                setLoading(false);
            },
            (err) => {
                console.error("profile snapshot error:", err);
                setProfile(null);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [user]);

    const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
