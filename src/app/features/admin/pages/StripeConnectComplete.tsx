import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import Navbar from "../../../shared/components/Navbar/Navbar";

const DRAFT_KEY = "z12_event_create_draft";

type Phase = "waiting" | "confirmed" | "timeout";

const TIMEOUT_MS = 30_000;

export default function StripeConnectComplete() {
    const { user } = useAuth() as any;
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("waiting");
    const hasDraft = !!sessionStorage.getItem(DRAFT_KEY);

    useEffect(() => {
        if (!user?.uid) return;

        const timer = setTimeout(() => setPhase("timeout"), TIMEOUT_MS);

        const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (snap.data()?.roles?.clubAdmin?.stripeOnboarded) {
                clearTimeout(timer);
                setPhase("confirmed");
            }
        });

        return () => {
            clearTimeout(timer);
            unsub();
        };
    }, [user?.uid]);

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
                                Waiting for Stripe to confirm your account. This usually takes a few seconds.
                            </p>
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
                        </>
                    )}

                    {phase === "timeout" && (
                        <>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                            <h2 style={{ marginBottom: 8 }}>Taking longer than expected</h2>
                            <p className="muted" style={{ marginBottom: 24 }}>
                                Stripe is still processing your account. Your connection will activate
                                automatically — check your Club Dashboard in a few minutes.
                            </p>
                            {hasDraft && (
                                <button
                                    className="btn-primary"
                                    style={{ width: "100%", marginBottom: 10 }}
                                    onClick={() => navigate("/host/events/new")}
                                >
                                    Go back to event creation
                                </button>
                            )}
                            <Link to="/admin/club">
                                <button className={hasDraft ? "btn" : "btn-primary"}>Go to Club Dashboard</button>
                            </Link>
                        </>
                    )}

                </div>
            </main>
        </>
    );
}
