import {addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type {AdminInvite, UserProfile} from "../types";

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

export async function createAdminInvite(hostId: string, email: string) {
    const ref = await addDoc(collection(db, "adminInvites"), {
        email: email.trim().toLowerCase(),
        hostId,
        role: "admin",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        used: false,
    });

    return ref.id;
}

export async function fetchAdminInvite(
    inviteId: string
): Promise<AdminInvite | null> {
    const snap = await getDoc(doc(db, "adminInvites", inviteId));
    if (!snap.exists()) return null;

    return {
        id: snap.id,
        ...(snap.data() as Omit<AdminInvite, "id">),
    };
}

export async function markAdminInviteUsed(inviteId: string) {
    await updateDoc(doc(db, "adminInvites", inviteId), {
        used: true,
        usedAt: serverTimestamp(),
    });
}
