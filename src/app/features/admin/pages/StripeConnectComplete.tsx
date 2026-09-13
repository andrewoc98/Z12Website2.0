import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { refreshConnectStatus, type ConnectStatus } from "../services/stripeService";
import StripeConnectDiagnostics from "../components/StripeConnectDiagnostics";
import Navbar from "../../../shared/components/Navbar/Navbar";

const DRAFT_KEY = "z12_event_create_draft";

// "incomplete" = the host left Stripe's flow early; "review" = Stripe has the
// details but hasn't enabled payouts yet. Both used to surface as "timeout",
// which told the host nothing and hid a broken webhook entirely.
type Phase = "waiting" | "confirmed" | "incomplete" | "review" | "error";

const POLL_MS    = 3_000;
const TIMEOUT_MS = 30_000;

type CallErr = { code?: string; message: string };

export default function StripeConnectComplete() {
    const { user } = useAuth() as any;
    const navigate = useNavigate();
    const [phase,   setPhase]   = useState<Phase>("waiting");
    const [status,  setStatus]  = useState<ConnectStatus | null>(null);
    const [error,   setError]   = useState<CallErr | null>(null);
    const [checking, setChecking] = useState(false);
    const settled = useRef(false);
    const hasDraft = !!sessionStorage.getItem(DRAFT_KEY);

    // Single source of truth for a status read: always records what Stripe said
    // (or why the call failed) so the diagnostics panel stays accurate, and only
    // resolves the phase when it can do so definitively.
    const check = useCallback(async (final: boolean): Promise<boolean> => {
        setChecking(true);
        try {
            const s = await refreshConnectStatus({});
            setStatus(s);
            setError(null);

            if (s.onboarded) {
                settled.current = true;
                setPhase("confirmed");
                return true;
            }
            if (!s.connected) {
                settled.current = true;
                setError({ message: "No Stripe account is linked to your club admin profile." });
                setPhase("error");
                return true;
            }
            if (final) {
                settled.current = true;
                setPhase(s.detailsSubmitted ? "review" : "incomplete");
                return true;
            }
            return false;
        } catch (e: any) {
            setError({ code: e?.code, message: e?.message ?? "Could not verify your Stripe account." });
            if (final) {
                settled.current = true;
                setPhase("error");
                return true;
            }
            return false;
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        if (!user?.uid) return;
        settled.current = false;

        // Fast path: the account.updated webhook may beat our polling.
        const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (snap.data()?.roles?.clubAdmin?.stripeOnboarded && !settled.current) {
                settled.current = true;
                setPhase("confirmed");
            }
        });

        // Authoritative path: ask Stripe directly, so a missing or misconfigured
        // webhook can't strand the host on this screen with no explanation.
        let poll: ReturnType<typeof setTimeout>;
        const loop = async () => {
            if (settled.current) return;
            const done = await check(false);
            if (!done && !settled.current) poll = setTimeout(loop, POLL_MS);
        };
        void loop();

        const timer = setTimeout(() => { if (!settled.current) void check(true); }, TIMEOUT_MS);

        return () => {
            settled.current = true;
            clearTimeout(timer);
            clearTimeout(poll);
            unsub();
        };
    }, [user?.uid, check]);

    const diagnostics = (
        <StripeConnectDiagnostics status={status} error={error} checking={checking} />
    );

    const recheckButton = (
        <button
            className="btn-ghost"
            style={{ width: "100%", marginBottom: 10 }}
            disabled={checking}
            onClick={() => { settled.current = false; void check(true); }}
        >
            {checking ? "Checking…" : "Check again"}
        </button>
    );

    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>

                    {phase === "waiting" && (
                        <>
                            <div className="sco-spinner sco-spinner--lg" style={{ margin: "0 auto 20px" }} />
                            <h2 style={{ color: "#FEB959", marginBottom: 8 }}>Verifying connection…</h2>
                            <p className="muted" style={{ marginBottom: 0 }}>
                                Checking your account with Stripe. This usually takes a few seconds.
                            </p>
                            {diagnostics}
                        </>
                    )}

                    {phase === "confirmed" && (
                        <>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                            <h2 style={{ color: "#FEB959", marginBottom: 8 }}>Stripe connected!</h2>
                            <p className="muted" style={{ marginBottom: 24 }}>
                                Your payout account is set up. Entry fees will be transferred to your Stripe
                                balance automatically when athletes register for your events.
                            </p>
                            {hasDraft ? (
                                <button
                                    className="btn-primary"
                                    style={{ width: "100%", marginBottom: 10 }}
                                    onClick={() => navigate("/host/events/new")}
                                >
                                    Continue creating your event →
                                </button>
                            ) : (
                                <Link to="/admin/club">
                                    <button className="btn-primary">Back to Club Dashboard</button>
                                </Link>
                            )}
                            {diagnostics}
                        </>
                    )}

                    {phase === "incomplete" && (
                        <>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                            <h2 style={{ marginBottom: 8 }}>Onboarding not finished</h2>
                            <p className="muted" style={{ marginBottom: 24 }}>
                                Stripe hasn’t received all of your details yet, so payouts can’t be enabled.
                                Pick up where you left off — your progress is saved.
                            </p>
                            <Link to="/admin/stripe/refresh">
                                <button className="btn-primary" style={{ width: "100%", marginBottom: 10 }}>
                                    Resume Stripe setup
                                </button>
                            </Link>
                            {recheckButton}
                            <Link to="/admin/club">
                                <button className="btn-ghost">Back to Dashboard</button>
                            </Link>
                            {diagnostics}
                        </>
                    )}

                    {phase === "review" && (
                        <>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                            <h2 style={{ marginBottom: 8 }}>Stripe is reviewing your account</h2>
                            <p className="muted" style={{ marginBottom: status?.currentlyDue.length ? 12 : 24 }}>
                                Your details are submitted but payouts aren’t enabled yet. This usually clears
                                on its own — your dashboard will update automatically.
                            </p>
                            {!!status?.currentlyDue.length && (
                                <p className="muted" style={{ marginBottom: 24, fontSize: 13 }}>
                                    Stripe still needs: {status.currentlyDue.join(", ")}
                                </p>
                            )}
                            <Link to="/admin/stripe/refresh">
                                <button className="btn-primary" style={{ width: "100%", marginBottom: 10 }}>
                                    Review details on Stripe
                                </button>
                            </Link>
                            {recheckButton}
                            <Link to="/admin/club">
                                <button className="btn-ghost">Go to Club Dashboard</button>
                            </Link>
                            {diagnostics}
                        </>
                    )}

                    {phase === "error" && (
                        <>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                            <h2 style={{ color: "#ff6b6b", marginBottom: 8 }}>Couldn’t verify your account</h2>
                            <p className="muted" style={{ marginBottom: 24 }}>{error?.message}</p>
                            {recheckButton}
                            <Link to="/admin/club">
                                <button className="btn-ghost">Back to Dashboard</button>
                            </Link>
                            {diagnostics}
                        </>
                    )}

                </div>
            </main>
        </>
    );
}
