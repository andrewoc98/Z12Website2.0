import { useEffect, useState } from "react";
import type { EventDoc } from "./types.ts";
import { listEvents } from "./api/events";

export function useEventList() {
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    useEffect(() => {
        listEvents().then((e) => {
            console.log("Loaded events:", e);
            setEvents(e);
            setLoading(false);
        });
    }, []);


    async function refresh() {
        setLoading(true);
        setError(null);
        try {
            const data = await listEvents();
            setEvents(data);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load events");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return { events, loading, error, refresh };
}
