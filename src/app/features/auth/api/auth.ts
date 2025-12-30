import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
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
