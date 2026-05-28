import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../shared/lib/firebase";
import type { UserProfile } from "../features/auth/types";

type AuthCtx = {
    user:    User | null;
    profile: UserProfile | null;
    loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, profile: null, loading: true });

// In the emulator, mixing onSnapshot listeners and getDocs queries on the
// same Firestore instance triggers an internal assertion error in the SDK
// (WatchChangeAggregator / ID: b815). We use a one-shot getDoc instead
// of onSnapshot when running against the emulator to avoid this entirely.
// In production, onSnapshot is kept so the profile stays live.
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user,    setUser]    = useState<User | null>(null);
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

    // 2) Profile — one-shot in emulator, live snapshot in production
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const ref = doc(db, "users", user.uid);

        if (USE_EMULATORS) {
            // One-shot fetch — avoids the onSnapshot + getDocs emulator conflict
            getDoc(ref)
                .then(snap => {
                    setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
                })
                .catch(err => {
                    console.error("profile fetch error:", err);
                    setProfile(null);
                })
                .finally(() => setLoading(false));

            // No cleanup needed for a one-shot fetch
            return;
        }

        // Production — keep the live snapshot so profile updates reflect immediately
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
            },
        );

        return () => unsub();
    }, [user]);

    const value = useMemo(
        () => ({ user, profile, loading }),
        [user, profile, loading],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);