import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { CoachAssignment } from "../types/coachAssignment";

export function useCoachAssignments(rowerId: string | null) {
    const [assignments, setAssignments] = useState<CoachAssignment[]>([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState<string | null>(null);

    useEffect(() => {
        if (!rowerId) {
            setAssignments([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, "users", rowerId, "coachAssignments"),
            where("status", "in", ["active", "pending"]),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CoachAssignment)));
                setLoading(false);
            },
            () => {
                setError("Failed to load your coaches.");
                setLoading(false);
            },
        );

        return unsub;
    }, [rowerId]);

    return { assignments, loading, error };
}
