import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {db} from "../../../shared/lib/firebase";

// Persistent queue for timing actions that haven't synced yet
export type PendingAction = {
    id: string;
    type: "start" | "stop" | "placeholder" | "assign_placeholder";
    eventId: string;
    boatId?: string;
    placeholderId?: string;
    timestamp: number;
    data?: Record<string, any>;
};

const STORAGE_KEY = "timing_pending_queue";

export function getPendingQueue(): PendingAction[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function addToPendingQueue(action: Omit<PendingAction, "id">): PendingAction {
    const queue = getPendingQueue();
    const newAction: PendingAction = {
        ...action,
        id: crypto.randomUUID(),
    };
    queue.push(newAction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return newAction;
}

export function removePendingAction(actionId: string): void {
    const queue = getPendingQueue();
    const filtered = queue.filter(a => a.id !== actionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearPendingQueue(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export async function flushPendingQueue(): Promise<{ flushed: number; failed: number }> {
    const queue = getPendingQueue();
    if (queue.length === 0) return { flushed: 0, failed: 0 };

    let flushed = 0;
    let failed = 0;

    for (const action of queue) {
        try {
            await replayAction(action);
            removePendingAction(action.id);
            flushed++;
        } catch (err) {
            console.error(`Failed to replay action ${action.id} (${action.type}):`, err);
            failed++;
        }
    }

    return { flushed, failed };
}

async function replayAction(action: PendingAction): Promise<void> {
    switch (action.type) {
        case "start": {
            const ref = doc(db, "events", action.eventId, "boats", action.boatId!);
            await updateDoc(ref, {
                ...action.data,
                updatedAt: serverTimestamp(),
            });
            break;
        }
        case "stop": {
            const ref = doc(db, "events", action.eventId, "boats", action.boatId!);
            await updateDoc(ref, {
                ...action.data,
                updatedAt: serverTimestamp(),
            });
            break;
        }
        case "placeholder": {
            const ref = collection(db, "events", action.eventId, "placeholders");
            await addDoc(ref, {
                ...action.data,
                createdAt: serverTimestamp(),
            });
            break;
        }
        case "assign_placeholder": {
            const boatRef = doc(db, "events", action.eventId, "boats", action.boatId!);
            const placeholderRef = doc(db, "events", action.eventId, "placeholders", action.placeholderId!);
            await updateDoc(boatRef, {
                ...action.data,
                updatedAt: serverTimestamp(),
            });
            await deleteDoc(placeholderRef);
            break;
        }
        default:
            throw new Error(`Unknown action type: ${(action as any).type}`);
    }
}