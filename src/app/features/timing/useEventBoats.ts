import { useEffect, useState } from "react";
import { subscribeToEventBoats } from "./api/timing";
import type { BoatTimingDoc } from "./types";

export function useEventBoats(eventId: string | null) {
    const [boats, setBoats] = useState<BoatTimingDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) {
            setBoats([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = subscribeToEventBoats(eventId, (newBoats: BoatTimingDoc[]) => {
            setBoats(newBoats);
            setLoading(false);
        });

        return () => unsub();
    }, [eventId]);

    return { boats, loading };
}