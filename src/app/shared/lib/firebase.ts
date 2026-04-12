import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {
    getAuth,
    connectAuthEmulator,
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification, signOut
} from "firebase/auth";
import {getFirestore, connectFirestoreEmulator, setDoc, doc, getDoc, serverTimestamp} from "firebase/firestore";
import emailjs from "emailjs-com";
import type {ConsentOptions, PendingUser} from "../../features/auth/types.ts";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "false";
const functionsPort = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || "5002");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (useEmulators) {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", functionsPort);
}

export async function createPendingUser(data: {
    email: string;
    fullName: string;
    dateOfBirth: string;
    parentEmail: string;
    club?: string;
}) {
    const id = crypto.randomUUID();

    const now = new Date().toISOString();

    await setDoc(doc(db, "pendingUsers", id), {
        id,
        ...data,
        status: "awaiting_parent_consent",
        createdAt: now,
        updatedAt: now
    });

    return id;
}

export async function getUserProfile(uid: string) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data();
}

export async function sendParentConsentEmail(
    parentEmail: string,
    pendingUserId: string
) {
    const consentLink = `${window.location.origin}/parent-consent?token=${pendingUserId}`;

    try {
        await emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE_ID,
            "template_fba80zn",
            {
                to_email: parentEmail,
                consent_link: consentLink,
            },
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        );

        console.log("Parent consent email sent");
    } catch (err) {
        console.error("Email failed:", err);
        throw new Error("Failed to send parent consent email");
    }
}

export const onApproveAndCreate = async (
    pendingUser: PendingUser,
    pendingUserId: string,
    options: ConsentOptions
) => {
    if (!pendingUser) throw new Error("No pending user provided");
    if (!options.termsAccepted || !options.privacyAccepted)
        throw new Error("Required consents not accepted");

    // Mark pending user as approved
    const pendingRef = doc(db, "pendingUsers", pendingUserId);
    await setDoc(
        pendingRef,
        {
            status: "approved",
            consent: {
                termsAccepted: options.termsAccepted,
                privacyAccepted: options.privacyAccepted,
                performanceTrackingAccepted: options.performanceTrackingAccepted,
                dataSharingAccepted: options.dataSharingAccepted,
                givenBy: "parent",
                approvedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);

    // Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, pendingUser.email, tempPassword);
    await cred.user.getIdToken(true);

    await updateProfile(cred.user, { displayName: pendingUser.fullName });
    await sendEmailVerification(cred.user);

    // Create UserProfile in Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: pendingUser.email,
        fullName: pendingUser.fullName,
        displayName: pendingUser.fullName,
        primaryRole: "rower",
        roles: { rower: { club: pendingUser.club } },
        dateOfBirth: pendingUser.dateOfBirth,
        birthYear: Number(pendingUser.dateOfBirth.slice(0, 4)),
        consent: {
            termsAccepted: options.termsAccepted,
            privacyAccepted: options.privacyAccepted,
            performanceTrackingAccepted: options.performanceTrackingAccepted,
            dataSharingAccepted: options.dataSharingAccepted,
            givenBy: "parent",
            givenByUid: cred.user.uid,
            approvedAt: new Date().toISOString(),
        },
        status: { isActive: true, isVerified: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    // Mark pending user as converted
    await setDoc(pendingRef, { status: "converted" }, { merge: true });
    await signOut(auth);

    return { uid: cred.user.uid, email: cred.user.email };
};