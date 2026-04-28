import { useEffect, useState, useCallback, useRef } from "react";
import { flushPendingQueue, getPendingQueue, removePendingAction } from "./lib/pendingQueue";
import type { PendingAction } from "./lib/pendingQueue";

async function checkConnectivity(): Promise<boolean> {
    try {
        const res = await fetch(`${window.location.origin}/index.html`, {
            method: "HEAD",
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export function useConnectionStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingQueue, setPendingQueue] = useState<PendingAction[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wasOnlineRef = useRef<boolean>(navigator.onLine);
    const isFlushing = useRef(false);

    const refresh = useCallback(() => {
        setPendingQueue(getPendingQueue());
    }, []);

    const removeAction = useCallback((id: string) => {
        removePendingAction(id);
        refresh();
    }, [refresh]);

    const flush = useCallback(async () => {
        if (isFlushing.current) return;
        isFlushing.current = true;
        try {
            const { flushed, failed } = await flushPendingQueue();
            if (flushed > 0 || failed > 0) {
                console.log(`Queue flush: ${flushed} synced, ${failed} failed`);
            }
        } finally {
            isFlushing.current = false;
            refresh();
        }
    }, [refresh]);

    const probe = useCallback(async () => {
        if (document.hidden) return;
        const online = await checkConnectivity();
        setIsOnline(online);

        // Reconnection detected — flush the queue
        if (online && !wasOnlineRef.current) {
            wasOnlineRef.current = true;
            await flush();
        } else if (!online) {
            wasOnlineRef.current = false;
        }

        refresh();
        return online;
    }, [refresh, flush]);

    const startPolling = useCallback((interval: number) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(probe, interval);
    }, [probe]);

    useEffect(() => {
        refresh();
        probe().then(online => {
            startPolling(online ? 5000 : 10000);
        });

        const onOnline = () => { probe(); startPolling(5000); };
        const onOffline = () => { probe(); startPolling(10000); };
        const onVisible = () => { if (!document.hidden) probe(); };

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [probe, refresh, startPolling]);

    return { isOnline, pendingCount: pendingQueue.length, pendingQueue, removeAction };
}