import { useEffect, useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useRoles } from "../../providers/RoleProvider";
import { useTourMock } from "../../providers/TourMockContext";
import { TOUR_TIMING_EVENTS } from "../home/components/tourMockData";
import { getTimingEvents } from "./api/timing";

export function useTimingEvents() {
    const { isTourActive } = useTourMock();
    const { user } = useAuth();
    const { profile } = useRoles();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isTourActive) {
            setEvents(TOUR_TIMING_EVENTS);
            setLoading(false);
            return;
        }

        if (!user || !profile) {
            setEvents([]);
            setLoading(false);
            return;
        }

        getTimingEvents(user.uid, profile.roles).then(setEvents).finally(() => setLoading(false));
    }, [user, profile, isTourActive]);

    return { events, loading };
}