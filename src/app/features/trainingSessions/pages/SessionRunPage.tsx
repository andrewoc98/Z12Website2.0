import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import {
    startPiece, stopBoat, markBoatDNF, completePiece, finishSession,
    startBoatTimeTrial,
} from '../services/sessionService';
import { formatTime, boatDisplayLabel } from '../types/session';
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
    const { profile } = useAuth();

    const [session, setSession]             = useState<Session | null>(null);
    const [loading, setLoading]             = useState(true);
    const [pieceIdx, setPieceIdx]           = useState(0);
    const [phase, setPhase]                 = useState<Phase>('ready');
    const [liveResults, setLiveResults]     = useState<LiveResult[]>([]);
    const [displayMs, setDisplayMs]         = useState(0);

    // Time trial: per-boat start times (boatId → epoch ms) and display elapsed
    const [perBoatElapsed, setPerBoatElapsed] = useState<Record<string, number>>({});
    const ttBoatStartTimes = useRef<Record<string, number>>({});

    const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef   = useRef<number | null>(null);
    const boatResultIds  = useRef<Record<string, string>>({});

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

    function startTTTimers() {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            const now = Date.now();
            setPerBoatElapsed(
                Object.fromEntries(
                    Object.entries(ttBoatStartTimes.current).map(([id, t]) => [id, now - t]),
                ),
            );
        }, 100);
    }

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

            const activePieceIdx  = s.pieces.findIndex(p => p.status === 'active');
            const pendingPieceIdx = s.pieces.findIndex(p => p.status === 'pending');

            if (activePieceIdx >= 0) {
                setPieceIdx(activePieceIdx);
                await restoreActivePiece(s, activePieceIdx);
            } else if (pendingPieceIdx >= 0) {
                setPieceIdx(pendingPieceIdx);
                setPhase('ready');
            } else {
                navigate(`/coach/sessions/${sessionId}/results`, { replace: true });
                return;
            }

            setLoading(false);
        })();

        return () => stopTimer();
    }, [sessionId]);

    async function restoreActivePiece(s: Session, idx: number) {
        const piece = s.pieces[idx];
        const isTimeTrial = (s.sessionType ?? 'race') === 'time_trial';

        const q = query(
            collection(db, 'pieceResults'),
            where('sessionId', '==', s.id),
            where('pieceNumber', '==', piece.pieceNumber),
            where('coachId', '==', s.coachId),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
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

        if (isTimeTrial) {
            const runningResults = results.filter(r => r.status === 'running');
            const allStarted = results.length >= piece.boats.length;
            const allDone = results.every(r => r.status !== 'running');

            if (allStarted && allDone) {
                setPhase('results');
            } else {
                // Restore per-boat start times for any currently running boats
                for (const rr of runningResults) {
                    const runDoc = snap.docs.find(d => d.id === rr.resultId);
                    const startMs = (runDoc!.data() as PieceResult).startTimestamp.toMillis();
                    ttBoatStartTimes.current[rr.boatId] = startMs;
                }
                if (runningResults.length > 0) {
                    startTTTimers();
                }
                setPhase(results.length > 0 ? 'running' : 'ready');
            }
            return;
        }

        // Race mode restore
        const allDone = results.every(r => r.status !== 'running');
        if (allDone) {
            setPhase('results');
        } else {
            const startMs = piece.startTimestamp?.toMillis() ?? Date.now();
            setPhase('running');
            startTimer(startMs);
        }
    }

    // ── Race mode handlers ─────────────────────────────────────────────────────

    async function handleStartPiece() {
        if (!session || !sessionId) return;
        const ids = await startPiece(sessionId, session, pieceIdx);
        boatResultIds.current = ids;

        const snap = await getDoc(doc(db, 'sessions', sessionId));
        const refreshed = { id: snap.id, ...snap.data() } as Session;
        setSession(refreshed);
        const startMs = refreshed.pieces[pieceIdx].startTimestamp!.toMillis();

        const withNames: LiveResult[] = refreshed.pieces[pieceIdx].boats.map(b => ({
            resultId: ids[b.boatId],
            boatId: b.boatId,
            displayName: boatDisplayLabel(b.rowerNames, b.boatClass),
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

    // ── Time trial mode handlers ───────────────────────────────────────────────

    async function handleStartBoatTT(boatIdx: number) {
        if (!session || !sessionId) return;
        const { resultId, startMs } = await startBoatTimeTrial(sessionId, session, pieceIdx, boatIdx);

        if (boatIdx === 0) {
            // Refresh session to pick up the piece startTimestamp written for first boat
            const snap = await getDoc(doc(db, 'sessions', sessionId));
            setSession({ id: snap.id, ...snap.data() } as Session);
        }

        const boat = session.pieces[pieceIdx].boats[boatIdx];
        ttBoatStartTimes.current[boat.boatId] = startMs;

        setLiveResults(prev => [...prev, {
            resultId,
            boatId: boat.boatId,
            displayName: boatDisplayLabel(boat.rowerNames, boat.boatClass),
            status: 'running' as const,
            elapsedMs: null,
            split500mMs: null,
        }]);

        startTTTimers();
        setPhase('running');
    }

    function handleStopBoatTT(r: LiveResult) {
        if (r.status !== 'running') return;
        const startMs = ttBoatStartTimes.current[r.boatId];
        const elapsedMs = Date.now() - startMs;
        const dist = session!.pieces[pieceIdx].distanceMeters;
        const split500mMs = Math.round((elapsedMs / dist) * 500);

        stopBoat(r.resultId, startMs, dist);
        delete ttBoatStartTimes.current[r.boatId];

        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId
                    ? { ...x, status: 'finished' as const, elapsedMs, split500mMs }
                    : x,
            );
            const boatCount = session!.pieces[pieceIdx].boats.length;
            if (updated.length >= boatCount && updated.every(x => x.status !== 'running')) {
                stopTimer();
                setPhase('results');
            }
            return updated;
        });
    }

    function handleDNFTT(r: LiveResult) {
        if (r.status !== 'running') return;
        markBoatDNF(r.resultId);
        delete ttBoatStartTimes.current[r.boatId];

        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId ? { ...x, status: 'dnf' as const } : x,
            );
            const boatCount = session!.pieces[pieceIdx].boats.length;
            if (updated.length >= boatCount && updated.every(x => x.status !== 'running')) {
                stopTimer();
                setPhase('results');
            }
            return updated;
        });
    }

    // ── Shared piece navigation ────────────────────────────────────────────────

    async function handleNextPiece() {
        if (!session || !sessionId) return;
        await completePiece(sessionId, session, pieceIdx);

        const snap = await getDoc(doc(db, 'sessions', sessionId));
        const refreshed = { id: snap.id, ...snap.data() } as Session;
        setSession(refreshed);

        const nextIdx = refreshed.pieces.findIndex((p, i) => i > pieceIdx && p.status === 'pending');
        if (nextIdx < 0) {
            await finishSession(sessionId);
            navigate(profile?.uid === session.coachId
                ? `/coach/sessions/${sessionId}/results`
                : '/');
            return;
        }

        setPieceIdx(nextIdx);
        setLiveResults([]);
        setDisplayMs(0);
        ttBoatStartTimes.current = {};
        setPerBoatElapsed({});
        boatResultIds.current = {};
        setPhase('ready');
    }

    async function handleFinishSession() {
        if (!session || !sessionId) return;
        await completePiece(sessionId, session, pieceIdx);
        await finishSession(sessionId);
        navigate(profile?.uid === session.coachId
            ? `/coach/sessions/${sessionId}/results`
            : '/');
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

    // Role detection — must happen before access guard
    const isCoach     = profile?.uid === session.coachId;
    const isAssistant = !isCoach && !!session.timingAssistantEmail
        && profile?.email === session.timingAssistantEmail;

    if (!isCoach && !isAssistant) {
        return (
            <>
                <Navbar />
                <div className="ts-page page shell ts-loading">
                    You don't have access to this session.
                </div>
            </>
        );
    }

    const piece      = session.pieces[pieceIdx];
    const isLastPiece = session.pieces.slice(pieceIdx + 1).every(p => p.status === 'completed');
    const isTimeTrial = (session.sessionType ?? 'race') === 'time_trial';
    const boatCount  = piece.boats.length;

    const roleLabel   = isCoach ? 'Coach' : 'Assistant';

    const pieceSubtitle = isTimeTrial
        ? `Piece ${piece.pieceNumber} of ${session.pieces.length} — ${piece.distanceMeters}m · Time Trial`
        : `Piece ${piece.pieceNumber} of ${session.pieces.length} — ${piece.distanceMeters}m`;

    return (
        <>
            <Navbar />
            <div className="ts-run-page">
                <div className="ts-run-header">
                    <span className="ts-run-header__session">
                        {session.name}
                        {roleLabel && (
                            <span className="ts-run-header__role"> · {roleLabel}</span>
                        )}
                    </span>
                    <span className="ts-run-header__piece">{pieceSubtitle}</span>
                    {isTimeTrial && phase === 'running' && (
                        <span className="ts-run-header__boat">
                            {liveResults.filter(r => r.status === 'running').length} running
                            · {boatCount - liveResults.length} to start
                        </span>
                    )}
                </div>

                {/* ── TIME TRIAL: READY ────────────────────────────────────── */}
                {isTimeTrial && phase === 'ready' && (
                    <div className="ts-run-ready">
                        <div className="ts-run-ready__athletes">
                            <p className="ts-run-ready__label">Boats</p>
                            {piece.boats.map((b, idx) => (
                                <div key={b.boatId} className="ts-run-ready__boat ts-run-ready__boat--tt">
                                    <span>{boatDisplayLabel(b.rowerNames, b.boatClass)}</span>
                                    <button className="ts-btn-start-sm" onClick={() => handleStartBoatTT(idx)}>
                                        START
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TIME TRIAL: RUNNING ──────────────────────────────────── */}
                {isTimeTrial && phase === 'running' && (
                    <div className="ts-run-live">
                        <div className="ts-run-boats">
                            {/* Running boats — tap to stop */}
                            {liveResults.filter(r => r.status === 'running').map(r => (
                                <div key={r.boatId} className="ts-boat-btn ts-boat-btn--running">
                                    <button
                                        className="ts-boat-btn__tap"
                                        onClick={() => handleStopBoatTT(r)}
                                    >
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        <span className="ts-boat-btn__result">
                                            {formatTime(perBoatElapsed[r.boatId] ?? 0)}
                                        </span>
                                        <span className="ts-boat-btn__status">TAP TO STOP</span>
                                    </button>
                                    <button
                                        className="ts-boat-btn__dnf-btn"
                                        onClick={() => handleDNFTT(r)}
                                        aria-label="Mark DNF"
                                    >
                                        DNF
                                    </button>
                                </div>
                            ))}
                            {/* Finished / DNF boats */}
                            {liveResults.filter(r => r.status !== 'running').map(r => (
                                <div key={r.boatId} className={`ts-boat-btn ts-boat-btn--${r.status}`}>
                                    <div className="ts-boat-btn__tap" style={{ cursor: 'default' }}>
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        {r.status === 'finished' && r.elapsedMs != null && (
                                            <span className="ts-boat-btn__result">{formatTime(r.elapsedMs)}</span>
                                        )}
                                        {r.status === 'dnf' && (
                                            <span className="ts-boat-btn__dnf">DNF</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* Not-yet-started boats */}
                            {piece.boats
                                .filter(b => !liveResults.find(r => r.boatId === b.boatId))
                                .map((b) => {
                                    const boatIdx = piece.boats.findIndex(x => x.boatId === b.boatId);
                                    return (
                                        <div key={b.boatId} className="ts-boat-btn ts-boat-btn--pending">
                                            <div className="ts-boat-btn__tap" style={{ cursor: 'default' }}>
                                                <span className="ts-boat-btn__name">
                                                    {boatDisplayLabel(b.rowerNames, b.boatClass)}
                                                </span>
                                            </div>
                                            <button
                                                className="ts-boat-btn__start-btn"
                                                onClick={() => handleStartBoatTT(boatIdx)}
                                            >
                                                START
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* ── TIME TRIAL: RESULTS (all boats done) ─────────────────── */}
                {isTimeTrial && phase === 'results' && (
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

                {/* ── RACE: READY ───────────────────────────────────────────── */}
                {!isTimeTrial && phase === 'ready' && (
                    <div className="ts-run-ready">
                        <div className="ts-run-ready__athletes">
                            <p className="ts-run-ready__label">Boats</p>
                            {piece.boats.map(b => (
                                <div key={b.boatId} className="ts-run-ready__boat">
                                    {boatDisplayLabel(b.rowerNames, b.boatClass)}
                                </div>
                            ))}
                        </div>
                        <button className="ts-btn-start" onClick={handleStartPiece}>
                            START PIECE
                        </button>
                    </div>
                )}

                {/* ── RACE: RUNNING ─────────────────────────────────────────── */}
                {!isTimeTrial && phase === 'running' && (
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

                {/* ── RACE: RESULTS ─────────────────────────────────────────── */}
                {!isTimeTrial && phase === 'results' && (
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
