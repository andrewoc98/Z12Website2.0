import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { CoachProfile } from "../types/coachAssignment";

export function useClubCoaches(clubId: string | null) {
    const [coaches, setCoaches] = useState<CoachProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!clubId) {
            setCoaches([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        async function load() {
            try {
                const membersSnap = await getDocs(
                    query(
                        collection(db, "clubs", clubId!, "members"),
                        where("role",   "==", "coach"),
                        where("status", "==", "active"),
                    ),
                );

                if (membersSnap.empty) {
                    if (!cancelled) { setCoaches([]); setLoading(false); }
                    return;
                }

                const uids = membersSnap.docs.map(d => d.id);
                const userSnaps = await Promise.all(uids.map(uid => getDoc(doc(db, "users", uid))));

                if (cancelled) return;

                const profiles: CoachProfile[] = userSnaps
                    .filter(s => s.exists())
                    .map(s => {
                        const data = s.data()!;
                        return {
                            uid:            s.id,
                            displayName:    data.displayName ?? "",
                            openAssignment: data.roles?.coach?.openAssignment ?? true,
                        };
                    });

                setCoaches(profiles);
            } catch (err) {
                console.error("[useClubCoaches] query failed:", err);
                if (!cancelled) setError("Failed to load coaches.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [clubId]);

    return { coaches, loading, error };
}
