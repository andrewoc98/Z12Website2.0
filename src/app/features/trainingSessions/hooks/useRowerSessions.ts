import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import type { PieceResult } from '../types/session';
import { useTourMock } from '../../../providers/TourMockContext';
import { TOUR_ROWER_SESSIONS } from '../../home/components/tourMockData';

export interface RowerSessionSummary {
    sessionId: string;
    sessionName: string;
    pieceCount: number;
    latestStartMs: number;
}

export function useRowerSessions(rowerId: string | null) {
    const [sessions, setSessions] = useState<RowerSessionSummary[]>([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const { isTourActive } = useTourMock();

    useEffect(() => {
        if (isTourActive) {
            setSessions(TOUR_ROWER_SESSIONS);
            setLoading(false);
            return;
        }

        if (!rowerId) {
            setSessions([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'pieceResults'),
            where('rowerIds', 'array-contains', rowerId),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const bySession = new Map<string, RowerSessionSummary>();
                for (const d of snap.docs) {
                    const r = d.data() as PieceResult;
                    const startMs = r.startTimestamp?.toMillis() ?? 0;
                    const existing = bySession.get(r.sessionId);
                    if (!existing) {
                        bySession.set(r.sessionId, {
                            sessionId: r.sessionId,
                            sessionName: r.sessionName,
                            pieceCount: 1,
                            latestStartMs: startMs,
                        });
                    } else {
                        existing.pieceCount += 1;
                        if (startMs > existing.latestStartMs) existing.latestStartMs = startMs;
                    }
                }
                setSessions(
                    Array.from(bySession.values()).sort((a, b) => b.latestStartMs - a.latestStartMs),
                );
                setLoading(false);
            },
            () => {
                setError('Failed to load sessions.');
                setLoading(false);
            },
        );

        return unsub;
    }, [rowerId, isTourActive]);

    return { sessions, loading, error };
}

export function useRowerSessionDetail(rowerId: string | null, sessionId: string | undefined) {
    const [results, setResults] = useState<PieceResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!rowerId || !sessionId) {
            setResults([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'pieceResults'),
            where('rowerIds', 'array-contains', rowerId),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as PieceResult));
                const mine = all
                    .filter(r => r.sessionId === sessionId)
                    .sort((a, b) => a.pieceNumber - b.pieceNumber);
                setResults(mine);

                setLoading(false);
            },
            () => {
                setError('Failed to load session details.');
                setLoading(false);
            },
        );

        return unsub;
    }, [rowerId, sessionId]);

    return { results, loading, error };
}
