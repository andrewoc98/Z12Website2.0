import { useEffect, useState } from "react";
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { EventDoc } from "../../events/types.ts";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_RACE_RESULTS } from "../../home/components/tourMockData";

export interface UserRaceResult {
    id: string;
    eventId: string;
    eventName: string;
    eventLengthMeters: number;
    categoryId: string;
    categoryName: string;
    rowerUid: string;
    clubName: string;
    startedAt: number;
    finishedAt: number;
    time: number;
    place: number;
    totalInCategory: number;
}

// Requires a Firestore collection group index on boats.rowerUids (array-contains).
export function useUserResults(uid: string) {
    const [results, setResults] = useState<UserRaceResult[]>([]);
    const [loading, setLoading] = useState(true);
    const { isTourActive } = useTourMock();

    useEffect(() => {
        if (isTourActive) { setResults(TOUR_RACE_RESULTS); setLoading(false); return; }
        if (!uid) { setLoading(false); return; }

        async function load() {
            setLoading(true);
            try {
                // Single query across all events — no full events scan needed.
                const userBoatsSnap = await getDocs(
                    query(collectionGroup(db, "boats"), where("rowerUids", "array-contains", uid))
                );

                const userBoats = userBoatsSnap.docs
                    .filter(d => d.data().finishedAt && d.data().startedAt)
                    .map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            eventId: data.eventId as string,
                            categoryId: data.categoryId as string,
                            categoryName: (data.categoryName ?? data.category ?? "—") as string,
                            clubName: (data.clubName ?? "—") as string,
                            startedAt: data.startedAt as number,
                            finishedAt: data.finishedAt as number,
                            time: (data.finishedAt as number) - (data.startedAt as number),
                        };
                    });

                if (!userBoats.length) {
                    setResults([]);
                    return;
                }

                const eventIds = [...new Set(userBoats.map(b => b.eventId))];

                // Fetch event metadata and full boat lists for placing — all in parallel.
                const [eventSnaps, boatSnaps] = await Promise.all([
                    Promise.all(eventIds.map(id => getDoc(doc(db, "events", id)))),
                    Promise.all(eventIds.map(id => getDocs(collection(db, "events", id, "boats")))),
                ]);

                const eventMap: Record<string, EventDoc> = {};
                eventSnaps.forEach(snap => {
                    if (snap.exists()) eventMap[snap.id] = { id: snap.id, ...(snap.data() as Omit<EventDoc, "id">) };
                });

                const allBoatsByEvent: Record<string, Array<{ id: string; categoryId: string; time: number }>> = {};
                boatSnaps.forEach((snap, i) => {
                    allBoatsByEvent[eventIds[i]] = snap.docs
                        .filter(d => d.data().finishedAt && d.data().startedAt)
                        .map(d => ({
                            id: d.id,
                            categoryId: d.data().categoryId,
                            time: d.data().finishedAt - d.data().startedAt,
                        }));
                });

                const resultsWithPlace: UserRaceResult[] = userBoats.map(boat => {
                    const event = eventMap[boat.eventId];
                    const sameCategory = (allBoatsByEvent[boat.eventId] ?? []).filter(
                        b => b.categoryId === boat.categoryId
                    );
                    const sorted = [...sameCategory].sort((a, b) => a.time - b.time);
                    const idx = sorted.findIndex(b => b.id === boat.id);

                    return {
                        ...boat,
                        rowerUid: uid,
                        eventName: event?.name ?? boat.eventId,
                        eventLengthMeters: event?.lengthMeters ?? 2000,
                        place: idx >= 0 ? idx + 1 : 1,
                        totalInCategory: sameCategory.length,
                    };
                });

                resultsWithPlace.sort((a, b) => b.finishedAt - a.finishedAt);
                setResults(resultsWithPlace);
            } catch (err) {
                console.error("Failed to load results:", err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [uid, isTourActive]);

    return { results, loading };
}
