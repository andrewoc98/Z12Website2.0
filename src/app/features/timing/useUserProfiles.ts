import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../shared/lib/firebase";

export function useUserProfiles(uids: string[]) {
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (uids.length === 0) {
            setProfiles({});
            return;
        }

        setLoading(true);
        const fetchProfiles = async () => {
            const profilePromises = uids.map(async (uid) => {
                const snap = await getDoc(doc(db, "users", uid));
                return { uid, profile: snap.exists() ? snap.data() : null };
            });

            const results = await Promise.all(profilePromises);
            const newProfiles: Record<string, any> = {};
            results.forEach(({ uid, profile }) => {
                newProfiles[uid] = profile;
            });
            setProfiles(newProfiles);
            setLoading(false);
        };

        fetchProfiles();
    }, [uids]);

    return { profiles, loading };
}