import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import type { Session } from '../types/session';
import { useTourMock } from '../../../providers/TourMockContext';
import { TOUR_COACH_SESSIONS } from '../../home/components/tourMockData';

export function useCoachSessions(coachId: string | null) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);
    const { isTourActive } = useTourMock();

    useEffect(() => {
        if (isTourActive) {
            setSessions(TOUR_COACH_SESSIONS);
            setLoading(false);
            return;
        }

        if (!coachId) {
            setSessions([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'sessions'),
            where('coachId', '==', coachId),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const sorted = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Session))
                    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSessions(sorted);
                setLoading(false);
            },
            () => {
                setError('Failed to load sessions.');
                setLoading(false);
            },
        );

        return unsub;
    }, [coachId, isTourActive]);

    return { sessions, loading, error };
}
