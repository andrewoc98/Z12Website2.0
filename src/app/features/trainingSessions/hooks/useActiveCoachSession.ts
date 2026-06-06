import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import type { Session } from '../types/session';

export function useActiveCoachSession(coachId: string | null) {
    const [activeSession, setActiveSession] = useState<Session | null>(null);

    useEffect(() => {
        if (!coachId) {
            setActiveSession(null);
            return;
        }

        const q = query(
            collection(db, 'sessions'),
            where('coachId', '==', coachId),
        );

        return onSnapshot(q, (snap) => {
            const active = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as Session))
                .find(s => s.status === 'active') ?? null;
            setActiveSession(active);
        }, () => {
            setActiveSession(null);
        });
    }, [coachId]);

    return activeSession;
}
