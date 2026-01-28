import type { BoatDoc } from "../types";
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    writeBatch,
    where,
    getDoc,
} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

/**
 * Single-source-of-truth paths to avoid "events/boats" mistakes.
 */
function boatsCol(eventId: string) {
    if (!eventId) throw new Error("Missing eventId");
    return collection(db, "events", eventId, "boats");
}

function boatRef(eventId: string, boatId: string) {
    if (!eventId) throw new Error("Missing eventId");
    if (!boatId) throw new Error("Missing boatId");
    return doc(db, "events", eventId, "boats", boatId);
}

function signupGuardRef(eventId: string, uid: string, categoryId: string) {
    if (!eventId) throw new Error("Missing eventId");
    if (!uid) throw new Error("Missing uid");
    if (!categoryId) throw new Error("Missing categoryId");
    // Guard doc that makes "category once per rower" atomic
    return doc(db, "events", eventId, "rowerCategorySignups", `${uid}__${categoryId}`);
}

function cleanPatch(patch: any) {
    const clean: any = {};
    for (const [k, v] of Object.entries(patch ?? {})) {
        if (k === "id" || k === "eventId") continue;
        if (v !== undefined) clean[k] = v;
    }
    clean.updatedAt = serverTimestamp();
    return clean;
}

export async function listBoatsForEvent(eventId: string): Promise<BoatDoc[]> {
    const q = query(boatsCol(eventId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
        const data = d.data() as any;

        return {
            id: d.id,
            eventId,
            categoryId: data.categoryId,
            categoryName: data.categoryName,
            category: data.category ?? data.categoryName,
            clubName: data.clubName,
            boatSize: data.boatSize,
            rowerUids: data.rowerUids ?? [],
            invitedEmails: data.invitedEmails ?? [], // optional, can stay
            // ✅ new single invite
            inviteCode: data.inviteCode ?? null,
            // ✅ status
            status: data.status ?? "registered",
            bowNumber: data.bowNumber,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt ?? undefined,
            startedAt: data.startedAt ?? undefined,
            finishedAt: data.finishedAt ?? undefined,
        } as any satisfies BoatDoc;
    });
}

/**
 * Create boat with category-once-per-rower guard.
 * Returns boatId.
 */
export async function createBoat(boat: BoatDoc): Promise<string> {
    const { eventId, categoryId, rowerUids } = boat as any;

    if (!eventId) throw new Error("Missing eventId");
    if (!categoryId) throw new Error("Missing categoryId");
    if (!rowerUids?.length) throw new Error("Missing rowerUids");

    const creatorUid = rowerUids[0];
    const guard = signupGuardRef(eventId, creatorUid, categoryId);

    const col = boatsCol(eventId);
    const newBoat = doc(col); // auto-id
    const newBoatId = newBoat.id;

    await runTransaction(db, async (tx) => {
        const existing = await tx.get(guard);
        if (existing.exists()) throw new Error("You’ve already signed up for this category.");

        // 1) guard
        tx.set(guard, {
            uid: creatorUid,
            categoryId,
            boatId: newBoatId,
            createdAt: serverTimestamp(),
        });

        // 2) boat doc
        tx.set(newBoat, {
            ...boat,
            id: newBoatId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
    });

    return newBoatId;
}

export async function updateBoat(boatId: string, patch: Partial<BoatDoc> & { eventId?: string }): Promise<void> {
    const eventId = patch.eventId;
    if (!eventId) throw new Error("updateBoat requires patch.eventId");

    await updateDoc(boatRef(eventId, boatId), cleanPatch(patch));
}

/**
 * Join a boat using the boat's single inviteCode.
 * The same invite link can be used by multiple people until the boat is full.
 * When full -> status becomes "registered" and inviteCode is cleared (optional).
 */
export async function joinBoatWithInviteCode(args: { eventId: string; code: string; uid: string }): Promise<string> {
    const { eventId, code, uid } = args;
    if (!eventId) throw new Error("Missing eventId");
    if (!code) throw new Error("Missing invite code");
    if (!uid) throw new Error("Missing uid");

    // Find boat by inviteCode (should be unique)
    const q = query(boatsCol(eventId), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Invite not found or expired.");

    const boatDocSnap = snap.docs[0];
    const ref = boatDocSnap.ref;

    await runTransaction(db, async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists()) throw new Error("Boat not found.");

        const boat = fresh.data() as any;

        const status = boat.status ?? "registered";
        if (status !== "pending_crew") throw new Error("This crew is no longer accepting invites.");

        const rowerUids: string[] = Array.isArray(boat.rowerUids) ? boat.rowerUids : [];
        const boatSize: number = Number(boat.boatSize ?? 0);

        if (!boatSize || boatSize < 1) throw new Error("Invalid boat size.");
        if (rowerUids.includes(uid)) throw new Error("You’re already on this boat.");
        if (rowerUids.length >= boatSize) throw new Error("This boat is already full.");

        const next = [...rowerUids, uid];
        const nowFull = next.length >= boatSize;

        tx.update(ref, {
            rowerUids: next,
            status: nowFull ? "registered" : "pending_crew",
            inviteCode: nowFull ? null : boat.inviteCode, // clear when full
            updatedAt: serverTimestamp(),
        });
    });

    return boatDocSnap.id;
}

/**
 * Optional helper: get a boat (useful if you want to show boat details after joining)
 */
export async function getBoat(eventId: string, boatId: string): Promise<BoatDoc | null> {
    const snap = await getDoc(boatRef(eventId, boatId));
    if (!snap.exists()) return null;
    return { id: snap.id, eventId, ...(snap.data() as any) } as any;
}

export async function assignBowNumbersForEvent(eventId: string, categoryOrder: string[]): Promise<void> {
    const snap = await getDocs(query(boatsCol(eventId), orderBy("createdAt", "asc")));
    const boats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const byCategory = new Map<string, { id: string; createdAt: number }[]>();

    for (const b of boats) {
        const key = b.categoryName || b.category || b.categoryId;
        const createdMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        const list = byCategory.get(key) ?? [];
        list.push({ id: b.id, createdAt: createdMs });
        byCategory.set(key, list);
    }

    for (const [cat, list] of byCategory.entries()) {
        list.sort((a, b) => a.createdAt - b.createdAt);
        byCategory.set(cat, list);
    }

    let bow = 1;
    const updates: Array<{ boatId: string; bowNumber: number }> = [];

    for (const cat of categoryOrder) {
        const list = byCategory.get(cat);
        if (!list || list.length === 0) continue;
        for (const b of list) updates.push({ boatId: b.id, bowNumber: bow++ });
        byCategory.delete(cat);
    }

    const remainingCats = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b));
    for (const cat of remainingCats) {
        const list = byCategory.get(cat)!;
        for (const b of list) updates.push({ boatId: b.id, bowNumber: bow++ });
    }

    const batch = writeBatch(db);
    for (const u of updates) {
        batch.update(boatRef(eventId, u.boatId), {
            bowNumber: u.bowNumber,
            updatedAt: serverTimestamp(),
        });
    }
    await batch.commit();
}

export async function startBoat(eventId: string, boatId: string): Promise<void> {
    await updateDoc(boatRef(eventId, boatId), {
        startedAt: Date.now(),
        updatedAt: serverTimestamp(),
    });
}

export async function finishBoat(eventId: string, boatId: string): Promise<void> {
    await updateDoc(boatRef(eventId, boatId), {
        finishedAt: Date.now(),
        updatedAt: serverTimestamp(),
    });
}

export function getElapsedMs(b: { startedAt?: number; finishedAt?: number }) {
    if (!b.startedAt || !b.finishedAt) return null;
    return Math.max(0, b.finishedAt - b.startedAt);
}

export async function getInviteRequirements(
    eventId: string | undefined,
    code: string | undefined
) {

    if (!eventId) {
        throw new Error("eventId is required");
    }
    const boatsRef = collection(db, "events", eventId, "boats");
    const q = query(boatsRef, where("inviteCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new Error("Invalid invite code");
    }

    const boatDoc = snap.docs[0];
    const boat = boatDoc.data();

    // 2. Get event date
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
        throw new Error("Event not found");
    }

    return {
        eventDate: eventSnap.data().date,
        category: boat.category,
        genderCategory: boat.genderCategory,
        boatId: boatDoc.id,
    };
}