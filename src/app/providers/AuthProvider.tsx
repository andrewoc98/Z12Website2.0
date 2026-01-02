import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../shared/lib/firebase";
import { ensureUserProfile } from "../features/auth/api/users";
import type { UserProfile } from "../features/auth/types";

type AuthCtx = { user: User | null; profile: UserProfile | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setProfile(null);

            if (!u) {
                setLoading(false);
                return;
            }

            // Only set name fields if Auth actually has them (avoid overwriting with "")
            const base: Partial<UserProfile> = {
                uid: u.uid,
                email: u.email ?? "",
            };

            if (u.displayName && u.displayName.trim().length > 0) {
                base.fullName = u.displayName.trim();
                base.displayName = u.displayName.trim();
            }

            try {
                await ensureUserProfile(u.uid, base);
            } catch (e) {
                console.error("ensureUserProfile failed:", e);
            }

            setLoading(false);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const ref = doc(db, "users", user.uid);

        const unsub = onSnapshot(
            ref,
            (snap) => {
                setProfile((snap.data() as UserProfile) ?? null);
                setLoading(false);
            },
            (err) => {
                console.error("profile snapshot error:", err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [user]);

    const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
