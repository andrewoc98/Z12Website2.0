import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

export async function createUserProfile(uid: string, data: any) {
    return setDoc(doc(db, "users", uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
}
