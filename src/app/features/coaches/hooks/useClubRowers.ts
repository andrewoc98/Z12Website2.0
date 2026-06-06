import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { ClubRef } from "../../auth/types";

export interface ClubRower {
    uid: string;
    displayName: string;
    clubId: string;
    clubName: string;
}

export function useClubRowers(clubMemberships: ClubRef[]) {
    const [rowers, setRowers]   = useState<ClubRower[]>([]);
    const [loading, setLoading] = useState(true);

    const clubKey = clubMemberships
        .filter(m => m.membershipStatus === "active")
        .map(m => m.clubId)
        .sort()
        .join(",");

    useEffect(() => {
        const activeClubs = clubMemberships.filter(m => m.membershipStatus === "active");

        if (activeClubs.length === 0) {
            setRowers([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        async function load() {
            try {
                const seen    = new Set<string>();
                const results: ClubRower[] = [];

                for (const club of activeClubs) {
                    const snap = await getDocs(
                        query(
                            collection(db, "clubs", club.clubId, "members"),
                            where("role",   "==", "rower"),
                            where("status", "==", "active"),
                        ),
                    );
                    for (const d of snap.docs) {
                        if (!seen.has(d.id)) {
                            seen.add(d.id);
                            results.push({
                                uid:         d.id,
                                displayName: d.data().displayName ?? d.id,
                                clubId:      club.clubId,
                                clubName:    club.clubName,
                            });
                        }
                    }
                }

                if (!cancelled) {
                    setRowers(results.sort((a, b) => a.displayName.localeCompare(b.displayName)));
                    setLoading(false);
                }
            } catch {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clubKey]);

    return { rowers, loading };
}
