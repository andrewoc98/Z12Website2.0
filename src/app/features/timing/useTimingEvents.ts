import { useEffect, useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useRoles } from "../../providers/RoleProvider";
import { getTimingEvents } from "./api/timing";

export function useTimingEvents() {
    const { user } = useAuth();
    const { profile } = useRoles();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !profile) {
            setEvents([]);
            setLoading(false);
            return;
        }

        getTimingEvents(user.uid, profile.roles).then(setEvents).finally(() => setLoading(false));
    }, [user, profile]);

    return { events, loading };
}