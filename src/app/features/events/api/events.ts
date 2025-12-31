import { DEV_MODE } from "../../../shared/lib/config";
import type { EventDoc } from "../types";
import { MOCK_EVENTS } from "../mockEvents";

/**
 * In-memory mock store (resets on refresh)
 */
let mockEvents = [...MOCK_EVENTS];

/**
 * List all events (public)
 */
export async function listEvents(): Promise<EventDoc[]> {
    if (DEV_MODE) {
        // Ensure every event has a stable id
        mockEvents = mockEvents.map((e) => ({
            ...e,
            id: e.id ?? crypto.randomUUID(),
        }));

        return Promise.resolve(
            [...mockEvents].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        );
    }

    throw new Error("Firestore not wired yet");
}


/**
 * Create an event (host-only)
 */
export async function createEvent(event: EventDoc): Promise<EventDoc> {
    if (DEV_MODE) {
        const newEvent: EventDoc = {
            ...event,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        mockEvents = [newEvent, ...mockEvents];
        return Promise.resolve(newEvent);
    }

    throw new Error("Firestore not wired yet");
}

/**
 * Get event by ID
 */
export async function getEventById(
    eventId: string
): Promise<EventDoc | null> {
    if (DEV_MODE) {
        return Promise.resolve(
            mockEvents.find((e) => e.id === eventId) ?? null
        );
    }

    throw new Error("Firestore not wired yet");
}

export async function updateEvent(eventId: string, patch: Partial<EventDoc>): Promise<void> {
    if (DEV_MODE) {
        mockEvents = mockEvents.map((e) => (e.id === eventId ? { ...e, ...patch } : e));
        return Promise.resolve();
    }
    throw new Error("Firestore not wired yet");
}

