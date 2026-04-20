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

export async function fetchRowersByUids(uids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(uids)];
    const entries = await Promise.all(
        unique.map(async uid => {
            try {
                const snap = await getDoc(doc(db, "users", uid));
                const data = snap.data();
                const name = data?.fullName ?? data?.displayName ?? "Unknown";
                return [uid, name] as [string, string];
            } catch {
                return [uid, "Unknown"] as [string, string];
            }
        })
    );
    return new Map(entries);
}

export function formatCrew(rowerUids: string[], rowerMap: Map<string, string>): string {
    const names = (rowerUids ?? []).map(uid => rowerMap.get(uid) ?? "Unknown");
    if (names.length === 0) return "—";
    if (names.length === 1) return names[0];
    const last = names[names.length - 1];
    return `${names.slice(0, -1).join(", ")} & ${last}`;
}
