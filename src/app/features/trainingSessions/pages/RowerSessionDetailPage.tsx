import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { useRowerSessionDetail } from '../hooks/useRowerSessions';
import { formatTime } from '../types/session';
import '../trainingSessions.css';

export default function RowerSessionDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { profile }   = useAuth();
    const navigate      = useNavigate();
    const { results, loading } = useRowerSessionDetail(profile?.uid ?? null, sessionId);

    const sessionName = results[0]?.sessionName ?? 'Session';

    return (
        <>
            <Navbar />
            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <div>
                        <h1 className="ts-page__title">{sessionName}</h1>
                    </div>
                    <button className="btn-ghost" onClick={() => navigate('/rower/my-sessions')}>
                        ← My Sessions
                    </button>
                </div>

                {loading ? (
                    <div className="ts-loading">Loading…</div>
                ) : results.length === 0 ? (
                    <p className="ts-muted">No results found for this session.</p>
                ) : (
                    <div className="ts-list">
                        {results.map(r => (
                            <div key={r.id} className="ts-rower-result-card">
                                <div className="ts-rower-result-card__piece">
                                    Piece {r.pieceNumber} — {r.distanceMeters}m
                                </div>
                                <div className="ts-rower-result-card__boat">
                                    {r.displayName}
                                </div>
                                {r.status === 'finished' && r.elapsedMs != null ? (
                                    <div className="ts-rower-result-card__times">
                                        <span className="ts-rower-result-card__time">
                                            {formatTime(r.elapsedMs)}
                                        </span>
                                        {r.split500mMs != null && (
                                            <span className="ts-rower-result-card__split">
                                                {formatTime(r.split500mMs)}/500m
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="ts-rower-result-card__times">
                                        <span className="ts-rower-result-card__time ts-rower-result-card__time--dnf">
                                            DNF
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
