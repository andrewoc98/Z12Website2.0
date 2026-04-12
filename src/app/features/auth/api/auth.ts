import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../../../shared/lib/firebase";

export async function signInEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}
export async function registerEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
}
export async function signInGoogle() {
    return signInWithPopup(auth, new GoogleAuthProvider());
}
export async function signOutUser() {
    return signOut(auth);
}

export async function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
}

export function isMinor(dateOfBirth: string) {
    const today = new Date();
    const dob = new Date(dateOfBirth);
    const age = today.getFullYear() - dob.getFullYear();
    return age < 17; 
}