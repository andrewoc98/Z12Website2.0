import {
    collection,
    onSnapshot,
    orderBy,
    query,
    where,
    type DocumentData,
} from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import type { ErgScoreDoc } from "../types";

export const ergScoresPath = (eventId: string) => `events/${eventId}/ergScores`;

function mapScore(id: string, data: DocumentData): ErgScoreDoc {
    return { ...(data as ErgScoreDoc), id };
}

/**
 * Live view of one athlete's scores for an event.
 *
 * Ordered newest-first so the athlete sees the piece they just rowed at the top;
 * the ranked one is whichever is fastest, flagged separately.
 */
export function subscribeToMyErgScores(
    eventId: string,
    uid: string,
    onChange: (scores: ErgScoreDoc[]) => void,
    onError?: (e: Error) => void,
) {
    const q = query(
        collection(db, ergScoresPath(eventId)),
        where("uid", "==", uid),
        orderBy("workoutAt", "desc"),
    );
    return onSnapshot(
        q,
        (snap) => onChange(snap.docs.map((d) => mapScore(d.id, d.data()))),
        (e) => onError?.(e),
    );
}

/** Live view of every score in an event — the host's review list. */
export function subscribeToAllErgScores(
    eventId: string,
    onChange: (scores: ErgScoreDoc[]) => void,
    onError?: (e: Error) => void,
) {
    return onSnapshot(
        collection(db, ergScoresPath(eventId)),
        (snap) => {
            // Sorted client-side to avoid a composite index, matching the
            // approach in subscribeToEventPayments.
            const scores = snap.docs
                .map((d) => mapScore(d.id, d.data()))
                .sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity));
            onChange(scores);
        },
        (e) => onError?.(e),
    );
}

/** `6:52.3` — the format Concept2 and the open-water ResultCard both use. */
export function formatErgTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** Average split per 500m, the number erg athletes actually compare. */
export function formatSplit(ms: number, distanceMeters: number): string {
    if (!distanceMeters) return "—";
    return `${formatErgTime((ms / distanceMeters) * 500)}/500m`;
}
