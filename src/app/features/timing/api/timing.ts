import { collection, doc, getDocs, onSnapshot, query, updateDoc, where, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { BoatTimingDoc, PlaceholderFinish } from "../types";
import { addToPendingQueue } from "../lib/pendingQueue";

// Get events that the user can time (clubAdmin or timing admin)
export async function getTimingEvents(_userId: string, userRoles: any): Promise<any[]> {
    const clubAdminClubId   = userRoles?.clubAdmin?.clubId as string | undefined;
    const timingAdminHostIds = userRoles?.admin?.hostIds   as string[] | undefined;

    if (clubAdminClubId) {
        // Club admin: all events for their club
        const q = query(collection(db, "events"), where("clubId", "==", clubAdminClubId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (timingAdminHostIds?.length) {
        // Timing admin: events created by their associated club admin(s)
        const q = query(collection(db, "events"), where("createdByUid", "in", timingAdminHostIds));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    return [];
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

// Stop timing a boat. If reviewThresholdMs is provided and the elapsed time is
// below that threshold, the boat is flagged "under_review" instead of "finished".
export async function stopBoatTiming(
    eventId: string,
    boatId: string,
    startedAt?: number | null,
    reviewThresholdMs?: number
) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    const now = Date.now();
    const elapsed = startedAt != null ? now - startedAt : Infinity;
    const flagged = reviewThresholdMs != null && elapsed < reviewThresholdMs;
    const status  = flagged ? "under_review" : "finished";
    const patch   = flagged
        ? { status, finishedAt: now, reviewReason: "auto", updatedAt: serverTimestamp() }
        : { status, finishedAt: now, updatedAt: serverTimestamp() };
    try {
        await updateDoc(ref, patch);
    } catch (error) {
        addToPendingQueue({
            type: "stop",
            eventId,
            boatId,
            timestamp: now,
            data: flagged ? { status, finishedAt: now, reviewReason: "auto" } : { status, finishedAt: now }
        });
        throw error;
    }
}

// Flag a finished boat for manual review by an admin.
export async function flagBoatForReview(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    try {
        await updateDoc(ref, { status: "under_review", reviewReason: "manual", updatedAt: serverTimestamp() });
    } catch (error) {
        addToPendingQueue({
            type: "flag_review",
            eventId,
            boatId,
            timestamp: Date.now(),
            data: { status: "under_review", reviewReason: "manual" }
        });
        throw error;
    }
}

// Confirm an under_review time — publishes the boat as finished.
export async function confirmBoatTime(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    try {
        await updateDoc(ref, { status: "finished", updatedAt: serverTimestamp() });
    } catch (error) {
        addToPendingQueue({
            type: "confirm_review",
            eventId,
            boatId,
            timestamp: Date.now(),
            data: { status: "finished" }
        });
        throw error;
    }
}

// Discard an under_review time — sends the boat back to in_progress so it can
// be stopped again when it actually crosses the line.
export async function discardBoatTime(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    try {
        await updateDoc(ref, { status: "in_progress", finishedAt: null, updatedAt: serverTimestamp() });
    } catch (error) {
        addToPendingQueue({
            type: "discard_review",
            eventId,
            boatId,
            timestamp: Date.now(),
            data: { status: "in_progress", finishedAt: null }
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

// Delete a placeholder that was recorded in error.
export async function deletePlaceholder(eventId: string, placeholderId: string) {
    const ref = doc(db, "events", eventId, "placeholders", placeholderId);
    try {
        await deleteDoc(ref);
    } catch (error) {
        addToPendingQueue({
            type: "delete_placeholder",
            eventId,
            placeholderId,
            timestamp: Date.now(),
            data: {}
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

export const markBoatDNS = async (eventId: string, boatId: string) => {
    const ref = doc(db, "events", eventId, "boats", boatId);
    const now = Date.now();
    try {
        await updateDoc(ref, {
            status: "dns",
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        addToPendingQueue({
            type: "dns",
            eventId,
            boatId,
            timestamp: now,
            data: { status: "dns" }
        });
        throw error;
    }
};

export const markBoatDNF = async (eventId: string, boatId: string) => {
    const ref = doc(db, "events", eventId, "boats", boatId);
    const now = Date.now();
    try {
        await updateDoc(ref, {
            status: "dnf",
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        addToPendingQueue({
            type: "dnf",
            eventId,
            boatId,
            timestamp: now,
            data: { status: "dnf" }
        });
        throw error;
    }
};

// Return an under_review boat to the start list (registered), clearing all timing data.
export async function returnBoatToStartList(eventId: string, boatId: string) {
    const ref = doc(db, "events", eventId, "boats", boatId);
    try {
        await updateDoc(ref, {
            status: "registered",
            startedAt: null,
            finishedAt: null,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        addToPendingQueue({
            type: "return_to_start",
            eventId,
            boatId,
            timestamp: Date.now(),
            data: { status: "registered", startedAt: null, finishedAt: null },
        });
        throw error;
    }
}