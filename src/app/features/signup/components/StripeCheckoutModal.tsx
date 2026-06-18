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

interface CheckoutModalProps {
    eventId: string;
    categoryId: string;
    categoryName: string;
    onClose: () => void;
}

interface PaymentIntentResult {
    clientSecret: string;
    amountCents: number;
    currency: string;
    eventName: string;
    categoryName: string;
}

// ---------- Stripe loader (singleton) ----------

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ---------- Price helpers ----------

function formatUsd(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function calcBreakdown(feeCents: number) {
    const totalCharged   = Math.ceil((feeCents + 30) / (1 - 0.029));
    const processingFee  = totalCharged - feeCents;
    return { feeCents, processingFee, totalCharged };
}

// ---------- Inner form (must live inside <Elements>) ----------

function CheckoutForm({
    amountCents,
    eventId,
    categoryId,
}: {
    amountCents: number;
    eventId: string;
    categoryId: string;
}) {
    const stripe   = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);
    const [err,  setErr]  = useState<string | null>(null);

    const { feeCents, processingFee, totalCharged } = calcBreakdown(amountCents);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setBusy(true);
        setErr(null);

        const returnUrl = `${window.location.origin}/booking/confirm?eventId=${encodeURIComponent(eventId)}&categoryId=${encodeURIComponent(categoryId)}`;

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
        });

        if (error) {
            setErr(error.message ?? "Payment failed. Please try again.");
            setBusy(false);
        }
        // On success, Stripe redirects to return_url — no explicit handling needed here
    };

    return (
        <form onSubmit={handleSubmit} className="sco-form">
            {/* Price breakdown */}
            <div className="sco-breakdown">
                <div className="sco-breakdown-row">
                    <span>Entry fee</span>
                    <span>{formatUsd(feeCents)}</span>
                </div>
                <div className="sco-breakdown-row sco-breakdown-row--sub">
                    <span>Processing fee</span>
                    <span>{formatUsd(processingFee)}</span>
                </div>
                <div className="sco-breakdown-row sco-breakdown-row--total">
                    <span>Total</span>
                    <span>{formatUsd(totalCharged)}</span>
                </div>
            </div>

            {/* Stripe Payment Element */}
            <div className="sco-payment-element-wrap">
                <PaymentElement
                    options={{
                        layout: "accordion",
                        fields: { billingDetails: { name: "auto" } },
                    }}
                />
            </div>

            {/* Refund policy — must be shown before payment button (legal requirement) */}
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
                {busy ? "Processing…" : `Pay ${formatUsd(totalCharged)} & Register`}
            </button>
        </form>
    );
}

// ---------- Modal shell ----------

export default function StripeCheckoutModal({
    eventId,
    categoryId,
    categoryName,
    onClose,
}: CheckoutModalProps) {
    const [state, setState] = useState<
        | { phase: "loading" }
        | { phase: "ready"; result: PaymentIntentResult }
        | { phase: "error"; message: string }
    >({ phase: "loading" });

    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const functions = getFunctions(app);
        const createPI  = httpsCallable<
            { eventId: string; categoryId: string },
            PaymentIntentResult
        >(functions, "createPaymentIntent");

        createPI({ eventId, categoryId })
            .then(({ data }) => setState({ phase: "ready", result: data }))
            .catch((e: any) =>
                setState({ phase: "error", message: e?.message ?? "Could not initiate payment." })
            );
    }, [eventId, categoryId]);

    // Close on backdrop click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div className="sco-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="sco-modal" role="dialog" aria-modal="true" aria-label="Event checkout">

                {/* Header */}
                <div className="sco-header">
                    <div>
                        <div className="sco-header-eyebrow">Enter Race</div>
                        <div className="sco-header-title">
                            {state.phase === "ready" ? state.result.eventName : "Loading…"}
                        </div>
                        <div className="sco-header-category">{categoryName}</div>
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

                {/* Body */}
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
                            <CheckoutForm
                                amountCents={state.result.amountCents}
                                eventId={eventId}
                                categoryId={categoryId}
                            />
                        </Elements>
                    )}
                </div>
            </div>
        </div>
    );
}
