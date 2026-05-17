import {doc, getDoc, serverTimestamp, setDoc} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type {AdminInvite, UserProfile} from "../types";

const PROTECTED_FIELDS = ["roles", "primaryRole", "role"] as const;

function stripProtectedFields<T extends Record<string, any>>(obj: T): T {
    const out = { ...obj };
    for (const field of PROTECTED_FIELDS) {
        delete (out as any)[field];
    }
    // Also strip undefined values — Firestore rejects them
    for (const [k, v] of Object.entries(out)) {
        if (v === undefined) delete (out as any)[k];
    }
    return out;
}

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
    const safe = stripProtectedFields(stripEmptyStrings(base as any));  // 🔒 added

    if (!snap.exists()) {
        return setDoc(ref, { ...safe, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
    return setDoc(ref, { ...safe, updatedAt: serverTimestamp() }, { merge: true });
}


export async function upsertUserProfile(uid: string, profile: Partial<UserProfile>) {
    const safe = stripProtectedFields(profile);          // 🔒 added
    return setDoc(
        doc(db, "users", uid),
        { ...safe, updatedAt: serverTimestamp() },
        { merge: true }
    );
}

export async function createGuardianProfile(uid: string, profile: Partial<UserProfile>) {
    const now = new Date().toISOString();
    const safe = stripProtectedFields(profile);          // 🔒 added
    return setDoc(
        doc(db, "users", uid),
        { ...safe, createdAt: now, updatedAt: now },
        { merge: true }
    );
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

