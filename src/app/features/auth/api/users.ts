import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { UserProfile } from "../types";

export async function createUserProfile(uid: string, data: any) {
    return setDoc(doc(db, "users", uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
}

export async function upsertUserProfile(uid: string, profile: UserProfile) {
    return setDoc(
        doc(db, "users", uid),
        { ...profile, updatedAt: serverTimestamp() },
        { merge: true }
    );
}