import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { useCoachSessions } from '../hooks/useCoachSessions';
import { deleteSession } from '../services/sessionService';
import type { Session } from '../types/session';
import '../trainingSessions.css';

function statusLabel(status: Session['status']) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function SessionCard({ session, onClick, onDelete }: { session: Session; onClick: () => void; onDelete: () => void }) {
    const date = session.date.toDate().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
    const count = session.pieces.length;

    return (
        <div
            className="ts-session-card"
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        >
            <div className="ts-session-card__body">
                <span className="ts-session-card__name">{session.name}</span>
                <span className="ts-session-card__meta">
                    {date} · {count} piece{count !== 1 ? 's' : ''}
                </span>
            </div>
            <span className={`ts-badge ts-badge--${session.status}`}>
                {statusLabel(session.status)}
            </span>
            <button
                className="ts-session-card__delete"
                onClick={e => { e.stopPropagation(); onDelete(); }}
                aria-label="Delete session"
            >
                ✕
            </button>
        </div>
    );
}

export default function SessionListPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { sessions, loading } = useCoachSessions(profile?.uid ?? null);
    const [tab, setTab] = useState<'upcoming' | 'finished'>('upcoming');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const upcoming = sessions.filter(s => s.status !== 'completed');
    const finished  = sessions.filter(s => s.status === 'completed');
    const displayed = tab === 'upcoming' ? upcoming : finished;

    function handleClick(s: Session) {
        if (s.status === 'completed') {
            navigate(`/coach/sessions/${s.id}/results`);
        } else {
            navigate(`/coach/sessions/${s.id}/run`);
        }
    }

    async function handleConfirmDelete() {
        if (!deletingId) return;
        setDeleting(true);
        try {
            await deleteSession(deletingId);
            setDeletingId(null);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <Navbar />

            {deletingId && (
                <div className="ts-modal-overlay">
                    <div className="ts-modal">
                        <h2 className="ts-modal__title">Delete Session?</h2>
                        <p className="ts-modal__body">
                            This will permanently delete the session and all its results. This cannot be undone.
                        </p>
                        <div className="ts-modal__actions">
                            <button
                                className="ts-modal__btn ts-modal__btn--danger"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                                className="ts-modal__btn ts-modal__btn--primary"
                                onClick={() => setDeletingId(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <h1 className="ts-page__title">Training Sessions</h1>
                    <button className="btn-primary ts-btn-new" onClick={() => navigate('/coach/sessions/new')}>
                        + New Session
                    </button>
                </div>

                <div className="ts-tabs">
                    <button
                        className={`ts-tab${tab === 'upcoming' ? ' ts-tab--active' : ''}`}
                        onClick={() => setTab('upcoming')}
                    >
                        Upcoming
                        {upcoming.length > 0 && (
                            <span className="ts-tab__count">{upcoming.length}</span>
                        )}
                    </button>
                    <button
                        className={`ts-tab${tab === 'finished' ? ' ts-tab--active' : ''}`}
                        onClick={() => setTab('finished')}
                    >
                        Finished
                        {finished.length > 0 && (
                            <span className="ts-tab__count">{finished.length}</span>
                        )}
                    </button>
                </div>

                {loading ? (
                    <div className="ts-loading">Loading sessions…</div>
                ) : displayed.length === 0 ? (
                    <div className="ts-empty">
                        <div className="ts-empty__icon">🚣</div>
                        <p className="ts-empty__text">
                            {tab === 'upcoming'
                                ? 'No upcoming sessions. Create one to get started.'
                                : 'No finished sessions yet.'}
                        </p>
                        {tab === 'upcoming' && (
                            <button className="btn-primary" onClick={() => navigate('/coach/sessions/new')}>
                                Create Session
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ts-list" data-tour="coach-sessions-list">
                        {displayed.map(s => (
                            <SessionCard
                                key={s.id}
                                session={s}
                                onClick={() => handleClick(s)}
                                onDelete={() => setDeletingId(s.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
