import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    collection, documentId, getDocs, onSnapshot, query, where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { db, functions } from "../../../../../shared/lib/firebase";
import { useAuth } from "../../../../../providers/AuthProvider";
import type { EventDoc, EventCategory } from "../../../types";
import type { BoatDoc } from "../../../../signup/types";
import { parseBoatClassFromCategory, boatSizeFromBoatClass } from "../../../lib/categories";
import { formatCents } from "../../../../../features/payments/types";

// ── Stripe setup ──────────────────────────────────────────────────────────────

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
    dateOfBirth?: string;
    gender?: "male" | "female";
    roles?: { rower?: { clubMemberships?: Array<{ clubName: string }> } };
};

type UserDoc = { displayName?: string; fullName?: string };

type Props = {
    event: EventDoc & { [key: string]: any };
    eventId: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayYMD() { return new Date().toISOString().slice(0, 10); }

function ageOnDate(dobYmd: string, onYmd: string) {
    const [y, m, d] = dobYmd.split("-").map(Number);
    const [yy, mm, dd] = onYmd.split("-").map(Number);
    let age = yy - y;
    if (mm < m || (mm === m && dd < d)) age -= 1;
    return age;
}

function parseCategoryParts(catName: string): { gender: string; division: string } | null {
    const parts = catName.split("•").map((s) => s.trim());
    if (parts.length < 2) return null;
    return { gender: parts[0], division: parts[1] };
}

function isEligible(profile: Profile, catName: string) {
    const parts = parseCategoryParts(catName);
    if (!parts || !profile.dateOfBirth || !profile.gender) return false;
    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;
    if (parts.gender === "Men" && profile.gender !== "male") return false;
    if (parts.gender === "Women" && profile.gender !== "female") return false;
    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;
    if (div.startsWith("Masters")) {
        const m = div.match(/Masters(?:\s+([A-K]))?/i);
        if (m) {
            const bands: Record<string, [number, number | null]> = {
                A: [27, 35], B: [36, 42], C: [43, 49], D: [50, 54], E: [55, 59],
                F: [60, 64], G: [65, 69], H: [70, 74], I: [75, 79], J: [80, 84], K: [85, null],
            };
            const band = (m[1] ?? "").toUpperCase();
            const [min, max] = bands[band] ?? [27, null];
            if (age < min) return false;
            if (max !== null && age > max) return false;
        }
    }
    return true;
}

function boatSizeLabel(size: number) {
    if (size === 1) return "Single (1x)";
    if (size === 2) return "Double (2x)";
    if (size === 4) return "Quad (4x)";
    if (size === 8) return "Eight (8+)";
    return String(size);
}

function inviteLink(eid: string, code: string) {
    return `${window.location.origin}/invite/${eid}/${code}`;
}

// ── CopyInvite ────────────────────────────────────────────────────────────────

function CopyInvite({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="ep-invite-box">
            <div className="ep-invite-label">Invite link</div>
            <div className="ep-invite-row">
                <a className="ep-invite-link" href={url} target="_blank" rel="noreferrer">{url}</a>
                <button
                    type="button"
                    className="ep-copy-btn"
                    onClick={async () => {
                        try { await navigator.clipboard.writeText(url); }
                        catch { window.prompt("Copy this invite link:", url); }
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                >
                    {copied ? "✓ Copied" : "Copy"}
                </button>
            </div>
        </div>
    );
}

// ── SeatDots ──────────────────────────────────────────────────────────────────

function SeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div className="ep-seat-dots">
            {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`ep-seat-dot${i < filled ? " ep-seat-dot--filled" : ""}`} />
            ))}
        </div>
    );
}

// ── PaymentForm (inner Stripe component) ──────────────────────────────────────

function PaymentForm({
    totalChargedCents,
    onSuccess,
}: {
    totalChargedCents: number;
    onSuccess: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [paying, setPaying] = useState(false);
    const [payErr, setPayErr] = useState<string | null>(null);

    async function handlePay(e: React.FormEvent) {
        e.preventDefault();
        if (!stripe || !elements) return;
        setPaying(true);
        setPayErr(null);
        try {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: window.location.href },
                redirect: "if_required",
            });
            if (error) {
                setPayErr(error.message ?? "Payment failed.");
            } else {
                onSuccess();
            }
        } finally {
            setPaying(false);
        }
    }

    return (
        <form onSubmit={handlePay}>
            <div className="ep-stripe-wrap">
                <PaymentElement />
            </div>
            {payErr && <p className="ep-error-text">{payErr}</p>}
            <button className="ep-pay-btn" type="submit" disabled={!stripe || paying}>
                {paying ? "Processing…" : `Confirm & Pay ${formatCents(totalChargedCents)}`}
            </button>
        </form>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RegistrationTab({ event, eventId }: Props) {
    const { user, profile } = useAuth() as any;
    const p: Profile | null = profile ?? null;

    const [boats, setBoats] = useState<(BoatDoc & { id: string })[]>([]);
    const [userByUid, setUserByUid] = useState<Map<string, UserDoc>>(new Map());
    const [categoryId, setCategoryId] = useState("");

    // Payment state
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [feeBreakdown, setFeeBreakdown] = useState<{
        eventFeeCents: number;
        processingFeeCents: number;
        totalChargedCents: number;
    } | null>(null);
    const [loadingIntent, setLoadingIntent] = useState(false);
    const [intentErr, setIntentErr] = useState<string | null>(null);
    const [paySuccess, setPaySuccess] = useState(false);

    // Subscribe to boats
    useEffect(() => {
        const ref = collection(db, "events", eventId, "boats");
        return onSnapshot(ref, (snap) => {
            setBoats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        });
    }, [eventId]);

    // Fetch rower display names
    useEffect(() => {
        const uids = Array.from(new Set(boats.flatMap((b) => b.rowerUids ?? [])));
        if (!uids.length) return;
        (async () => {
            const m = new Map<string, UserDoc>();
            for (let i = 0; i < uids.length; i += 10) {
                const snap = await getDocs(
                    query(collection(db, "users"), where(documentId(), "in", uids.slice(i, i + 10)))
                );
                snap.docs.forEach((d) => m.set(d.id, d.data() as UserDoc));
            }
            setUserByUid(m);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boats]);

    const eligibleCategories = useMemo(() => {
        if (!p?.roles?.rower) return [];
        return (event.categories ?? []).filter((c: EventCategory) => isEligible(p, c.name));
    }, [event.categories, p]);

    // Auto-select first eligible category
    useEffect(() => {
        if (eligibleCategories.length && !eligibleCategories.some((c) => c.id === categoryId)) {
            setCategoryId(eligibleCategories[0].id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eligibleCategories]);

    const selectedCategory: EventCategory | null =
        (event.categories ?? []).find((c: EventCategory) => c.id === categoryId) ?? null;

    const derivedBoatSize = useMemo(() => {
        if (!selectedCategory) return null;
        const bc = parseBoatClassFromCategory(selectedCategory.name);
        return bc ? boatSizeFromBoatClass(bc) : null;
    }, [selectedCategory]);

    const clubName = p?.roles?.rower?.clubMemberships?.[0]?.clubName ?? "";

    const alreadyInCategory = useMemo(() => {
        if (!user || !selectedCategory) return false;
        return boats.some(
            (b) => (b.rowerUids ?? []).includes(user.uid) &&
                (b.categoryId === selectedCategory.id || (b.categoryName ?? "") === selectedCategory.name)
        );
    }, [boats, user, selectedCategory]);

    const myPendingCrews = useMemo(() =>
        boats.filter((b) => b.status === "pending_crew" && (b.rowerUids ?? []).includes(user?.uid)),
        [boats, user]
    );

    const myRegisteredBoats = useMemo(() =>
        boats.filter((b) => (b.status === "registered" || !b.status) && (b.rowerUids ?? []).includes(user?.uid)),
        [boats, user]
    );

    const otherRegisteredBoats = useMemo(() =>
        boats.filter((b) => (b.status === "registered" || !b.status) && !(b.rowerUids ?? []).includes(user?.uid)),
        [boats, user]
    );

    const isFree = !selectedCategory?.feeCents || selectedCategory.feeCents <= 0;

    // Load payment intent when category changes (paid categories only)
    useEffect(() => {
        if (!selectedCategory || isFree || !user || alreadyInCategory || !clubName || !derivedBoatSize) return;
        setClientSecret(null);
        setFeeBreakdown(null);
        setPaySuccess(false);
        setIntentErr(null);
        setLoadingIntent(true);
        (async () => {
            try {
                const fn = httpsCallable(functions, "createPaymentIntent");
                const result = await fn({
                    eventId,
                    categoryId: selectedCategory.id,
                    clubName,
                    boatSize: derivedBoatSize,
                });
                const data = result.data as any;
                setClientSecret(data.clientSecret);
                setFeeBreakdown({
                    eventFeeCents: data.eventFeeCents,
                    processingFeeCents: data.processingFeeCents,
                    totalChargedCents: data.totalChargedCents,
                });
            } catch (err: any) {
                setIntentErr(err?.message ?? "Failed to prepare payment.");
            } finally {
                setLoadingIntent(false);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory?.id, user?.uid, alreadyInCategory, clubName, derivedBoatSize]);

    function renderBoatCard(b: BoatDoc & { id: string }, isOwn?: boolean) {
        const filled = b.rowerUids?.length ?? 0;
        const total = b.boatSize ?? 0;
        const isPending = b.status === "pending_crew";
        return (
            <li key={b.id} className={`ep-boat-card${isOwn ? " ep-boat-card--own" : ""}`}>
                {isOwn && !isPending && <div className="ep-you-tag">Your entry</div>}
                <SeatDots filled={filled} total={total} />
                <div className="ep-boat-club">{b.clubName}</div>
                <div className="ep-boat-cat">{b.categoryName}</div>
                {isPending && (
                    <div className="ep-muted" style={{ fontSize: "0.78rem", marginBottom: "0.35rem" }}>
                        Waiting for {total - filled} more rower{total - filled !== 1 ? "s" : ""}
                    </div>
                )}
                <ul className="ep-crew-list">
                    {(b.rowerUids ?? []).map((uid: string) => (
                        <li key={uid} className="ep-crew-item">
                            <span className="ep-crew-avatar">
                                {(userByUid.get(uid)?.displayName ?? userByUid.get(uid)?.fullName ?? "?").charAt(0)}
                            </span>
                            <span>{userByUid.get(uid)?.displayName ?? userByUid.get(uid)?.fullName ?? uid.slice(0, 6)}</span>
                            {user?.uid === uid && <span className="ep-you-tag">you</span>}
                        </li>
                    ))}
                </ul>
                {isOwn && isPending && b.inviteCode && (
                    <CopyInvite url={inviteLink(eventId, b.inviteCode)} />
                )}
            </li>
        );
    }

    // ── Auth gate ─────────────────────────────────────────────────────────────
    if (!user) {
        return (
            <div className="ep-reg-card card">
                <p className="ep-muted">
                    <Link to={`/auth?redirect=/events/${eventId}?tab=registration`} className="ep-link">
                        Sign in
                    </Link>{" "}
                    to register for this event.
                </p>
            </div>
        );
    }

    if (!p?.roles?.rower) {
        return (
            <div className="ep-reg-card card ep-info-box">
                Sign-up is available for rowers only. Coaches and guardians can{" "}
                <Link to={`/events/${eventId}`} className="ep-link">view the overview</Link>.
            </div>
        );
    }

    if (event.status !== "open") {
        return (
            <div className="ep-reg-card card ep-info-box">
                Registration is {event.status} for this event.
            </div>
        );
    }

    if (!clubName) {
        return (
            <div className="ep-reg-card card ep-info-box">
                You need to join a club before you can register.{" "}
                <Link to="/profile" className="ep-link">Go to your profile</Link>.
            </div>
        );
    }

    return (
        <div>
            {/* My registrations summary */}
            {myRegisteredBoats.length > 0 && (
                <div className="ep-success-banner" style={{ marginBottom: "1rem" }}>
                    You have {myRegisteredBoats.length} registered {myRegisteredBoats.length === 1 ? "entry" : "entries"} in this event.
                </div>
            )}

            {/* Sign-up card */}
            <div className="card ep-reg-card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Enter a Category</h3>

                {eligibleCategories.length === 0 ? (
                    <p className="ep-muted">No eligible categories found for your profile.</p>
                ) : (
                    <>
                        <label className="ep-field-label">Category</label>
                        <div className="ep-select-wrap">
                            <select
                                className="ep-select"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                            >
                                {eligibleCategories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {derivedBoatSize && (
                            <div style={{ marginTop: "0.5rem" }}>
                                <span className="ep-badge">{boatSizeLabel(derivedBoatSize)}</span>
                            </div>
                        )}

                        {alreadyInCategory && (
                            <div className="ep-info-box" style={{ marginTop: "0.75rem" }}>
                                ✓ You're already entered in this category.
                            </div>
                        )}

                        {!alreadyInCategory && paySuccess && (
                            <div className="ep-success-banner">
                                Payment confirmed! Your boat entry is being created and will appear in the start list shortly.
                            </div>
                        )}

                        {!alreadyInCategory && !paySuccess && (
                            <>
                                {isFree ? (
                                    /* Free category — no payment needed, but we can't create boat
                                       directly from here if the host hasn't set fees.
                                       For free events, link to the legacy signup page for now. */
                                    <div className="ep-info-box" style={{ marginTop: "0.75rem" }}>
                                        This category has no entry fee.{" "}
                                        <Link
                                            to={`/rower/events/${eventId}/signup`}
                                            className="ep-link"
                                        >
                                            Register for free →
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        {loadingIntent && (
                                            <div className="ep-skeleton-bar" style={{ height: 80, borderRadius: 8, marginTop: "1rem" }} />
                                        )}

                                        {intentErr && (
                                            <p className="ep-error-text" style={{ marginTop: "0.5rem" }}>{intentErr}</p>
                                        )}

                                        {feeBreakdown && !loadingIntent && (
                                            <div className="ep-fee-breakdown">
                                                <div className="ep-fee-line">
                                                    <span>Event fee</span>
                                                    <span>{formatCents(feeBreakdown.eventFeeCents)}</span>
                                                </div>
                                                <div className="ep-fee-line">
                                                    <span>Processing fee</span>
                                                    <span>{formatCents(feeBreakdown.processingFeeCents)}</span>
                                                </div>
                                                <div className="ep-fee-line total">
                                                    <span>Total</span>
                                                    <span>{formatCents(feeBreakdown.totalChargedCents)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {clientSecret && stripePromise && feeBreakdown && (
                                            <Elements
                                                stripe={stripePromise}
                                                options={{
                                                    clientSecret,
                                                    appearance: {
                                                        theme: "night",
                                                        variables: {
                                                            colorPrimary: "#ffd400",
                                                            colorBackground: "#1a1a1a",
                                                        },
                                                    },
                                                }}
                                            >
                                                <PaymentForm
                                                    totalChargedCents={feeBreakdown.totalChargedCents}
                                                    onSuccess={() => setPaySuccess(true)}
                                                />
                                            </Elements>
                                        )}

                                        {!stripeKey && (
                                            <p className="ep-error-text" style={{ marginTop: "0.5rem" }}>
                                                Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment.
                                            </p>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Pending crews */}
            {myPendingCrews.length > 0 && (
                <>
                    <div className="ep-section-title">Your Crews in Progress</div>
                    <ul className="ep-boats-grid">
                        {myPendingCrews.map((b) => renderBoatCard(b, true))}
                    </ul>
                </>
            )}

            {/* Start list */}
            <div className="ep-section-title">Start List ({boats.filter((b) => b.status === "registered" || !b.status).length} entries)</div>

            {myRegisteredBoats.length > 0 && (
                <ul className="ep-boats-grid" style={{ marginBottom: "0.75rem" }}>
                    {myRegisteredBoats.map((b) => renderBoatCard(b, true))}
                </ul>
            )}

            {otherRegisteredBoats.length === 0 && myRegisteredBoats.length === 0 ? (
                <p className="ep-muted">No boats registered yet — be the first!</p>
            ) : (
                <ul className="ep-boats-grid">
                    {otherRegisteredBoats.map((b) => renderBoatCard(b))}
                </ul>
            )}
        </div>
    );
}
