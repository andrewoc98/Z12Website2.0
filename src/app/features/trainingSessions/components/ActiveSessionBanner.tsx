import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../providers/AuthProvider';
import { useActiveCoachSession } from '../hooks/useActiveCoachSession';
import { completePiece, finishSession } from '../services/sessionService';
import '../trainingSessions.css';

export default function ActiveSessionBanner() {
    const { profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isCoach = !!(profile as any)?.roles?.coach;
    const coachId = isCoach ? (profile?.uid ?? null) : null;
    const activeSession = useActiveCoachSession(coachId);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [ending, setEnding] = useState(false);

    // Hide on run pages — the run page has its own navigation guard
    const isOnRunPage = location.pathname.includes('/run');
    if (!activeSession || isOnRunPage) return null;

    async function handleEndSession() {
        if (!activeSession) return;
        setEnding(true);
        try {
            const activePieceIdx = activeSession.pieces.findIndex(p => p.status === 'active');
            if (activePieceIdx >= 0) {
                await completePiece(activeSession.id, activeSession, activePieceIdx);
            }
            await finishSession(activeSession.id);
            navigate(`/coach/sessions/${activeSession.id}/results`);
        } finally {
            setEnding(false);
            setConfirmEnd(false);
        }
    }

    if (confirmEnd) {
        return (
            <div className="ts-active-banner ts-active-banner--confirm">
                <span className="ts-active-banner__text">
                    End <strong>{activeSession.name}</strong>? This cannot be undone.
                </span>
                <div className="ts-active-banner__actions">
                    <button
                        className="ts-active-banner__btn ts-active-banner__btn--end"
                        onClick={handleEndSession}
                        disabled={ending}
                    >
                        {ending ? 'Ending…' : 'End Session'}
                    </button>
                    <button
                        className="ts-active-banner__btn ts-active-banner__btn--cancel"
                        onClick={() => setConfirmEnd(false)}
                        disabled={ending}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ts-active-banner">
            <span className="ts-active-banner__dot" />
            <span className="ts-active-banner__text">
                Active session: <strong>{activeSession.name}</strong>
            </span>
            <div className="ts-active-banner__actions">
                <button
                    className="ts-active-banner__btn ts-active-banner__btn--goto"
                    onClick={() => navigate(`/coach/sessions/${activeSession.id}/run`)}
                >
                    Go to Session
                </button>
                <button
                    className="ts-active-banner__btn ts-active-banner__btn--end"
                    onClick={() => setConfirmEnd(true)}
                >
                    End Session
                </button>
            </div>
        </div>
    );
}
