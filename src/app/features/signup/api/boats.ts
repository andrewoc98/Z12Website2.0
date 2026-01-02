import { DEV_MODE } from "../../../shared/lib/config";
import type { BoatDoc } from "../types";
import {collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, updateDoc, writeBatch,} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

const LS_KEY = "z12_mock_boats_v1";

function loadMockBoats(): BoatDoc[] {
    if (!DEV_MODE) return [];
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as BoatDoc[]) : [];
    } catch {
        return [];
    }
}

function saveMockBoats(boats: BoatDoc[]) {
    if (!DEV_MODE) return;
    localStorage.setItem(LS_KEY, JSON.stringify(boats));
}

let mockBoats: BoatDoc[] = DEV_MODE ? loadMockBoats() : [];

function randomCode(len = 12) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function ensureInviteCodes(boatSize: number, currentMembers: number, existing?: string[]) {
    if (existing?.length) return existing;
    const remaining = Math.max(0, boatSize - currentMembers);
    const codes: string[] = [];
    for (let i = 0; i < remaining; i++) codes.push(randomCode());
    return codes;
}

function boatCol(eventId: string) {
    return collection(db, "events", eventId, "boats");
}

function signupGuardDoc(eventId: string, uid: string, categoryId: string) {
    // Guard doc that makes "category once per rower" atomic
    return doc(db, "events", eventId, "rowerCategorySignups", `${uid}__${categoryId}`);
}

export async function listBoatsForEvent(eventId: string): Promise<BoatDoc[]> {
    if (DEV_MODE) {
        return Promise.resolve(mockBoats.filter((b) => b.eventId === eventId));
    }

    const q = query(boatCol(eventId), orderBy("createdAt", "desc"));
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
            invitedEmails: data.invitedEmails ?? [],
            inviteCodes: data.inviteCodes ?? [],
            bowNumber: data.bowNumber,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt ?? undefined,
            startedAt: data.startedAt ?? undefined,
            finishedAt: data.finishedAt ?? undefined,
        } satisfies BoatDoc;
    });
}

export async function createBoat(boat: BoatDoc): Promise<void> {
    if (DEV_MODE) {
        // keep your existing localStorage mock behavior
        throw new Error("DEV_MODE mock createBoat not shown here");
    }

    const { eventId, categoryId, rowerUids } = boat;
    if (!eventId) throw new Error("Missing eventId");
    if (!categoryId) throw new Error("Missing categoryId");
    if (!rowerUids?.length) throw new Error("Missing rowerUids");

    const creatorUid = rowerUids[0];
    const signupId = `${creatorUid}__${categoryId}`;

    const boatsCol = collection(db, "events", eventId, "boats");
    const signupRef = doc(db, "events", eventId, "rowerCategorySignups", signupId);
    const newBoatRef = doc(boatsCol); // auto id

    await runTransaction(db, async (tx) => {
        const existing = await tx.get(signupRef);
        if (existing.exists()) {
            throw new Error("You’ve already signed up for this category.");
        }

        // 1) Create guard doc (prevents duplicates)
        tx.set(signupRef, {
            uid: creatorUid,
            categoryId,
            boatId: newBoatRef.id,
            createdAt: serverTimestamp(),
        });

        // 2) Create boat
        tx.set(newBoatRef, {
            ...boat,
            id: newBoatRef.id,
            createdAt: serverTimestamp(),
        } as any);
    });
}

export async function updateBoat(boatId: string, patch: Partial<BoatDoc> & { eventId?: string }): Promise<void> {
    if (DEV_MODE) {
        mockBoats = mockBoats.map((b) => (b.id === boatId ? { ...b, ...patch } : b));
        saveMockBoats(mockBoats);
        return Promise.resolve();
    }

    const eventId = patch.eventId;
    if (!eventId) throw new Error("updateBoat requires patch.eventId in Firestore mode.");

    const ref = doc(db, "events", eventId, "boats", boatId);

    const clean: any = {};
    for (const [k, v] of Object.entries(patch)) {
        if (k === "id" || k === "eventId") continue;
        if (v !== undefined) clean[k] = v;
    }
    clean.updatedAt = serverTimestamp();

    await updateDoc(ref, clean);
}

export async function assignBowNumbersForEvent(eventId: string, categoryOrder: string[]): Promise<void> {
    if (DEV_MODE) {
        const boats = mockBoats.filter((b) => b.eventId === eventId);

        const byCategory = new Map<string, BoatDoc[]>();
        for (const b of boats) {
            const key = b.categoryName || b.category || b.categoryId;
            const list = byCategory.get(key) ?? [];
            list.push(b);
            byCategory.set(key, list);
        }

        for (const [cat, list] of byCategory.entries()) {
            list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
            byCategory.set(cat, list);
        }

        let bow = 1;

        for (const cat of categoryOrder) {
            const list = byCategory.get(cat);
            if (!list || list.length === 0) continue;
            for (const b of list) b.bowNumber = bow++;
            byCategory.delete(cat);
        }

        const remainingCats = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b));
        for (const cat of remainingCats) {
            const list = byCategory.get(cat)!;
            for (const b of list) b.bowNumber = bow++;
        }

        const updated = new Map<string, BoatDoc>();
        for (const b of boats) updated.set(b.id!, b);
        mockBoats = mockBoats.map((b) => (updated.has(b.id!) ? updated.get(b.id!)! : b));

        saveMockBoats(mockBoats);
        return Promise.resolve();
    }

    const snap = await getDocs(query(boatCol(eventId), orderBy("createdAt", "asc")));
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
        batch.update(doc(db, "events", eventId, "boats", u.boatId), {
            bowNumber: u.bowNumber,
            updatedAt: serverTimestamp(),
        });
    }
    await batch.commit();
}

/** DEBUG: view all boats in memory */
export function __debugAllBoats(): BoatDoc[] {
    return mockBoats;
}

/** DEBUG: clear all boats */
export function __debugClearBoats() {
    mockBoats = [];
    saveMockBoats(mockBoats);
}

export async function startBoat(eventId: string, boatId: string): Promise<void> {
    if (DEV_MODE) {
        return updateBoat(boatId, { startedAt: Date.now() });
    }
    await updateDoc(doc(db, "events", eventId, "boats", boatId), {
        startedAt: Date.now(),
        updatedAt: serverTimestamp(),
    });
}

export async function finishBoat(eventId: string, boatId: string): Promise<void> {
    if (DEV_MODE) {
        return updateBoat(boatId, { finishedAt: Date.now() });
    }
    await updateDoc(doc(db, "events", eventId, "boats", boatId), {
        finishedAt: Date.now(),
        updatedAt: serverTimestamp(),
    });
}

export function getElapsedMs(b: { startedAt?: number; finishedAt?: number }) {
    if (!b.startedAt || !b.finishedAt) return null;
    return Math.max(0, b.finishedAt - b.startedAt);
}
