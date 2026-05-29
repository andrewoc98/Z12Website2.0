import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { RosterEntry } from "../types/coachAssignment";

export function useAthleteRoster(coachId: string | null) {
    const [roster, setRoster]   = useState<RosterEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!coachId) {
            setRoster([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, "users", coachId, "athleteRoster"),
            where("status", "in", ["active", "pending"]),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() } as RosterEntry)));
                setLoading(false);
            },
            () => {
                setError("Failed to load your athletes.");
                setLoading(false);
            },
        );

        return unsub;
    }, [coachId]);

    return { roster, loading, error };
}
