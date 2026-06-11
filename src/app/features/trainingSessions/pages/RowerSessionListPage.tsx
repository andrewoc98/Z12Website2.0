import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { useRowerSessions } from '../hooks/useRowerSessions';

export default function RowerSessionListPage() {
    const { profile } = useAuth();
    const navigate    = useNavigate();
    const { sessions, loading } = useRowerSessions(profile?.uid ?? null);

    return (
        <>
            <Navbar />
            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <h1 className="ts-page__title">My Sessions</h1>
                </div>

                {loading ? (
                    <div className="ts-loading">Loading sessions…</div>
                ) : sessions.length === 0 ? (
                    <div className="ts-empty">
                        <div className="ts-empty__icon">🚣</div>
                        <p className="ts-empty__text">No training sessions yet.</p>
                    </div>
                ) : (
                    <div className="ts-list" data-tour="rower-sessions-list">
                        {sessions.map(s => {
                            const date = new Date(s.latestStartMs).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                            });
                            return (
                                <button
                                    key={s.sessionId}
                                    className="ts-session-card"
                                    onClick={() => navigate(`/rower/my-sessions/${s.sessionId}`)}
                                >
                                    <div className="ts-session-card__body">
                                        <span className="ts-session-card__name">{s.sessionName}</span>
                                        <span className="ts-session-card__meta">
                                            {date} · {s.pieceCount} piece{s.pieceCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
