import { useEffect, useState, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../../shared/lib/firebase";

// ---------- Types ----------

interface EntryInput {
    categoryId:   string;
    categoryName: string;
    count:        number;
    feeCents:     number;
}

interface BreakdownEntry {
    categoryId:   string;
    categoryName: string;
    count:        number;
    feeCents:     number;
}

interface CoachPaymentIntentResult {
    clientSecret:     string;
    totalAmountCents: number;
    currency:         string;
    eventName:        string;
    breakdown:        BreakdownEntry[];
}

interface CoachCheckoutModalProps {
    eventId:  string;
    entries:  EntryInput[];
    onClose:  () => void;
}

// ---------- Stripe loader (singleton) ----------

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ---------- Price helpers ----------

function formatUsd(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function calcTotalCharged(feeCents: number) {
    return Math.ceil((feeCents + 30) / (1 - 0.029));
}

// ---------- Inner form ----------

function CoachCheckoutForm({
    totalAmountCents,
    eventId,
    breakdown,
}: {
    totalAmountCents: number;
    eventId:          string;
    breakdown:        BreakdownEntry[];
}) {
    const stripe   = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);
    const [err,  setErr]  = useState<string | null>(null);

    const totalCharged    = calcTotalCharged(totalAmountCents);
    const processingFee   = totalCharged - totalAmountCents;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setBusy(true);
        setErr(null);

        const returnUrl = `${window.location.origin}/booking/confirm?eventId=${encodeURIComponent(eventId)}&flow=coach`;

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
        });

        if (error) {
            setErr(error.message ?? "Payment failed. Please try again.");
            setBusy(false);
        }
        // On success, Stripe redirects to return_url
    };

    return (
        <form onSubmit={handleSubmit} className="sco-form">
            {/* Per-entry breakdown */}
            <div className="sco-breakdown">
                {breakdown.map((entry, i) => (
                    <div key={i} className="sco-breakdown-row">
                        <span>
                            {entry.categoryName}
                            {entry.count > 1 && <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>×{entry.count}</span>}
                        </span>
                        <span>{formatUsd(entry.feeCents * entry.count)}</span>
                    </div>
                ))}
                <div className="sco-breakdown-row sco-breakdown-row--sub">
                    <span>Processing fee</span>
                    <span>{formatUsd(processingFee)}</span>
                </div>
                <div className="sco-breakdown-row sco-breakdown-row--total">
                    <span>Total</span>
                    <span>{formatUsd(totalCharged)}</span>
                </div>
            </div>

            <div className="sco-payment-element-wrap">
                <PaymentElement
                    options={{
                        layout: "accordion",
                        fields: { billingDetails: { name: "auto" } },
                    }}
                />
            </div>

            <p className="sco-refund-policy">
                Full refund if the event is cancelled by the organiser. Athlete cancellations are
                subject to the event refund policy. By proceeding you agree to these terms.
            </p>

            {err && <div className="sco-error">{err}</div>}

            <button
                type="submit"
                className="sco-pay-btn"
                disabled={!stripe || busy}
            >
                {busy ? "Processing…" : `Pay ${formatUsd(totalCharged)} & Create Entries`}
            </button>
        </form>
    );
}

// ---------- Modal shell ----------

export default function CoachCheckoutModal({ eventId, entries, onClose }: CoachCheckoutModalProps) {
    const [state, setState] = useState<
        | { phase: "loading" }
        | { phase: "ready"; result: CoachPaymentIntentResult }
        | { phase: "error"; message: string }
    >({ phase: "loading" });

    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const functions    = getFunctions(app);
        const createCoachPI = httpsCallable<
            { eventId: string; entries: { categoryId: string; count: number }[] },
            CoachPaymentIntentResult
        >(functions, "createCoachPaymentIntent");

        createCoachPI({
            eventId,
            entries: entries.map((e) => ({ categoryId: e.categoryId, count: e.count })),
        })
            .then(({ data }) => setState({ phase: "ready", result: data }))
            .catch((e: any) =>
                setState({ phase: "error", message: e?.message ?? "Could not initiate payment." })
            );
    }, [eventId, entries]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const entryCount = entries.reduce((sum, e) => sum + e.count, 0);

    return (
        <div className="sco-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="sco-modal" role="dialog" aria-modal="true" aria-label="Coach entry checkout">

                <div className="sco-header">
                    <div>
                        <div className="sco-header-eyebrow">Enter Crews</div>
                        <div className="sco-header-title">
                            {state.phase === "ready" ? state.result.eventName : "Loading…"}
                        </div>
                        <div className="sco-header-category">
                            {entryCount} {entryCount === 1 ? "entry" : "entries"}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sco-close-btn"
                        onClick={onClose}
                        aria-label="Close checkout"
                    >
                        ✕
                    </button>
                </div>

                <div className="sco-body">
                    {state.phase === "loading" && (
                        <div className="sco-loading">
                            <div className="sco-spinner" />
                            <span>Setting up payment…</span>
                        </div>
                    )}

                    {state.phase === "error" && (
                        <div className="sco-err-state">
                            <div className="sco-err-icon">⚠</div>
                            <p>{state.message}</p>
                            <button type="button" className="sco-pay-btn" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    )}

                    {state.phase === "ready" && (
                        <Elements
                            stripe={stripePromise}
                            options={{
                                clientSecret: state.result.clientSecret,
                                appearance: {
                                    theme: "night",
                                    variables: {
                                        colorPrimary:    "#FEB959",
                                        colorBackground: "#1a1a1e",
                                        colorText:       "#f0eee8",
                                        colorDanger:     "#ff4d6d",
                                        borderRadius:    "10px",
                                        fontFamily:      "system-ui, -apple-system, sans-serif",
                                    },
                                },
                            }}
                        >
                            <CoachCheckoutForm
                                totalAmountCents={state.result.totalAmountCents}
                                eventId={eventId}
                                breakdown={state.result.breakdown}
                            />
                        </Elements>
                    )}
                </div>
            </div>
        </div>
    );
}
