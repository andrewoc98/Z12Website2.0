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