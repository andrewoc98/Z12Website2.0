import { collection, doc, getDocs, onSnapshot, query, updateDoc, where, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { BoatTimingDoc, PlaceholderFinish } from "../types";
import { addToPendingQueue } from "../lib/pendingQueue";

// Get events that the user can time (host or admin)
export async function getTimingEvents(userId: string, userRoles: any): Promise<any[]> {
    // For host: events where createdByUid === userId
    // For admin: events where createdByUid === userRoles.admin.hostId

    let hostIds: string[] = [];
    if (userRoles.host) {
        hostIds.push(userId);
    }
    if (userRoles.admin) {
        hostIds.push(userRoles.admin.hostId);
    }

    if (hostIds.length === 0) return [];

    const q = query(collection(db, "events"), where("createdByUid", "in", hostIds));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Subscribe to boats for an event
export function subscribeToEventBoats(eventId: string, callback: (boats: BoatTimingDoc[]) => void) {
    const ref = collection(db, "events", eventId, "boats");
    return onSnapshot(ref, (snapshot) => {
        const boats = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BoatTimingDoc));
        callback(boats);
    });
}

// Start timing a boat
export async function startBoatTiming(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    const now = Date.now();
    try {
        await updateDoc(ref, {
            status: "in_progress",
            startedAt: now,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        // Queue for later sync
        addToPendingQueue({
            type: "start",
            eventId,
            boatId,
            timestamp: now,
            data: { status: "in_progress", startedAt: now }
        });
        throw error;
    }
}

// Stop timing a boat
export async function stopBoatTiming(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    const now = Date.now();
    try {
        await updateDoc(ref, {
            status: "finished",
            finishedAt: now,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        // Queue for later sync
        addToPendingQueue({
            type: "stop",
            eventId,
            boatId,
            timestamp: now,
            data: { status: "finished", finishedAt: now }
        });
        throw error;
    }
}

// Add a placeholder finish
export async function addPlaceholderFinish(eventId: string, finishedAt: number, bowNumber?: number) {
    const ref = collection(db, "events", eventId, "placeholders");
    const data = {
        finishedAt,
        createdAt: serverTimestamp(),
        ...(bowNumber !== undefined && { bowNumber }),
    };
    try {
        await addDoc(ref, data);
    } catch (error) {
        addToPendingQueue({
            type: "placeholder",
            eventId,
            timestamp: finishedAt,
            data: { finishedAt, ...(bowNumber !== undefined && { bowNumber }) }
        });
        throw error;
    }
}

// Subscribe to placeholders
export function subscribeToPlaceholders(eventId: string, callback: (placeholders: PlaceholderFinish[]) => void) {
    const ref = collection(db, "events", eventId, "placeholders");
    return onSnapshot(ref, (snapshot) => {
        const placeholders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PlaceholderFinish));
        callback(placeholders);
    });
}

export async function assignPlaceholderToBoat(
    eventId: string,
    placeholderId: string,
    boatId: string,
    finishedAt: number
) {
    const boatRef = doc(db, "events", eventId, "boats", boatId);
    const placeholderRef = doc(db, "events", eventId, "placeholders", placeholderId);

    try {
        await updateDoc(boatRef, {
            status: "finished",
            finishedAt,
            updatedAt: serverTimestamp(),
        });
        await deleteDoc(placeholderRef);
    } catch (error) {
        addToPendingQueue({
            type: "assign_placeholder",
            eventId,
            boatId,
            placeholderId,
            timestamp: finishedAt,
            data: { status: "finished", finishedAt }
        });
        throw error;
    }
}