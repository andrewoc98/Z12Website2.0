import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {onDocumentWritten} from "firebase-functions/firestore";


export const autoAssignBowNumbers = onSchedule("every 24 hours", async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Find events where closing date has passed but bows haven't been assigned yet
    const eventsSnap = await db.collection("events")
        .where("closeAt", "<=", now)
        .where("bowsAssigned", "==", false)
        .get();

    if (eventsSnap.empty) {
        console.log("No events pending bow assignment.");
        return;
    }

    for (const eventDoc of eventsSnap.docs) {
        const event = eventDoc.data();
        const eventId = eventDoc.id;
        const categoryIds: string[] = (event.categories ?? []).map((c: any) => c.id);

        try {
            await assignBowNumbersForEvent(db, eventId, categoryIds);
            await eventDoc.ref.update({ bowsAssigned: true });
            console.log(`Bow numbers assigned for event ${eventId}`);
        } catch (e) {
            console.error(`Failed to assign bows for event ${eventId}:`, e);
        }
    }
});

async function assignBowNumbersForEvent(
    db: admin.firestore.Firestore,
    eventId: string,
    categoryIds: string[]
) {
    const boatsSnap = await db.collection("boats")
        .where("eventId", "==", eventId)
        .get();

    let bowNumber = 1;
    const batch = db.batch();

    for (const categoryId of categoryIds) {
        const categoryBoats = boatsSnap.docs
            .filter(d => d.data().categoryId === categoryId)
            .sort((a, b) => a.data().registeredAt - b.data().registeredAt);

        for (const boat of categoryBoats) {
            batch.update(boat.ref, { bowNumber: bowNumber++ });
        }
    }

    await batch.commit();
}


export const computeElapsedMs = onDocumentWritten(
    "events/{eventId}/boats/{boatId}",
    async (event) => {
        const after = event.data?.after?.data();
        if (!after) return; // document was deleted

        const { startedAt, finishedAt, adjustmentMs, elapsedMs: currentElapsedMs } = after;

        // Only proceed if boat is finished
        if (!startedAt || !finishedAt) return;

        const startMs = typeof startedAt === "number"
            ? startedAt
            : startedAt.toMillis?.() ?? null;

        const finishMs = typeof finishedAt === "number"
            ? finishedAt
            : finishedAt.toMillis?.() ?? null;

        if (startMs === null || finishMs === null) return;

        const newElapsedMs = (finishMs - startMs) + ((adjustmentMs ?? 0) * 1000);

        if (currentElapsedMs === newElapsedMs) return;

        await event.data!.after.ref.update({ elapsedMs: newElapsedMs });
    }
);