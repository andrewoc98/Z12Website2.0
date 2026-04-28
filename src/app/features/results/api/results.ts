import type {EventDoc, FirestoreEventDoc} from "../../events/types.ts";
import {doc, getDoc} from "firebase/firestore";
import {db} from "../../../shared/lib/firebase.ts";
import {mapEvent} from "../../events/lib/mapper.tsx";

export async function getEventById(eventId: string): Promise<(EventDoc & { id: string }) | null> {
    const snap = await getDoc(doc(db, "events", eventId));
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreEventDoc;
    return mapEvent(snap.id, data);
}

