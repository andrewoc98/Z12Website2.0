import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { formatTime } from '../types/session';
import type { Session, PieceResult } from '../types/session';

export default function SessionResultsPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [session, setSession]   = useState<Session | null>(null);
    const [results, setResults]   = useState<PieceResult[]>([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        if (!sessionId || !user) return;
        (async () => {
            const [sessionSnap, resultsSnap] = await Promise.all([
                getDoc(doc(db, 'sessions', sessionId)),
                getDocs(query(
                    collection(db, 'pieceResults'),
                    where('sessionId', '==', sessionId),
                    where('coachId', '==', user.uid),
                )),
            ]);
            if (sessionSnap.exists()) {
                setSession({ id: sessionSnap.id, ...sessionSnap.data() } as Session);
            }
            const all = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PieceResult));
            all.sort((a, b) => a.pieceNumber - b.pieceNumber || (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity));
            setResults(all);
            setLoading(false);
        })();
    }, [sessionId, user?.uid]);

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="ts-page page shell ts-loading">Loading results…</div>
            </>
        );
    }

    if (!session) {
        return (
            <>
                <Navbar />
                <div className="ts-page page shell ts-loading">Session not found.</div>
            </>
        );
    }

    const date = session.date.toDate().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });

    // Group results by piece
    const byPiece = new Map<number, PieceResult[]>();
    for (const r of results) {
        const arr = byPiece.get(r.pieceNumber) ?? [];
        arr.push(r);
        byPiece.set(r.pieceNumber, arr);
    }

    return (
        <>
            <Navbar />
            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <div>
                        <h1 className="ts-page__title">{session.name}</h1>
                        <p className="ts-page__subtitle">{date}</p>
                    </div>
                    <button className="btn-ghost" onClick={() => navigate('/coach/sessions')}>
                        ← Sessions
                    </button>
                </div>

                {byPiece.size === 0 && (
                    <p className="ts-muted">No results recorded for this session.</p>
                )}

                {Array.from(byPiece.entries()).map(([pieceNum, pieceResults]) => {
                    const dist = pieceResults[0]?.distanceMeters ?? 0;
                    const sorted = [...pieceResults].sort((a, b) => {
                        if (a.status === 'dnf' && b.status !== 'dnf') return 1;
                        if (b.status === 'dnf' && a.status !== 'dnf') return -1;
                        return (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity);
                    });
                    return (
                        <div key={pieceNum} className="ts-results-piece">
                            <h2 className="ts-results-piece__title">
                                Piece {pieceNum} — {dist}m
                            </h2>
                            <table className="ts-results-table">
                                <thead>
                                    <tr>
                                        <th className="ts-results-table__th ts-results-table__pos">#</th>
                                        <th className="ts-results-table__th">Boat</th>
                                        <th className="ts-results-table__th ts-results-table__time">Time</th>
                                        <th className="ts-results-table__th ts-results-table__split">500m Split</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r, i) => (
                                        <tr key={r.id} className={r.status === 'dnf' ? 'ts-results-table__row--dnf' : ''}>
                                            <td className="ts-results-table__td ts-results-table__pos">
                                                {r.status !== 'dnf' ? i + 1 : '—'}
                                            </td>
                                            <td className="ts-results-table__td">{r.displayName}</td>
                                            <td className="ts-results-table__td ts-results-table__time">
                                                {r.status === 'finished' && r.elapsedMs != null
                                                    ? formatTime(r.elapsedMs)
                                                    : 'DNF'}
                                            </td>
                                            <td className="ts-results-table__td ts-results-table__split">
                                                {r.status === 'finished' && r.split500mMs != null
                                                    ? formatTime(r.split500mMs)
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
