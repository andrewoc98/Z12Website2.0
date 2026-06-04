import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import Navbar from '../../../shared/components/Navbar/Navbar';
import {
    startPiece, stopBoat, markBoatDNF, completePiece, finishSession,
} from '../services/sessionService';
import { formatTime } from '../types/session';
import type { Session, PieceResult } from '../types/session';
import '../trainingSessions.css';

type Phase = 'ready' | 'running' | 'results';

interface LiveResult {
    resultId: string;
    boatId: string;
    displayName: string;
    status: 'running' | 'finished' | 'dnf';
    elapsedMs: number | null;
    split500mMs: number | null;
}

export default function SessionRunPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const [session, setSession]         = useState<Session | null>(null);
    const [loading, setLoading]         = useState(true);
    const [pieceIdx, setPieceIdx]       = useState(0);
    const [phase, setPhase]             = useState<Phase>('ready');
    const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
    const [displayMs, setDisplayMs]     = useState(0);

    const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef  = useRef<number | null>(null);
    const boatResultIds = useRef<Record<string, string>>({});

    function stopTimer() {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    function startTimer(fromMs: number) {
        startTimeRef.current = fromMs;
        setDisplayMs(Date.now() - fromMs);
        intervalRef.current = setInterval(() => {
            setDisplayMs(Date.now() - startTimeRef.current!);
        }, 100);
    }

    // Load session on mount, then determine which phase to restore
    useEffect(() => {
        if (!sessionId) return;

        (async () => {
            const snap = await getDoc(doc(db, 'sessions', sessionId));
            if (!snap.exists()) {
                setLoading(false);
                return;
            }
            const s = { id: snap.id, ...snap.data() } as Session;
            setSession(s);

            // Find the active or first pending piece
            const activePieceIdx = s.pieces.findIndex(p => p.status === 'active');
            const pendingPieceIdx = s.pieces.findIndex(p => p.status === 'pending');

            if (activePieceIdx >= 0) {
                // Resume an in-progress piece
                setPieceIdx(activePieceIdx);
                await restoreActivePiece(s, activePieceIdx);
            } else if (pendingPieceIdx >= 0) {
                setPieceIdx(pendingPieceIdx);
                setPhase('ready');
            } else {
                // All pieces completed — go to results
                navigate(`/coach/sessions/${sessionId}/results`, { replace: true });
                return;
            }

            setLoading(false);
        })();

        return () => stopTimer();
    }, [sessionId]);

    async function restoreActivePiece(s: Session, idx: number) {
        const piece = s.pieces[idx];
        const startMs = piece.startTimestamp?.toMillis() ?? Date.now();

        // Fetch existing pieceResults for this piece
        const q = query(
            collection(db, 'pieceResults'),
            where('sessionId', '==', s.id),
            where('pieceNumber', '==', piece.pieceNumber),
            where('coachId', '==', s.coachId),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            // startPiece was called but results weren't written (shouldn't happen) — go ready
            setPhase('ready');
            return;
        }

        const results: LiveResult[] = [];
        const ids: Record<string, string> = {};
        for (const d of snap.docs) {
            const r = d.data() as PieceResult;
            ids[r.boatId] = d.id;
            results.push({
                resultId: d.id,
                boatId: r.boatId,
                displayName: r.displayName,
                status: r.status,
                elapsedMs: r.elapsedMs,
                split500mMs: r.split500mMs,
            });
        }

        boatResultIds.current = ids;
        setLiveResults(results);

        const allDone = results.every(r => r.status !== 'running');
        if (allDone) {
            setPhase('results');
        } else {
            setPhase('running');
            startTimer(startMs);
        }
    }

    async function handleStartPiece() {
        if (!session || !sessionId) return;
        const ids = await startPiece(sessionId, session, pieceIdx);
        boatResultIds.current = ids;

        // Re-fetch session to get startTimestamp
        const snap = await getDoc(doc(db, 'sessions', sessionId));
        const refreshed = { id: snap.id, ...snap.data() } as Session;
        setSession(refreshed);
        const startMs = refreshed.pieces[pieceIdx].startTimestamp!.toMillis();

        // Rebuild liveResults with displayName from refreshed session
        const withNames: LiveResult[] = refreshed.pieces[pieceIdx].boats.map(b => ({
            resultId: ids[b.boatId],
            boatId: b.boatId,
            displayName: b.rowerNames.length === 1
                ? `${b.rowerNames[0]} (${b.boatClass})`
                : b.rowerNames.length === 2
                    ? `${b.rowerNames[0].split(' ')[0]} & ${b.rowerNames[1].split(' ')[0]} (${b.boatClass})`
                    : `${b.rowerNames[0].split(' ')[0]} +${b.rowerNames.length - 1} (${b.boatClass})`,
            status: 'running',
            elapsedMs: null,
            split500mMs: null,
        }));

        setLiveResults(withNames);
        startTimer(startMs);
        setPhase('running');
    }

    function handleStopBoat(r: LiveResult) {
        if (r.status !== 'running') return;
        const start = startTimeRef.current!;
        const now = Date.now();
        const elapsedMs = now - start;
        const dist = session!.pieces[pieceIdx].distanceMeters;
        const split500mMs = Math.round((elapsedMs / dist) * 500);

        stopBoat(r.resultId, start, dist);

        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId
                    ? { ...x, status: 'finished' as const, elapsedMs, split500mMs }
                    : x,
            );
            if (updated.every(x => x.status !== 'running')) {
                stopTimer();
                setPhase('results');
            }
            return updated;
        });
    }

    function handleDNF(r: LiveResult) {
        if (r.status !== 'running') return;
        markBoatDNF(r.resultId);

        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId ? { ...x, status: 'dnf' as const } : x,
            );
            if (updated.every(x => x.status !== 'running')) {
                stopTimer();
                setPhase('results');
            }
            return updated;
        });
    }

    async function handleNextPiece() {
        if (!session || !sessionId) return;
        await completePiece(sessionId, session, pieceIdx);

        const snap = await getDoc(doc(db, 'sessions', sessionId));
        const refreshed = { id: snap.id, ...snap.data() } as Session;
        setSession(refreshed);

        const nextIdx = refreshed.pieces.findIndex((p, i) => i > pieceIdx && p.status === 'pending');
        if (nextIdx < 0) {
            await finishSession(sessionId);
            navigate(`/coach/sessions/${sessionId}/results`);
            return;
        }

        setPieceIdx(nextIdx);
        setLiveResults([]);
        setDisplayMs(0);
        boatResultIds.current = {};
        setPhase('ready');
    }

    async function handleFinishSession() {
        if (!session || !sessionId) return;
        await completePiece(sessionId, session, pieceIdx);
        await finishSession(sessionId);
        navigate(`/coach/sessions/${sessionId}/results`);
    }

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="ts-page page shell ts-loading">Loading session…</div>
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

    const piece = session.pieces[pieceIdx];
    const isLastPiece = session.pieces.slice(pieceIdx + 1).every(p => p.status === 'completed');

    return (
        <>
            <Navbar />
            <div className="ts-run-page">
                <div className="ts-run-header">
                    <span className="ts-run-header__session">{session.name}</span>
                    <span className="ts-run-header__piece">
                        Piece {piece.pieceNumber} of {session.pieces.length} — {piece.distanceMeters}m
                    </span>
                </div>

                {/* ── READY ─────────────────────────────────────────────── */}
                {phase === 'ready' && (
                    <div className="ts-run-ready">
                        <div className="ts-run-ready__athletes">
                            <p className="ts-run-ready__label">Boats</p>
                            {piece.boats.map(b => (
                                <div key={b.boatId} className="ts-run-ready__boat">
                                    {b.rowerNames.length === 1
                                        ? `${b.rowerNames[0]} (${b.boatClass})`
                                        : b.rowerNames.length === 2
                                            ? `${b.rowerNames[0].split(' ')[0]} & ${b.rowerNames[1].split(' ')[0]} (${b.boatClass})`
                                            : `${b.rowerNames[0].split(' ')[0]} +${b.rowerNames.length - 1} (${b.boatClass})`}
                                </div>
                            ))}
                        </div>
                        <button className="ts-btn-start" onClick={handleStartPiece}>
                            START PIECE
                        </button>
                    </div>
                )}

                {/* ── RUNNING ───────────────────────────────────────────── */}
                {phase === 'running' && (
                    <div className="ts-run-live">
                        <div className="ts-run-timer">{formatTime(displayMs)}</div>
                        <div className="ts-run-boats">
                            {liveResults.map(r => (
                                <div
                                    key={r.boatId}
                                    className={`ts-boat-btn ts-boat-btn--${r.status}`}
                                >
                                    <button
                                        className="ts-boat-btn__tap"
                                        onClick={() => handleStopBoat(r)}
                                        disabled={r.status !== 'running'}
                                    >
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        {r.status === 'running' && (
                                            <span className="ts-boat-btn__status">RUNNING</span>
                                        )}
                                        {r.status === 'finished' && r.elapsedMs != null && (
                                            <span className="ts-boat-btn__result">
                                                {formatTime(r.elapsedMs)}
                                                {r.split500mMs != null && (
                                                    <> · {formatTime(r.split500mMs)}/500m</>
                                                )}
                                            </span>
                                        )}
                                        {r.status === 'dnf' && (
                                            <span className="ts-boat-btn__dnf">DNF</span>
                                        )}
                                    </button>
                                    {r.status === 'running' && (
                                        <button
                                            className="ts-boat-btn__dnf-btn"
                                            onClick={() => handleDNF(r)}
                                            aria-label="Mark DNF"
                                        >
                                            DNF
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── RESULTS ───────────────────────────────────────────── */}
                {phase === 'results' && (
                    <div className="ts-run-results">
                        <h2 className="ts-run-results__title">
                            Piece {piece.pieceNumber} Results — {piece.distanceMeters}m
                        </h2>
                        <div className="ts-run-results__list">
                            {[...liveResults]
                                .sort((a, b) => {
                                    if (a.status === 'dnf' && b.status !== 'dnf') return 1;
                                    if (b.status === 'dnf' && a.status !== 'dnf') return -1;
                                    return (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity);
                                })
                                .map((r, pos) => (
                                    <div key={r.boatId} className="ts-result-row">
                                        <span className="ts-result-row__pos">
                                            {r.status !== 'dnf' ? pos + 1 : '—'}
                                        </span>
                                        <div className="ts-result-row__body">
                                            <span className="ts-result-row__name">{r.displayName}</span>
                                            {r.status === 'finished' && r.elapsedMs != null && (
                                                <span className="ts-result-row__time">
                                                    {formatTime(r.elapsedMs)}
                                                    {r.split500mMs != null && (
                                                        <span className="ts-result-row__split">
                                                            {formatTime(r.split500mMs)}/500m
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {r.status === 'dnf' && (
                                                <span className="ts-result-row__time ts-result-row__time--dnf">DNF</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="ts-run-results__actions">
                            {isLastPiece ? (
                                <button className="ts-btn-finish" onClick={handleFinishSession}>
                                    FINISH SESSION
                                </button>
                            ) : (
                                <button className="ts-btn-next" onClick={handleNextPiece}>
                                    NEXT PIECE
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
