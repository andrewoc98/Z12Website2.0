import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

type Phase = "loading" | "succeeded" | "processing" | "failed";

const PROCESSING_TIMEOUT_MS = 3 * 60 * 1_000; // 3 min — standard UX window before "we'll email you"

type FulfillResult = {
    success:          boolean;
    alreadyFulfilled: boolean;
    boatId:           string | null;
    needsCrew:        boolean;
    inviteCode:       string | null;
};

type CoachFulfillResult = {
    success:          boolean;
    alreadyFulfilled: boolean;
    boatCount:        number;
};

function CopyInviteRow({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <div style={{
            background: "rgba(254,185,89,0.07)",
            border: "1px solid rgba(254,185,89,0.25)",
            borderRadius: 10,
            padding: "12px 14px",
            marginTop: 16,
            textAlign: "left",
        }}>
            <div style={{ fontSize: 12, color: "rgba(254,185,89,0.7)", marginBottom: 6, fontWeight: 600 }}>
                Share this invite link with your crew:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", flex: 1, wordBreak: "break-all" }}>
                    {url}
                </span>
                <button
                    onClick={copy}
                    style={{
                        background: copied ? "rgba(72,199,142,0.15)" : "rgba(254,185,89,0.1)",
                        border: "1px solid " + (copied ? "rgba(72,199,142,0.4)" : "rgba(254,185,89,0.35)"),
                        color: copied ? "#48c78e" : "#FEB959",
                        borderRadius: 6, padding: "5px 12px", fontSize: 12,
                        cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                    }}
                >
                    {copied ? "Copied!" : "Copy link"}
                </button>
            </div>
        </div>
    );
}

export default function BookingConfirmPage() {
    const { user } = useAuth() as any;
    const [params] = useSearchParams();
    const [phase,              setPhase]              = useState<Phase>("loading");
    const [message,            setMessage]            = useState<string | null>(null);
    const [fulfill,            setFulfill]            = useState<FulfillResult | null>(null);
    const [coachFulfill,       setCoachFulfill]       = useState<CoachFulfillResult | null>(null);
    const [processingTimedOut, setProcessingTimedOut] = useState(false);
    const didFulfill = useRef(false);

    const eventId    = params.get("eventId")    ?? "";
    const categoryId = params.get("categoryId") ?? "";
    const piId       = params.get("payment_intent") ?? "";
    const flow       = params.get("flow") ?? "";

    useEffect(() => {
        if (didFulfill.current) return;
        didFulfill.current = true;

        const piClientSecret = params.get("payment_intent_client_secret");
        const redirectStatus = params.get("redirect_status");

        if (!piClientSecret) {
            setPhase("failed");
            setMessage("No payment reference found.");
            return;
        }

        async function run() {
            // Determine payment outcome
            let succeeded = false;
            if (redirectStatus === "succeeded") {
                succeeded = true;
            } else if (redirectStatus === "failed") {
                setPhase("failed");
                setMessage("Your payment did not go through. Please try again.");
                return;
            } else {
                // Retrieve from Stripe to check
                const stripe = await stripePromise;
                if (!stripe) { setPhase("failed"); return; }
                const { paymentIntent } = await stripe.retrievePaymentIntent(piClientSecret!);
                if (paymentIntent?.status === "succeeded") {
                    succeeded = true;
                } else if (paymentIntent?.status === "processing") {
                    setPhase("processing");
                    return;
                } else {
                    setPhase("failed");
                    setMessage(paymentIntent?.last_payment_error?.message ?? "Payment failed.");
                    return;
                }
            }

            if (!succeeded || !piId) {
                setPhase("failed");
                return;
            }

            // Call the appropriate fulfill function based on the flow
            try {
                const functions = getFunctions(app);
                if (flow === "coach") {
                    const fulfillFn = httpsCallable<{ paymentIntentId: string }, CoachFulfillResult>(
                        functions, "fulfillCoachBooking"
                    );
                    const { data } = await fulfillFn({ paymentIntentId: piId });
                    setCoachFulfill(data);
                } else {
                    const fulfillFn = httpsCallable<{ paymentIntentId: string }, FulfillResult>(
                        functions, "fulfillBooking"
                    );
                    const { data } = await fulfillFn({ paymentIntentId: piId });
                    setFulfill(data);
                }
                setPhase("succeeded");
            } catch (e: any) {
                // Even if fulfillment fails, the payment succeeded — show partial success
                console.error("fulfill error:", e);
                setPhase("succeeded");
                setMessage("Payment confirmed but your entry could not be fully created. Please contact support.");
            }
        }

        void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When Stripe returns "processing", watch the fulfillment guard doc — it
    // appears once the payment_intent.succeeded webhook fires server-side.
    // After 3 min (industry-standard UX window) fall back to "check your email".
    useEffect(() => {
        if (phase !== "processing" || !user?.uid || !eventId || !categoryId || !piId) return;

        const guardRef = doc(db, "events", eventId, "rowerCategorySignups", `${user.uid}__${categoryId}`);
        let resolved = false;
        let unsubscribe: (() => void) | undefined;

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                unsubscribe?.();
                setProcessingTimedOut(true);
            }
        }, PROCESSING_TIMEOUT_MS);

        unsubscribe = onSnapshot(guardRef, async (snap) => {
            if (!snap.exists() || resolved) return;
            resolved = true;
            clearTimeout(timer);
            unsubscribe?.();

            try {
                const fulfillFn = httpsCallable<{ paymentIntentId: string }, FulfillResult>(
                    getFunctions(app), "fulfillBooking"
                );
                const { data } = await fulfillFn({ paymentIntentId: piId });
                setFulfill(data);
            } catch {
                // Webhook already fulfilled; proceed to succeeded
            }
            setPhase("succeeded");
        });

        return () => {
            clearTimeout(timer);
            unsubscribe?.();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, user?.uid]);

    const inviteUrl = fulfill?.inviteCode && eventId
        ? `${window.location.origin}/invite/${eventId}/${fulfill.inviteCode}`
        : null;

    return (
        <>
            <Navbar />
            <main className="sco-confirm-page">
                <div className="sco-confirm-card">
                    {phase === "loading" && (
                        <>
                            <div className="sco-spinner sco-spinner--lg" />
                            <p className="sco-confirm-subtitle">Confirming your entry…</p>
                        </>
                    )}

                    {phase === "succeeded" && flow === "coach" && (
                        <>
                            <div className="sco-confirm-icon sco-confirm-icon--success">✓</div>
                            <h1 className="sco-confirm-heading">
                                {coachFulfill
                                    ? `${coachFulfill.boatCount} ${coachFulfill.boatCount === 1 ? "entry" : "entries"} created!`
                                    : "Entries created!"}
                            </h1>
                            <p className="sco-confirm-subtitle">
                                {message ?? "Payment confirmed. Share the invite links with your crews from the event page."}
                            </p>
                            <div className="sco-confirm-actions">
                                {eventId && (
                                    <Link to={`/events/${eventId}?tab=entries`} className="sco-confirm-btn sco-confirm-btn--primary">
                                        View entries & invite links
                                    </Link>
                                )}
                                <Link to="/events" className="sco-confirm-btn sco-confirm-btn--ghost">
                                    Back to events
                                </Link>
                            </div>
                        </>
                    )}

                    {phase === "succeeded" && flow !== "coach" && (
                        <>
                            <div className="sco-confirm-icon sco-confirm-icon--success">✓</div>
                            <h1 className="sco-confirm-heading">
                                {fulfill?.needsCrew ? "Crew created!" : "You're entered!"}
                            </h1>
                            <p className="sco-confirm-subtitle">
                                {message ?? (
                                    fulfill?.needsCrew
                                        ? "Your payment is confirmed. Share the invite link below with your crew members."
                                        : "Your registration is confirmed. A receipt has been sent to your email."
                                )}
                            </p>
                            {inviteUrl && <CopyInviteRow url={inviteUrl} />}
                            <div className="sco-confirm-actions" style={{ marginTop: inviteUrl ? 20 : undefined }}>
                                {eventId && (
                                    <Link to={`/events/${eventId}?tab=entries`} className="sco-confirm-btn sco-confirm-btn--primary">
                                        View entries
                                    </Link>
                                )}
                                <Link to="/my-bookings" className="sco-confirm-btn sco-confirm-btn--ghost">
                                    My bookings
                                </Link>
                            </div>
                        </>
                    )}

                    {phase === "processing" && (
                        <>
                            {processingTimedOut
                                ? <div className="sco-confirm-icon sco-confirm-icon--pending">⏳</div>
                                : <div className="sco-spinner sco-spinner--lg" />
                            }
                            <h1 className="sco-confirm-heading">Payment processing</h1>
                            <p className="sco-confirm-subtitle">
                                {processingTimedOut
                                    ? "Your payment is still being processed — this can take a few hours for some card types. We'll send a confirmation email the moment it clears. You don't need to pay again."
                                    : "Your payment is being processed. Your entry will be confirmed shortly…"
                                }
                            </p>
                            <div className="sco-confirm-actions">
                                {processingTimedOut && eventId && (
                                    <Link to="/my-bookings" className="sco-confirm-btn sco-confirm-btn--primary">
                                        My bookings
                                    </Link>
                                )}
                                <Link to="/events" className="sco-confirm-btn sco-confirm-btn--ghost">
                                    Back to events
                                </Link>
                            </div>
                        </>
                    )}

                    {phase === "failed" && (
                        <>
                            <div className="sco-confirm-icon sco-confirm-icon--error">✕</div>
                            <h1 className="sco-confirm-heading">Payment failed</h1>
                            <p className="sco-confirm-subtitle">
                                {message ?? "Something went wrong. Your card was not charged."}
                            </p>
                            <div className="sco-confirm-actions">
                                {eventId && categoryId && (
                                    <Link
                                        to={`/events/${eventId}?tab=entries`}
                                        className="sco-confirm-btn sco-confirm-btn--primary"
                                    >
                                        Try again
                                    </Link>
                                )}
                                <Link to="/events" className="sco-confirm-btn sco-confirm-btn--ghost">
                                    Back to events
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
