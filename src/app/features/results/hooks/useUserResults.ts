import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

export function useUserResults(uid: string) {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);

            try {
                // 1️⃣ Get all events
                const eventsSnapshot = await getDocs(collection(db, "events"));
                const events = eventsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                const allBoats: any[] = [];

                // 2️⃣ Collect all boats for this user across all events
                for (const event of events) {
                    const boatsRef = collection(db, "events", event.id, "boats");
                    const q = query(boatsRef, where("rowerUids", "array-contains", uid));
                    const boatsSnapshot = await getDocs(q);

                    boatsSnapshot.docs.forEach((doc) => {
                        const d = doc.data();
                        if (!d.finishedAt || !d.startedAt) return;

                        allBoats.push({
                            id: doc.id,
                            eventId: event.id,
                            eventName: event.name ?? event.id,
                            categoryId: d.categoryId,
                            categoryName: d.categoryName ?? d.category,
                            rowerUid: uid,
                            rowerName: d.rowerName ?? "Unknown",
                            clubName: d.clubName ?? "—",
                            startedAt: d.startedAt,
                            finishedAt: d.finishedAt,
                            time: d.finishedAt - d.startedAt,
                        });
                    });
                }

                // 3️⃣ Compute placing for each boat (per event & category)
                const resultsWithPlace = allBoats.map((boat) => {
                    const sameGroup = allBoats.filter(
                        (b) =>
                            b.eventId === boat.eventId && b.categoryId === boat.categoryId
                    );

                    const sorted = [...sameGroup].sort((a, b) => a.time - b.time);
                    const place = sorted.findIndex((b) => b.id === boat.id) + 1;

                    return { ...boat, place };
                });

                // 4️⃣ Sort most recent first
                resultsWithPlace.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

                setResults(resultsWithPlace);
            } catch (err) {
                console.error("Failed to load results:", err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [uid]);

    return { results, loading };
}
