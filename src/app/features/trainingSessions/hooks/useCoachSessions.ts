import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import type { Session } from '../types/session';

export function useCoachSessions(coachId: string | null) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    useEffect(() => {
        if (!coachId) {
            setSessions([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'sessions'),
            where('coachId', '==', coachId),
            orderBy('createdAt', 'desc'),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
                setLoading(false);
            },
            () => {
                setError('Failed to load sessions.');
                setLoading(false);
            },
        );

        return unsub;
    }, [coachId]);

    return { sessions, loading, error };
}
