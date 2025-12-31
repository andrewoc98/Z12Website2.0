import { DEV_MODE } from "../../../shared/lib/config";
import type { BoatDoc } from "../types";

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

export async function listBoatsForEvent(eventId: string): Promise<BoatDoc[]> {
    if (DEV_MODE) {
        return Promise.resolve(mockBoats.filter((b) => b.eventId === eventId));
    }
    throw new Error("Firestore not wired yet");
}

export async function createBoat(boat: BoatDoc): Promise<BoatDoc> {
    if (DEV_MODE) {
        const newBoat: BoatDoc = {
            ...boat,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        mockBoats = [newBoat, ...mockBoats];
        saveMockBoats(mockBoats);
        return Promise.resolve(newBoat);
    }
    throw new Error("Firestore not wired yet");
}

export async function updateBoat(boatId: string, patch: Partial<BoatDoc>): Promise<void> {
    if (DEV_MODE) {
        mockBoats = mockBoats.map((b) => (b.id === boatId ? { ...b, ...patch } : b));
        saveMockBoats(mockBoats);
        return Promise.resolve();
    }
    throw new Error("Firestore not wired yet");
}

export async function assignBowNumbersForEvent(
    eventId: string,
    categoryOrder: string[]
): Promise<void> {
    if (!DEV_MODE) throw new Error("Firestore not wired yet");

    const boats = mockBoats.filter((b) => b.eventId === eventId);

    const byCategory = new Map<string, BoatDoc[]>();
    for (const b of boats) {
        const list = byCategory.get(b.category) ?? [];
        list.push(b);
        byCategory.set(b.category, list);
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

/** DEBUG: view all boats in memory */
export function __debugAllBoats(): BoatDoc[] {
    return mockBoats;
}

/** DEBUG: clear all boats */
export function __debugClearBoats() {
    mockBoats = [];
    saveMockBoats(mockBoats);
}
