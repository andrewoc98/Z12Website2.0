import { useEffect, useState, useCallback, useRef } from "react";
import { getPendingQueue, removePendingAction } from "./lib/pendingQueue";
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

    const refresh = useCallback(() => {
        setPendingQueue(getPendingQueue());
    }, []);

    const removeAction = useCallback((id: string) => {
        removePendingAction(id);
        refresh();
    }, [refresh]);

    const probe = useCallback(async () => {
        if (document.hidden) return; // skip if tab not visible
        const online = await checkConnectivity();
        setIsOnline(online);
        refresh();
        return online;
    }, [refresh]);

    const startPolling = useCallback((interval: number) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(probe, interval);
    }, [probe]);

    useEffect(() => {
        refresh();
        probe().then(online => {
            // Poll less frequently when offline to reduce noise
            startPolling(online ? 5000 : 10000);
        });

        // Use browser events as fast triggers only, not as source of truth
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