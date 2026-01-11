import {useEffect, useRef, useState} from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import { joinBoatWithInviteCode } from "../api/boats";


export default function InviteJoinPage() {
    const { eventId, code } = useParams<{ eventId: string; code: string }>();
    const { user, profile } = useAuth() as any;

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const location = useLocation();
    const returnTo = encodeURIComponent(location.pathname + location.search);
    const hasJoinedRef = useRef(false);

    useEffect(() => {
        if (!user || !profile) return;
        if (!eventId || !code) return;
        if (hasJoinedRef.current) return;

        hasJoinedRef.current = true;
        onJoin();
    }, [user, profile, eventId, code]);

    async function onJoin() {
        if (!user || !profile) return;
        if (!eventId || !code) return;

        setBusy(true);
        setErr(null);
        try {
            await joinBoatWithInviteCode({ eventId, code, uid: user.uid });
            setOk(true);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to join boat");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card">
                    <h1 className="auth-title">Join crew</h1>

                    {!eventId || !code ? (
                        <p className="muted">Missing invite link details.</p>
                    ) : !user ? (
                        <>
                            <p className="muted">Please sign in to accept this invite.</p>
                            <div className="auth-actions">
                                <Link to={`/auth?returnTo=${returnTo}`}>
                                    <button type="button" className="btn-primary">Sign in</button>
                                </Link>
                            </div>
                        </>
                    ) : ok ? (
                        <>
                            <p className="muted">You’ve joined the crew.</p>
                            <div className="auth-actions">
                                <Link to={`/rower/events/${eventId}/signup`}>
                                    <button type="button" className="btn-primary">
                                        Back to event
                                    </button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="muted">Click below to join your crew.</p>

                            {err && (
                                <div className="card auth-error">
                                    <div className="auth-error-title">Error</div>
                                    <div className="auth-error-msg muted">{err}</div>
                                </div>
                            )}

                            <div className="auth-actions">
                                <button type="button" className="btn-primary" disabled={busy} onClick={onJoin}>
                                    {busy ? "Joining..." : "Join crew"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
