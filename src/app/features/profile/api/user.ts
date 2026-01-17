import {collection, query, where, getDocs, addDoc, orderBy, doc, getDoc} from "firebase/firestore";
import { startAt, endAt, limit} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type {UserProfile} from "../../auth/types.ts";


async function getProfilesByIds(uids: string[]): Promise<UserProfile[]> {
    if (!uids.length) return [];

    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("uid", "in", uids.slice(0, 10))); // Firestore limit: 10 for 'in'
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as UserProfile);
}

export async function getCoachesForRower(rowerId: string): Promise<UserProfile[]> {
    const q = query(
        collection(db, "coachLinks"),
        where("rowerId", "==", rowerId),
        where("status", "==", "approved")
    );

    const snapshot = await getDocs(q);
    const coachIds = snapshot.docs.map(doc => doc.data().coachId);

    // Fetch full profiles
    return getProfilesByIds(coachIds);
}

export async function getRowersForCoach(coachId: string): Promise<UserProfile[]> {
    const q = query(
        collection(db, "coachLinks"),
        where("coachId", "==", coachId),
        where("status", "==", "approved")
    );

    const snapshot = await getDocs(q);
    const rowerIds = snapshot.docs.map(doc => doc.data().rowerId);

    // Fetch full profiles
    return getProfilesByIds(rowerIds);
}

export async function fetchUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserProfile;
}


export async function addCoachLink(rowerId: string, coachId: string, status: "pending" | "approved" = "approved") {
    const docRef = await addDoc(collection(db, "coachLinks"), { rowerId, coachId, status });
    return docRef.id;
}

export async function searchCoachesByName(
    namePrefix: string,
    pageSize: number = 5,
    startAfter?: string
): Promise<UserProfile[]> {
    const q = query(
        collection(db, "users"),
        where("roles.coach", "!=", null), // only users with coach role
        orderBy("fullName"),
        startAfter ? startAt(startAfter) : startAt(namePrefix),
        endAt(namePrefix + "\uf8ff"),
        limit(pageSize)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as UserProfile);
}


export async function getUserProfileByUid(uid: string): Promise<UserProfile | null> {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data() as UserProfile;
}