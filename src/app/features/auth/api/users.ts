import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { UserProfile } from "../types";

// Remove empty-string keys so we don't overwrite good values with "".
function stripEmptyStrings<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === "") continue;
        if (v === undefined) continue;
        out[k] = v;
    }
    return out as Partial<T>;
}

/**
 * Ensures a profile doc exists. Critically: will NOT overwrite fields with empty strings.
 * Great for Google sign-in or first-time sign-in.
 */
export async function ensureUserProfile(uid: string, base: Partial<UserProfile>) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    const safeBase = stripEmptyStrings(base as any);

    if (!snap.exists()) {
        return setDoc(
            ref,
            {
                ...safeBase,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    }

    return setDoc(
        ref,
        {
            ...safeBase,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

export async function upsertUserProfile(uid: string, profile: UserProfile) {
    // upsert should write full profile intentionally (registration path)
    return setDoc(
        doc(db, "users", uid),
        {
            ...profile,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}
