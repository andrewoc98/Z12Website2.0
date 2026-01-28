import { DEV_MODE } from "../../../shared/lib/config";
import type {EventCategory, EventDoc, EventStatus, FirestoreEventDoc} from "../types";

// Firestore
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import {mapEvent} from "../lib/mapper.tsx";

// --------------------
// Helpers (keep as-is)
// --------------------
function toCategory(id: string): EventCategory {
    return { id, name: id };
}

export function categoriesFromIds(ids: string[]): EventCategory[] {
    const unique = Array.from(new Set(ids));
    return unique.map(toCategory);
}

export function dateInputToTimestampLocalMidday(dateStr: string): Timestamp {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
    return Timestamp.fromDate(dt);
}

// --------------------
// DEV MODE storage
// --------------------
type EventWithId = EventDoc & { id: string };

const LS_KEY = "z12_mock_events_v1";

function loadMockEvents(): EventWithId[] {
    if (!DEV_MODE) return [];
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as EventWithId[]) : [];
    } catch {
        return [];
    }
}

function saveMockEvents(events: EventWithId[]) {
    if (!DEV_MODE) return;
    localStorage.setItem(LS_KEY, JSON.stringify(events));
}

let mockEvents: EventWithId[] = DEV_MODE ? loadMockEvents() : [];

// --------------------
// Types
// --------------------
export type CreateEventInput = {
    name: string;
    description: string;
    location: string;

    startAt: Timestamp;
    endAt: Timestamp;
    closeAt: Timestamp;

    lengthMeters: number;
    categories: EventCategory[];

    status: EventStatus;

    createdByUid: string;
    createdByName: string;
};

// --------------------
// API
// --------------------
export async function createEvent(input: CreateEventInput): Promise<string> {
    if (DEV_MODE) {
        const id = crypto.randomUUID();
        const created: EventWithId = {
            ...(input as any),
            id,
            createdAt: Date.now() as any,
            updatedAt: Date.now() as any,
        };
        mockEvents = [created, ...mockEvents];
        saveMockEvents(mockEvents);
        return id;
    }

    const ref = await addDoc(collection(db, "events"), {
        ...input,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return ref.id;
}

export async function listEvents(): Promise<EventWithId[]> {
    if (DEV_MODE) {
        // sort newest first by startAt where possible
        return mockEvents.slice();
    }

    const q = query(collection(db, "events"), orderBy("startAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapEvent(d.id, d.data() as FirestoreEventDoc));
}

export async function getEvent(eventId: string): Promise<EventWithId | null> {
    if (!eventId) return null;

    if (DEV_MODE) {
        return mockEvents.find((e) => e.id === eventId) ?? null;
    }

    const snap = await getDoc(doc(db, "events", eventId));
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreEventDoc;
    return mapEvent(snap.id, data);
}

export async function updateEvent(eventId: string, patch: Partial<EventDoc>): Promise<void> {
    if (!eventId) throw new Error("updateEvent: missing eventId");

    if (DEV_MODE) {
        mockEvents = mockEvents.map((e) =>
            e.id === eventId ? ({ ...e, ...patch, updatedAt: Date.now() as any } as any) : e
        );
        saveMockEvents(mockEvents);
        return;
    }

    const clean: any = {};
    for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) clean[k] = v;
    }
    clean.updatedAt = serverTimestamp();

    await updateDoc(doc(db, "events", eventId), clean);
}
