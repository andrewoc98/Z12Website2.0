import { initializeApp }                                    from "firebase/app";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { getAuth, connectAuthEmulator, signOut, signInAnonymously } from "firebase/auth";
import {
    getFirestore,
    connectFirestoreEmulator,
    doc, getDoc, getDocs, writeBatch, collection,
} from "firebase/firestore";
import type { ConsentOptions, PendingUser } from "../../features/auth/types.ts";

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const useEmulators  = import.meta.env.VITE_USE_EMULATORS === "true";
const functionsPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || "5001");
export const app       = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const functions = getFunctions(app);

if (useEmulators) {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", functionsPort);
    console.log("🔧 Emulators connected — functions on port", functionsPort);
} else {
    console.log("🚀 Using production Firebase");
}

export async function getUserProfile(uid: string) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
}

export async function sendParentConsentEmail(pendingUserId: string) {
    const a = getAuth();
    await signInAnonymously(a);
    try {
        await httpsCallable(functions, "sendParentConsentEmail")({ pendingUserId });
        console.log("Parent consent email sent");
    } finally {
        await signOut(a);
    }
}

export async function sendVerificationEmail(email: string) {
    try {
        await httpsCallable(functions, "sendVerificationEmail")({ email });
        console.log("Verification email sent");
    } catch (err) {
        console.error("Verification email failed:", err);
        throw new Error("Failed to send verification email");
    }
}

export async function onApproveAndCreate(
    _pendingUser: PendingUser,
    pendingUserId: string,
    consent: ConsentOptions,
): Promise<{ childUid: string; email: string }> {
    const fn = httpsCallable<
        { pendingUserId: string; consent: ConsentOptions },
        { childUid: string; email: string }
    >(functions, "approveAndCreate");
    return (await fn({ pendingUserId, consent })).data;
}

export async function sendPasswordResetEmail(email: string) {
    try {
        await httpsCallable(functions, "sendPasswordResetEmail")({ email });
    } catch (err) {
        console.error("Password reset failed:", err);
        throw new Error("Failed to send password reset email");
    }
}

export async function deleteEvent(eventId: string) {
    if (!eventId) throw new Error("Missing eventId");
    const batch      = writeBatch(db);
    const eventRef   = doc(db, "events", eventId);
    const boatsSnap  = await getDocs(collection(db, "events", eventId, "boats"));
    const signupSnap = await getDocs(collection(db, "events", eventId, "rowerCategorySignups"));
    boatsSnap.forEach(d  => batch.delete(d.ref));
    signupSnap.forEach(d => batch.delete(d.ref));
    batch.delete(eventRef);
    await batch.commit();
    return true;
}

export async function createPendingUser(data: {
    email:       string;
    fullName:    string;
    dateOfBirth: string;
    parentEmail: string;
    clubId?:     string;
    gender:      string;
}): Promise<string> {
    const fn = httpsCallable<typeof data, { id: string }>(functions, "createPendingUser");
    return (await fn(data)).data.id;
}

export async function checkPendingUserExists(email: string): Promise<boolean> {
    const fn = httpsCallable<{ email: string }, { exists: boolean }>(
        functions, "checkPendingUserExists",
    );
    return (await fn({ email })).data.exists;
}

export async function createAdminInvite(hostId: string, email: string): Promise<string> {
    const fn = httpsCallable<{ hostId: string; email: string }, { inviteId: string }>(
        functions, "createAdminInvite",
    );
    return (await fn({ hostId, email })).data.inviteId;
}