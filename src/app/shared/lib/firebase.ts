import { initializeApp } from "firebase/app";
import {getFunctions, connectFunctionsEmulator, httpsCallable} from "firebase/functions";
import {
    getAuth,
    connectAuthEmulator,
} from "firebase/auth";
import {
    getFirestore,
    connectFirestoreEmulator,
    setDoc,
    doc,
    getDoc,
    writeBatch,
    collection, getDocs, query, where, deleteDoc
} from "firebase/firestore";
import type {ConsentOptions, PendingUser} from "../../features/auth/types.ts";
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const functionsPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || "5003");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (useEmulators) {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", functionsPort);
    console.log("🔧 Emulators connected — functions on port", functionsPort);
} else {
    console.log("🚀 Using production Firebase");
}

export async function createPendingUser(data: {
    email: string;
    fullName: string;
    dateOfBirth: string;
    parentEmail: string;
    club?: string;
    gender: string;
    // no password field
}) {
    const now = new Date().toISOString();
    const cleanEmail = data.email.trim().toLowerCase();

    // Delete any stale pending docs for this email before creating a fresh one
    const existing = await getDocs(
        query(
            collection(db, "pendingUsers"),
            where("email", "==", cleanEmail),
            where("status", "==", "awaiting_parent_consent")
        )
    );
    await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));

    const id = crypto.randomUUID();
    await setDoc(doc(db, "pendingUsers", id), {
        id,
        ...data,
        email: cleanEmail,
        status: "awaiting_parent_consent",
        createdAt: now,
        updatedAt: now,
    });

    return id;
}

export async function checkPendingUserExists(email: string): Promise<boolean> {
    const snap = await getDocs(
        query(
            collection(db, "pendingUsers"),
            where("email", "==", email.trim().toLowerCase()),
            where("status", "==", "awaiting_parent_consent")
        )
    );
    return !snap.empty;
}

export async function getUserProfile(uid: string) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data();
}

export async function sendParentConsentEmail(
    parentEmail: string,
    pendingUserId: string,
    childName: string
) {
    const consentLink = `${window.location.origin}/parent-consent?token=${pendingUserId}`;
    const callSendEmail = httpsCallable(functions, 'sendParentConsentEmail');

    try {
        await callSendEmail({ parentEmail, consentLink, childName });
        console.log('Parent consent email sent');
    } catch (err) {
        console.error('Email failed:', err);
        throw new Error('Failed to send parent consent email');
    }
}

export async function sendVerificationEmail(email: string) {
    const callSendVerification = httpsCallable(functions, 'sendVerificationEmail');
    try {
        await callSendVerification({ email });
        console.log('Verification email sent');
    } catch (err) {
        console.error('Verification email failed:', err);
        throw new Error('Failed to send verification email');
    }
}

export async function onApproveAndCreate(
    _pendingUser: PendingUser,      // kept for call-site compatibility — data is
    pendingUserId: string,          // re-fetched server-side from pendingUserId
    consent: ConsentOptions,
): Promise<{ childUid: string; email: string }> {
    const fn = httpsCallable<
        { pendingUserId: string; consent: ConsentOptions },
        { childUid: string; email: string }
    >(functions, "approveAndCreate");

    const result = await fn({ pendingUserId, consent });
    return result.data;
}

export async function sendPasswordResetEmail(email: string) {
    const callReset = httpsCallable(functions, 'sendPasswordResetEmail');
    try {
        await callReset({ email });
    } catch (err) {
        console.error('Password reset failed:', err);
        throw new Error('Failed to send password reset email');
    }
}


export async function deleteEvent(eventId: string) {
    if (!eventId) throw new Error("Missing eventId");

    const batch = writeBatch(db);

    const eventRef = doc(db, "events", eventId);

    const boatsRef = collection(db, "events", eventId, "boats");
    const boatsSnap = await getDocs(boatsRef);

    boatsSnap.forEach((d) => {
        batch.delete(d.ref);
    });

    const signupRef = collection(db, "events", eventId, "rowerCategorySignups");
    const signupSnap = await getDocs(signupRef);

    signupSnap.forEach((d) => {
        batch.delete(d.ref);
    });

    batch.delete(eventRef);

    await batch.commit();

    return true;
}