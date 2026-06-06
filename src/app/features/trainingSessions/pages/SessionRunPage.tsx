import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import {
    activateSession, startPiece, stopBoat, markBoatDNF, completePiece, finishSession,
    startBoatTimeTrial, undoBoatResult, deletePieceResult, undoPieceStart,
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

interface PendingStop {
    r: LiveResult;
    elapsedMs: number;
    split500mMs: number;
    startMs: number;
    mode: 'race' | 'tt';
}

const ONE_MIN_MS = 60_000;

export default function SessionRunPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [session, setSession]             = useState<Session | null>(null);
    const [loading, setLoading]             = useState(true);
    const [showPreStart, setShowPreStart]   = useState(false);
    const [activating, setActivating]       = useState(false);
    const [pieceIdx, setPieceIdx]           = useState(0);
    const [phase, setPhase]                 = useState<Phase>('ready');
    const [liveResults, setLiveResults]     = useState<LiveResult[]>([]);
    const [displayMs, setDisplayMs]         = useState(0);
    const [startError, setStartError]       = useState(false);
    const [startSyncing, setStartSyncing]   = useState(false);
    const [exitModalOpen, setExitModalOpen] = useState(false);
    const [pendingStop, setPendingStop]     = useState<PendingStop | null>(null);

    const [perBoatElapsed, setPerBoatElapsed] = useState<Record<string, number>>({});
    const ttBoatStartTimes         = useRef<Record<string, number>>({});
    const ttBoatOriginalStartTimes = useRef<Record<string, number>>({});

    const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef      = useRef<number | null>(null);
    const boatResultIds     = useRef<Record<string, string>>({});
    const intentionalNavRef = useRef(false);

    // ── Navigation guard ──────────────────────────────────────────────────────
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            phase === 'running' &&
            !intentionalNavRef.current &&
            currentLocation.pathname !== nextLocation.pathname,
    );

    useEffect(() => {
        if (blocker.state === 'blocked') setExitModalOpen(true);
    }, [blocker.state]);

    useEffect(() => {
        if (phase !== 'running') return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [phase]);

    function stopTimer() {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    function startTimer(fromMs: number) {
        startTimeRef.current = fromMs;
        setDisplayMs(Date.now() - fromMs);
        if (intervalRef.current) clearInterval(intervalRef.current);
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
            if (!snap.exists()) { setLoading(false); return; }
            const s = { id: snap.id, ...snap.data() } as Session;
            setSession(s);

            if (s.status === 'draft') {
                setShowPreStart(true);
                setPieceIdx(0);
                setPhase('ready');
                setLoading(false);
                return;
            }

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
        if (snap.empty) { setPhase('ready'); return; }

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
            const allDone    = results.every(r => r.status !== 'running');

            if (allStarted && allDone) {
                setPhase('results');
            } else {
                for (const rr of runningResults) {
                    const runDoc = snap.docs.find(d => d.id === rr.resultId);
                    const startMs = (runDoc!.data() as PieceResult).startTimestamp.toMillis();
                    ttBoatStartTimes.current[rr.boatId] = startMs;
                    ttBoatOriginalStartTimes.current[rr.boatId] = startMs;
                }
                if (runningResults.length > 0) startTTTimers();
                setPhase(results.length > 0 ? 'running' : 'ready');
            }
            return;
        }

        const allDone = results.every(r => r.status !== 'running');
        if (allDone) {
            setPhase('results');
        } else {
            const startMs = piece.startTimestamp?.toMillis() ?? Date.now();
            setPhase('running');
            startTimer(startMs);
        }
    }

    // ── Pre-start ─────────────────────────────────────────────────────────────

    async function handleActivateSession() {
        if (!sessionId) return;
        setActivating(true);
        try {
            await activateSession(sessionId);
            setSession(prev => prev ? { ...prev, status: 'active' } : prev);
            setShowPreStart(false);
        } finally {
            setActivating(false);
        }
    }

    // ── Race mode handlers ─────────────────────────────────────────────────────

    async function handleStartPiece() {
        if (!session || !sessionId) return;
        const startMs = Date.now();
        const startTs = Timestamp.fromMillis(startMs);

        const optimisticResults: LiveResult[] = session.pieces[pieceIdx].boats.map(b => ({
            resultId: '',
            boatId: b.boatId,
            displayName: boatDisplayLabel(b.rowerNames, b.boatClass),
            status: 'running',
            elapsedMs: null,
            split500mMs: null,
        }));
        setLiveResults(optimisticResults);
        startTimer(startMs);
        setPhase('running');
        setStartSyncing(true);
        setStartError(false);

        try {
            const ids = await startPiece(sessionId, session, pieceIdx, startTs);
            boatResultIds.current = ids;
            setLiveResults(prev => prev.map(r => ({ ...r, resultId: ids[r.boatId] ?? '' })));
            const snap = await getDoc(doc(db, 'sessions', sessionId));
            setSession({ id: snap.id, ...snap.data() } as Session);
        } catch {
            setStartError(true);
        } finally {
            setStartSyncing(false);
        }
    }

    async function handleRetryStart() {
        if (!session || !sessionId || startTimeRef.current == null) return;
        const startTs = Timestamp.fromMillis(startTimeRef.current);
        setStartSyncing(true);
        setStartError(false);
        try {
            const ids = await startPiece(sessionId, session, pieceIdx, startTs);
            boatResultIds.current = ids;
            setLiveResults(prev => prev.map(r => ({ ...r, resultId: ids[r.boatId] ?? '' })));
            const snap = await getDoc(doc(db, 'sessions', sessionId));
            setSession({ id: snap.id, ...snap.data() } as Session);
        } catch {
            setStartError(true);
        } finally {
            setStartSyncing(false);
        }
    }

    /** Captures stop data and either saves immediately or prompts if split < 1 min. */
    function requestStopBoat(r: LiveResult) {
        if (r.status !== 'running' || !r.resultId) return;
        const startMs    = startTimeRef.current!;
        const elapsedMs  = Date.now() - startMs;
        const dist       = session!.pieces[pieceIdx].distanceMeters;
        const split500mMs = Math.round((elapsedMs / dist) * 500);

        if (split500mMs < ONE_MIN_MS) {
            setPendingStop({ r, elapsedMs, split500mMs, startMs, mode: 'race' });
            return;
        }
        commitStopBoat(r, elapsedMs, split500mMs, startMs);
    }

    function commitStopBoat(r: LiveResult, elapsedMs: number, split500mMs: number, startMs: number) {
        stopBoat(r.resultId, startMs, session!.pieces[pieceIdx].distanceMeters);
        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId
                    ? { ...x, status: 'finished' as const, elapsedMs, split500mMs }
                    : x,
            );
            if (updated.every(x => x.status !== 'running')) { stopTimer(); setPhase('results'); }
            return updated;
        });
        setPendingStop(null);
    }

    function handleDNF(r: LiveResult) {
        if (r.status !== 'running' || !r.resultId) return;
        markBoatDNF(r.resultId);
        setLiveResults(prev => {
            const updated = prev.map(x => x.boatId === r.boatId ? { ...x, status: 'dnf' as const } : x);
            if (updated.every(x => x.status !== 'running')) { stopTimer(); setPhase('results'); }
            return updated;
        });
    }

    // ── Time trial mode handlers ───────────────────────────────────────────────

    async function handleStartBoatTT(boatIdx: number) {
        if (!session || !sessionId) return;
        const startMs = Date.now();
        const startTs = Timestamp.fromMillis(startMs);
        const boat    = session.pieces[pieceIdx].boats[boatIdx];

        ttBoatStartTimes.current[boat.boatId] = startMs;
        ttBoatOriginalStartTimes.current[boat.boatId] = startMs;
        setLiveResults(prev => [...prev, {
            resultId: '',
            boatId: boat.boatId,
            displayName: boatDisplayLabel(boat.rowerNames, boat.boatClass),
            status: 'running' as const,
            elapsedMs: null,
            split500mMs: null,
        }]);
        startTTTimers();
        setPhase('running');
        setStartSyncing(true);
        setStartError(false);

        try {
            const { resultId } = await startBoatTimeTrial(sessionId, session, pieceIdx, boatIdx, startTs);
            if (boatIdx === 0) {
                const snap = await getDoc(doc(db, 'sessions', sessionId));
                setSession({ id: snap.id, ...snap.data() } as Session);
            }
            setLiveResults(prev => prev.map(r => r.boatId === boat.boatId ? { ...r, resultId } : r));
        } catch {
            setStartError(true);
        } finally {
            setStartSyncing(false);
        }
    }

    function requestStopBoatTT(r: LiveResult) {
        if (r.status !== 'running' || !r.resultId) return;
        const startMs     = ttBoatStartTimes.current[r.boatId];
        const elapsedMs   = Date.now() - startMs;
        const dist        = session!.pieces[pieceIdx].distanceMeters;
        const split500mMs = Math.round((elapsedMs / dist) * 500);

        if (split500mMs < ONE_MIN_MS) {
            setPendingStop({ r, elapsedMs, split500mMs, startMs, mode: 'tt' });
            return;
        }
        commitStopBoatTT(r, elapsedMs, split500mMs, startMs);
    }

    function commitStopBoatTT(r: LiveResult, elapsedMs: number, split500mMs: number, startMs: number) {
        stopBoat(r.resultId, startMs, session!.pieces[pieceIdx].distanceMeters);
        delete ttBoatStartTimes.current[r.boatId];
        setLiveResults(prev => {
            const updated = prev.map(x =>
                x.boatId === r.boatId
                    ? { ...x, status: 'finished' as const, elapsedMs, split500mMs }
                    : x,
            );
            const boatCount = session!.pieces[pieceIdx].boats.length;
            if (updated.length >= boatCount && updated.every(x => x.status !== 'running')) {
                stopTimer(); setPhase('results');
            }
            return updated;
        });
        setPendingStop(null);
    }

    function handleDNFTT(r: LiveResult) {
        if (r.status !== 'running' || !r.resultId) return;
        markBoatDNF(r.resultId);
        delete ttBoatStartTimes.current[r.boatId];
        setLiveResults(prev => {
            const updated = prev.map(x => x.boatId === r.boatId ? { ...x, status: 'dnf' as const } : x);
            const boatCount = session!.pieces[pieceIdx].boats.length;
            if (updated.length >= boatCount && updated.every(x => x.status !== 'running')) {
                stopTimer(); setPhase('results');
            }
            return updated;
        });
    }

    // ── Undo handlers ─────────────────────────────────────────────────────────

    async function handleUndoStartPiece() {
        if (!session || !sessionId) return;
        const resultIds = Object.values(boatResultIds.current).filter(Boolean);
        await undoPieceStart(sessionId, session, pieceIdx, resultIds);
        const snap = await getDoc(doc(db, 'sessions', sessionId));
        setSession({ id: snap.id, ...snap.data() } as Session);
        stopTimer();
        startTimeRef.current = null;
        setLiveResults([]);
        setDisplayMs(0);
        boatResultIds.current = {};
        setStartError(false);
        setStartSyncing(false);
        setPhase('ready');
    }

    async function handleUndoStartBoatTT(r: LiveResult) {
        if (!session || !sessionId) return;
        const isOnlyBoat = liveResults.length === 1;
        if (isOnlyBoat) {
            if (r.resultId) await undoPieceStart(sessionId, session, pieceIdx, [r.resultId]);
            const snap = await getDoc(doc(db, 'sessions', sessionId));
            setSession({ id: snap.id, ...snap.data() } as Session);
        } else if (r.resultId) {
            await deletePieceResult(r.resultId);
        }
        delete ttBoatStartTimes.current[r.boatId];
        delete ttBoatOriginalStartTimes.current[r.boatId];
        const remaining = liveResults.filter(x => x.boatId !== r.boatId);
        setLiveResults(remaining);
        if (remaining.length === 0) {
            stopTimer();
            setPerBoatElapsed({});
            setStartError(false);
            setPhase('ready');
        }
    }

    function handleUndoBoat(r: LiveResult) {
        undoBoatResult(r.resultId);
        setLiveResults(prev => prev.map(x =>
            x.boatId === r.boatId
                ? { ...x, status: 'running' as const, elapsedMs: null, split500mMs: null }
                : x,
        ));
        if (!intervalRef.current && startTimeRef.current != null) startTimer(startTimeRef.current);
        setPhase('running');
    }

    function handleUndoBoatTT(r: LiveResult) {
        undoBoatResult(r.resultId);
        ttBoatStartTimes.current[r.boatId] = ttBoatOriginalStartTimes.current[r.boatId];
        setLiveResults(prev => prev.map(x =>
            x.boatId === r.boatId
                ? { ...x, status: 'running' as const, elapsedMs: null, split500mMs: null }
                : x,
        ));
        startTTTimers();
        setPhase('running');
    }

    // ── Piece navigation ──────────────────────────────────────────────────────

    async function handleNextPiece() {
        if (!session || !sessionId) return;
        await completePiece(sessionId, session, pieceIdx);
        const snap = await getDoc(doc(db, 'sessions', sessionId));
        const refreshed = { id: snap.id, ...snap.data() } as Session;
        setSession(refreshed);

        const nextIdx = refreshed.pieces.findIndex((p, i) => i > pieceIdx && p.status === 'pending');
        if (nextIdx < 0) {
            await finishSession(sessionId);
            intentionalNavRef.current = true;
            navigate(profile?.uid === session.coachId ? `/coach/sessions/${sessionId}/results` : '/');
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
        intentionalNavRef.current = true;
        navigate(profile?.uid === session.coachId ? `/coach/sessions/${sessionId}/results` : '/');
    }

    // ── Render guards ─────────────────────────────────────────────────────────

    if (loading) {
        return (<><Navbar /><div className="ts-page page shell ts-loading">Loading session…</div></>);
    }
    if (!session) {
        return (<><Navbar /><div className="ts-page page shell ts-loading">Session not found.</div></>);
    }

    const isCoach     = profile?.uid === session.coachId;
    const isAssistant = !isCoach && !!session.timingAssistantEmail && profile?.email === session.timingAssistantEmail;

    if (!isCoach && !isAssistant) {
        return (<><Navbar /><div className="ts-page page shell ts-loading">You don't have access to this session.</div></>);
    }

    const piece        = session.pieces[pieceIdx];
    const isLastPiece  = session.pieces.slice(pieceIdx + 1).every(p => p.status === 'completed');
    const isTimeTrial  = (session.sessionType ?? 'race') === 'time_trial';
    const boatCount    = piece.boats.length;
    const roleLabel    = isCoach ? 'Coach' : 'Assistant';
    const pieceSubtitle = isTimeTrial
        ? `Piece ${piece.pieceNumber} of ${session.pieces.length} — ${piece.distanceMeters}m · Time Trial`
        : `Piece ${piece.pieceNumber} of ${session.pieces.length} — ${piece.distanceMeters}m`;

    return (
        <>
            <Navbar />

            {/* ── Exit confirmation modal ────────────────────────────────── */}
            {exitModalOpen && (
                <div className="ts-modal-overlay">
                    <div className="ts-modal">
                        <h2 className="ts-modal__title">Leave active session?</h2>
                        <p className="ts-modal__body">
                            The timer is still running. Are you sure you want to leave this page?
                        </p>
                        <div className="ts-modal__actions">
                            <button className="ts-modal__btn ts-modal__btn--danger"
                                onClick={() => { setExitModalOpen(false); blocker.proceed?.(); }}>
                                Leave Page
                            </button>
                            <button className="ts-modal__btn ts-modal__btn--primary"
                                onClick={() => { setExitModalOpen(false); blocker.reset?.(); }}>
                                Stay
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Suspicious split confirmation modal ───────────────────── */}
            {pendingStop && (
                <div className="ts-modal-overlay">
                    <div className="ts-modal">
                        <h2 className="ts-modal__title">Very fast split</h2>
                        <p className="ts-modal__body">
                            <strong>{pendingStop.r.displayName}</strong> would be recorded with a
                            split of <strong>{formatTime(pendingStop.split500mMs)}/500m</strong>.
                            {' '}That's under 1 minute — are you sure this is correct?
                        </p>
                        <div className="ts-modal__actions">
                            <button className="ts-modal__btn ts-modal__btn--danger"
                                onClick={() => {
                                    if (pendingStop.mode === 'race') {
                                        commitStopBoat(pendingStop.r, pendingStop.elapsedMs, pendingStop.split500mMs, pendingStop.startMs);
                                    } else {
                                        commitStopBoatTT(pendingStop.r, pendingStop.elapsedMs, pendingStop.split500mMs, pendingStop.startMs);
                                    }
                                }}>
                                Yes, Save It
                            </button>
                            <button className="ts-modal__btn ts-modal__btn--primary"
                                onClick={() => setPendingStop(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="ts-run-page">
                <div className="ts-run-header">
                    <span className="ts-run-header__session">
                        {session.name}
                        {roleLabel && <span className="ts-run-header__role"> · {roleLabel}</span>}
                    </span>
                    {!showPreStart && <span className="ts-run-header__piece">{pieceSubtitle}</span>}
                    {isTimeTrial && phase === 'running' && (
                        <span className="ts-run-header__boat">
                            {liveResults.filter(r => r.status === 'running').length} running
                            · {boatCount - liveResults.length} to start
                        </span>
                    )}
                </div>

                {/* ── Upload error / retry banner ────────────────────────── */}
                {startError && (
                    <div className="ts-retry-banner">
                        <span className="ts-retry-banner__text">Upload failed — timer is still running.</span>
                        <button className="ts-retry-banner__btn" onClick={handleRetryStart} disabled={startSyncing}>
                            {startSyncing ? 'Retrying…' : 'Retry'}
                        </button>
                    </div>
                )}

                {/* ── PRE-START SCREEN ──────────────────────────────────── */}
                {showPreStart && (
                    <div className="ts-run-ready ts-prestart">
                        <div className="ts-prestart__summary">
                            <div className="ts-prestart__date">
                                {session.date.toDate().toLocaleDateString('en-GB', {
                                    weekday: 'long', day: 'numeric', month: 'long',
                                })}
                            </div>
                            <div className="ts-prestart__meta">
                                {session.pieces.length} piece{session.pieces.length !== 1 ? 's' : ''}
                                {' · '}
                                {isTimeTrial ? 'Time Trial' : 'Race'}
                            </div>
                            <div className="ts-prestart__pieces">
                                {session.pieces.map(p => (
                                    <div key={p.pieceNumber} className="ts-prestart__piece-row">
                                        <span className="ts-prestart__piece-num">P{p.pieceNumber}</span>
                                        <span className="ts-prestart__piece-dist">{p.distanceMeters}m</span>
                                        <span className="ts-prestart__piece-boats">
                                            {p.boats.length} boat{p.boats.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className="ts-btn-start" onClick={handleActivateSession} disabled={activating}>
                            {activating ? 'STARTING…' : 'START SESSION'}
                        </button>
                    </div>
                )}

                {/* ── TIME TRIAL: READY ─────────────────────────────────── */}
                {!showPreStart && isTimeTrial && phase === 'ready' && (
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

                {/* ── TIME TRIAL: RUNNING ───────────────────────────────── */}
                {!showPreStart && isTimeTrial && phase === 'running' && (
                    <div className="ts-run-live">
                        <div className="ts-run-boats">
                            {liveResults.filter(r => r.status === 'running').map(r => (
                                <div key={r.boatId} className="ts-boat-btn ts-boat-btn--running">
                                    <button className="ts-boat-btn__tap"
                                        onClick={() => requestStopBoatTT(r)} disabled={!r.resultId}>
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        <span className="ts-boat-btn__result">
                                            {formatTime(perBoatElapsed[r.boatId] ?? 0)}
                                        </span>
                                        <span className="ts-boat-btn__status">
                                            {r.resultId ? 'TAP TO STOP' : 'SYNCING…'}
                                        </span>
                                    </button>
                                    <button className="ts-boat-btn__dnf-btn"
                                        onClick={() => handleDNFTT(r)} disabled={!r.resultId}>
                                        DNF
                                    </button>
                                    <button className="ts-boat-btn__undo-btn"
                                        onClick={() => handleUndoStartBoatTT(r)}>
                                        UNDO
                                    </button>
                                </div>
                            ))}
                            {liveResults.filter(r => r.status !== 'running').map(r => (
                                <div key={r.boatId} className={`ts-boat-btn ts-boat-btn--${r.status}`}>
                                    <div className="ts-boat-btn__tap" style={{ cursor: 'default' }}>
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        {r.status === 'finished' && r.elapsedMs != null && (
                                            <span className="ts-boat-btn__result">{formatTime(r.elapsedMs)}</span>
                                        )}
                                        {r.status === 'dnf' && <span className="ts-boat-btn__dnf">DNF</span>}
                                    </div>
                                    <button className="ts-boat-btn__undo-btn" onClick={() => handleUndoBoatTT(r)}>
                                        UNDO
                                    </button>
                                </div>
                            ))}
                            {piece.boats.filter(b => !liveResults.find(r => r.boatId === b.boatId)).map(b => {
                                const boatIdx = piece.boats.findIndex(x => x.boatId === b.boatId);
                                return (
                                    <div key={b.boatId} className="ts-boat-btn ts-boat-btn--pending">
                                        <div className="ts-boat-btn__tap" style={{ cursor: 'default' }}>
                                            <span className="ts-boat-btn__name">
                                                {boatDisplayLabel(b.rowerNames, b.boatClass)}
                                            </span>
                                        </div>
                                        <button className="ts-boat-btn__start-btn"
                                            onClick={() => handleStartBoatTT(boatIdx)}>
                                            START
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── TIME TRIAL: RESULTS ───────────────────────────────── */}
                {!showPreStart && isTimeTrial && phase === 'results' && (
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
                                        <span className="ts-result-row__pos">{r.status !== 'dnf' ? pos + 1 : '—'}</span>
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
                                        <button className="ts-btn-undo-sm" onClick={() => handleUndoBoatTT(r)}>UNDO</button>
                                    </div>
                                ))}
                        </div>
                        <div className="ts-run-results__actions">
                            {isLastPiece
                                ? <button className="ts-btn-finish" onClick={handleFinishSession}>FINISH SESSION</button>
                                : <button className="ts-btn-next" onClick={handleNextPiece}>NEXT PIECE</button>}
                        </div>
                    </div>
                )}

                {/* ── RACE: READY ───────────────────────────────────────── */}
                {!showPreStart && !isTimeTrial && phase === 'ready' && (
                    <div className="ts-run-ready">
                        <div className="ts-run-ready__athletes">
                            <p className="ts-run-ready__label">Boats</p>
                            {piece.boats.map(b => (
                                <div key={b.boatId} className="ts-run-ready__boat">
                                    {boatDisplayLabel(b.rowerNames, b.boatClass)}
                                </div>
                            ))}
                        </div>
                        <button className="ts-btn-start" onClick={handleStartPiece}>START PIECE</button>
                    </div>
                )}

                {/* ── RACE: RUNNING ─────────────────────────────────────── */}
                {!showPreStart && !isTimeTrial && phase === 'running' && (
                    <div className="ts-run-live">
                        <div className="ts-run-timer">{formatTime(displayMs)}</div>
                        <div className="ts-run-boats">
                            {liveResults.map(r => (
                                <div key={r.boatId} className={`ts-boat-btn ts-boat-btn--${r.status}`}>
                                    <button className="ts-boat-btn__tap"
                                        onClick={() => requestStopBoat(r)}
                                        disabled={r.status !== 'running' || !r.resultId}>
                                        <span className="ts-boat-btn__name">{r.displayName}</span>
                                        {r.status === 'running' && (
                                            <span className="ts-boat-btn__status">
                                                {r.resultId ? 'TAP TO STOP' : 'SYNCING…'}
                                            </span>
                                        )}
                                        {r.status === 'finished' && r.elapsedMs != null && (
                                            <span className="ts-boat-btn__result">
                                                {formatTime(r.elapsedMs)}
                                                {r.split500mMs != null && <> · {formatTime(r.split500mMs)}/500m</>}
                                            </span>
                                        )}
                                        {r.status === 'dnf' && <span className="ts-boat-btn__dnf">DNF</span>}
                                    </button>
                                    {r.status === 'running' && (
                                        <button className="ts-boat-btn__dnf-btn"
                                            onClick={() => handleDNF(r)} disabled={!r.resultId}>
                                            DNF
                                        </button>
                                    )}
                                    {(r.status === 'finished' || r.status === 'dnf') && (
                                        <button className="ts-boat-btn__undo-btn" onClick={() => handleUndoBoat(r)}>
                                            UNDO
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button className="ts-btn-undo-piece" onClick={handleUndoStartPiece} disabled={startSyncing}>
                            UNDO START
                        </button>
                    </div>
                )}

                {/* ── RACE: RESULTS ─────────────────────────────────────── */}
                {!showPreStart && !isTimeTrial && phase === 'results' && (
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
                                        <span className="ts-result-row__pos">{r.status !== 'dnf' ? pos + 1 : '—'}</span>
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
                                        <button className="ts-btn-undo-sm" onClick={() => handleUndoBoat(r)}>UNDO</button>
                                    </div>
                                ))}
                        </div>
                        <div className="ts-run-results__actions">
                            {isLastPiece
                                ? <button className="ts-btn-finish" onClick={handleFinishSession}>FINISH SESSION</button>
                                : <button className="ts-btn-next" onClick={handleNextPiece}>NEXT PIECE</button>}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
