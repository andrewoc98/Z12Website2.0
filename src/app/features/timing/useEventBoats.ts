import { useEffect, useState } from "react";
import { subscribeToEventBoats } from "./api/timing";
import { useTourMock } from "../../providers/TourMockContext";
import { TOUR_TIMING_BOATS } from "../home/components/tourMockData";
import type { BoatTimingDoc } from "./types";

export function useEventBoats(eventId: string | null) {
    const { isTourActive } = useTourMock();
    const [boats, setBoats] = useState<BoatTimingDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isTourActive) {
            setBoats(TOUR_TIMING_BOATS);
            setLoading(false);
            return;
        }

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
    }, [eventId, isTourActive]);

    return { boats, loading };
}