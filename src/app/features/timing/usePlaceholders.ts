import { useEffect, useState } from "react";
import { subscribeToPlaceholders } from "./api/timing";
import type { PlaceholderFinish } from "./types";

export function usePlaceholders(eventId: string | null) {
    const [placeholders, setPlaceholders] = useState<PlaceholderFinish[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) {
            setPlaceholders([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = subscribeToPlaceholders(eventId, (newPlaceholders: PlaceholderFinish[]) => {
            setPlaceholders(newPlaceholders);
            setLoading(false);
        });

        return () => unsub();
    }, [eventId]);

    return { placeholders, loading };
}