import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { useRowerSessions } from '../hooks/useRowerSessions';
import { hideRowerSession } from '../services/sessionService';
import '../trainingSessions.css';

export default function RowerSessionListPage() {
    const { profile } = useAuth();
    const navigate    = useNavigate();
    const { sessions, loading } = useRowerSessions(profile?.uid ?? null);
    const [hidingId, setHidingId] = useState<string | null>(null);
    const [hiding, setHiding]     = useState(false);

    const hidden = new Set(profile?.hiddenSessionIds ?? []);
    const visible = sessions.filter(s => !hidden.has(s.sessionId));

    async function handleConfirmHide() {
        if (!hidingId || !profile?.uid) return;
        setHiding(true);
        try {
            await hideRowerSession(profile.uid, hidingId);
            setHidingId(null);
        } finally {
            setHiding(false);
        }
    }

    return (
        <>
            <Navbar />

            {hidingId && (
                <div className="ts-modal-overlay">
                    <div className="ts-modal">
                        <h2 className="ts-modal__title">Remove Session?</h2>
                        <p className="ts-modal__body">
                            This will remove the session from your history. Your results are still visible to your coach.
                        </p>
                        <div className="ts-modal__actions">
                            <button
                                className="ts-modal__btn ts-modal__btn--danger"
                                onClick={handleConfirmHide}
                                disabled={hiding}
                            >
                                {hiding ? 'Removing…' : 'Remove'}
                            </button>
                            <button
                                className="ts-modal__btn ts-modal__btn--primary"
                                onClick={() => setHidingId(null)}
                                disabled={hiding}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <h1 className="ts-page__title">My Sessions</h1>
                </div>

                {loading ? (
                    <div className="ts-loading">Loading sessions…</div>
                ) : visible.length === 0 ? (
                    <div className="ts-empty">
                        <div className="ts-empty__icon">🚣</div>
                        <p className="ts-empty__text">No training sessions yet.</p>
                    </div>
                ) : (
                    <div className="ts-list" data-tour="rower-sessions-list">
                        {visible.map(s => {
                            const date = new Date(s.latestStartMs).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                            });
                            return (
                                <div
                                    key={s.sessionId}
                                    className="ts-session-card"
                                    onClick={() => navigate(`/rower/my-sessions/${s.sessionId}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/rower/my-sessions/${s.sessionId}`); }}
                                >
                                    <div className="ts-session-card__body">
                                        <span className="ts-session-card__name">{s.sessionName}</span>
                                        <span className="ts-session-card__meta">
                                            {date} · {s.pieceCount} piece{s.pieceCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <button
                                        className="ts-session-card__delete"
                                        onClick={e => { e.stopPropagation(); setHidingId(s.sessionId); }}
                                        aria-label="Remove session"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
