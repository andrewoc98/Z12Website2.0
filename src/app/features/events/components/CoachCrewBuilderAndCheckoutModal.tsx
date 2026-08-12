import { useState, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../../shared/lib/firebase";
import { listClubRowers } from "../../signup/services/crewInviteService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntryInput {
    categoryId: string;
    categoryName: string;
    count: number;
    feeCents: number;
    boatSize: number;
}

interface CrewSlot {
    localId: string;
    categoryId: string;
    categoryName: string;
    boatSize: number;
    rowerUids: string[];
}

interface ClubAthlete {
    uid: string;
    displayName: string;
}

interface BreakdownEntry {
    categoryId: string;
    categoryName: string;
    count: number;
    feeCents: number;
}

interface CoachPaymentIntentResult {
    clientSecret: string;
    totalAmountCents: number;
    currency: string;
    eventName: string;
    breakdown: BreakdownEntry[];
}

type Phase =
    | { name: "building" }
    | { name: "checkout-loading" }
    | { name: "paying"; clientSecret: string; totalAmountCents: number; breakdown: BreakdownEntry[] }
    | { name: "error"; message: string };

export interface CoachCrewBuilderAndCheckoutModalProps {
    eventId: string;
    eventName: string;
    entries: EntryInput[];
    onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

function fmtUsd(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function calcTotalCharged(feeCents: number) {
    return Math.ceil((feeCents + 30) / (1 - 0.029));
}

// ─── SeatDots ─────────────────────────────────────────────────────────────────

function SeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Array.from({ length: total }, (_, i) => (
                <span key={i} style={{
                    display: "block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: i < filled ? "#FEB959" : "rgba(255,255,255,0.1)",
                    border: i < filled ? "none" : "1px solid rgba(255,255,255,0.18)",
                }} />
            ))}
        </div>
    );
}

// ─── CrewCard ─────────────────────────────────────────────────────────────────

function CrewCard({
    crew, sequenceLabel, athletes, loadingAthletes, assignedElsewhere,
    onAddAthlete, onRemoveAthlete, onRemove, onRequestAthletes,
}: {
    crew: CrewSlot;
    sequenceLabel: string;
    /** CF-filtered: eligible for this category + not already in a paid Firestore boat */
    athletes: ClubAthlete[];
    loadingAthletes: boolean;
    /** UIDs assigned to OTHER crews of the same category within this modal session */
    assignedElsewhere: Set<string>;
    onAddAthlete: (uid: string) => void;
    onRemoveAthlete: (uid: string) => void;
    onRemove: () => void;
    onRequestAthletes: () => void;
}) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    const [hasTriggeredLoad, setHasTriggeredLoad] = useState(false);

    const isFull = crew.rowerUids.length >= crew.boatSize;
    const inThisSet = useMemo(() => new Set(crew.rowerUids), [crew.rowerUids]);

    const filteredAthletes = useMemo(() => {
        const q = searchQ.toLowerCase().trim();
        if (!q) {
            // No query: only show athletes who are available to add
            return athletes.filter(a => !inThisSet.has(a.uid) && !assignedElsewhere.has(a.uid));
        }
        // With a query: show all matches so the coach can see why someone is unavailable
        return athletes.filter(a => a.displayName.toLowerCase().includes(q));
    }, [athletes, inThisSet, assignedElsewhere, searchQ]);

    function toggleSearch() {
        if (!hasTriggeredLoad) {
            onRequestAthletes();
            setHasTriggeredLoad(true);
        }
        setSearchOpen(o => !o);
    }

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                padding: "14px 16px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                gap: 12,
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                        {sequenceLabel}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f0eee8", marginBottom: 8, lineHeight: 1.3 }}>
                        {crew.categoryName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <SeatDots filled={crew.rowerUids.length} total={crew.boatSize} />
                        <span style={{
                            fontSize: 11,
                            color: isFull ? "#48c78e" : "rgba(255,255,255,0.35)",
                            fontWeight: isFull ? 600 : 400,
                        }}>
                            {isFull ? "Crew complete" : `${crew.rowerUids.length} / ${crew.boatSize} filled`}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onRemove}
                    style={{
                        flexShrink: 0,
                        background: "rgba(255,107,107,0.06)",
                        border: "1px solid rgba(255,107,107,0.18)",
                        borderRadius: 6, padding: "4px 10px",
                        color: "#ff6b6b", fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}
                >
                    Remove
                </button>
            </div>

            {/* Assigned athletes */}
            <div style={{ padding: "8px 16px 0" }}>
                {crew.rowerUids.length === 0 ? (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: "10px 0 12px", fontStyle: "italic" }}>
                        No athletes assigned yet.
                    </p>
                ) : crew.rowerUids.map(uid => {
                    const athlete = athletes.find(a => a.uid === uid);
                    const name = athlete?.displayName ?? uid.slice(0, 8);
                    return (
                        <div key={uid} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: "rgba(254,185,89,0.1)", border: "1px solid rgba(254,185,89,0.18)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700, color: "#FEB959", flexShrink: 0,
                            }}>
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ flex: 1, fontSize: 13, color: "#f0eee8" }}>{name}</span>
                            <button
                                onClick={() => onRemoveAthlete(uid)}
                                title="Remove from crew"
                                style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    border: "1px solid rgba(255,107,107,0.22)",
                                    background: "transparent", color: "#ff6b6b",
                                    fontSize: 15, padding: 0, flexShrink: 0, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >×</button>
                        </div>
                    );
                })}
            </div>

            {/* Add athlete button */}
            <div style={{ padding: "10px 16px 14px" }}>
                {!isFull && (
                    <button
                        onClick={toggleSearch}
                        style={{
                            width: "100%", padding: "7px 12px", borderRadius: 8,
                            border: `1px solid ${searchOpen ? "rgba(254,185,89,0.5)" : "rgba(254,185,89,0.28)"}`,
                            background: searchOpen ? "rgba(254,185,89,0.1)" : "rgba(254,185,89,0.05)",
                            color: "#FEB959", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {searchOpen ? "Close" : "+ Add from club"}
                    </button>
                )}
            </div>

            {/* Search panel */}
            {searchOpen && !isFull && (
                <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    padding: "12px 16px 14px",
                    background: "rgba(0,0,0,0.18)",
                }}>
                    {loadingAthletes ? (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                            Loading eligible athletes…
                        </p>
                    ) : (
                        <>
                            <input
                                autoFocus
                                type="text"
                                placeholder={`Search eligible athletes…`}
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                                style={{
                                    width: "100%", padding: "8px 12px", boxSizing: "border-box",
                                    borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                                    background: "rgba(255,255,255,0.04)", color: "#f0eee8",
                                    fontSize: 13, outline: "none",
                                }}
                            />
                            {filteredAthletes.length > 0 ? (
                                <div style={{
                                    marginTop: 6, maxHeight: 200, overflowY: "auto",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 8, background: "rgba(16,16,20,0.96)",
                                }}>
                                    {filteredAthletes.slice(0, 30).map((a, i) => {
                                        const inThis = inThisSet.has(a.uid);
                                        const inSameCat = !inThis && assignedElsewhere.has(a.uid);
                                        const disabled = inThis || inSameCat;
                                        return (
                                            <div key={a.uid} style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "8px 12px",
                                                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                            }}>
                                                <div style={{
                                                    width: 26, height: 26, borderRadius: "50%",
                                                    background: "rgba(255,255,255,0.05)", flexShrink: 0,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
                                                }}>
                                                    {a.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                        color: disabled ? "rgba(255,255,255,0.3)" : "#f0eee8",
                                                    }}>
                                                        {a.displayName}
                                                    </div>
                                                    {inSameCat && (
                                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>
                                                            Already in another entry for this category
                                                        </div>
                                                    )}
                                                    {inThis && (
                                                        <div style={{ fontSize: 10, color: "#48c78e" }}>Already added</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (disabled) return;
                                                        onAddAthlete(a.uid);
                                                        setSearchQ("");
                                                        if (crew.rowerUids.length + 1 >= crew.boatSize) setSearchOpen(false);
                                                    }}
                                                    disabled={disabled}
                                                    style={{
                                                        padding: "4px 12px", borderRadius: 6, flexShrink: 0,
                                                        border: `1px solid ${disabled ? "rgba(255,255,255,0.07)" : "rgba(254,185,89,0.38)"}`,
                                                        background: disabled ? "transparent" : "rgba(254,185,89,0.08)",
                                                        color: disabled ? "rgba(255,255,255,0.2)" : "#FEB959",
                                                        fontSize: 11, fontWeight: 600,
                                                        cursor: disabled ? "default" : "pointer",
                                                    }}
                                                >
                                                    {inThis ? "Added" : "Add"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                                    {searchQ
                                        ? `No matches for "${searchQ}"`
                                        : "No eligible athletes available for this category"}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Stripe Checkout Form ─────────────────────────────────────────────────────

function CheckoutForm({
    totalAmountCents, eventId, breakdown,
}: {
    totalAmountCents: number;
    eventId: string;
    breakdown: BreakdownEntry[];
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const totalCharged = calcTotalCharged(totalAmountCents);
    const processingFee = totalCharged - totalAmountCents;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        setErr(null);
        const returnUrl = `${window.location.origin}/booking/confirm?eventId=${encodeURIComponent(eventId)}&flow=coach`;
        const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
        if (error) {
            setErr(error.message ?? "Payment failed. Please try again.");
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ marginBottom: 16 }}>
                {breakdown.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                            {e.categoryName}
                            {e.count > 1 && <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>×{e.count}</span>}
                        </span>
                        <span style={{ color: "#f0eee8", fontSize: 13 }}>{fmtUsd(e.feeCents * e.count)}</span>
                    </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Processing fee</span>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{fmtUsd(processingFee)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "#f0eee8", fontWeight: 700, fontSize: 14 }}>Total</span>
                    <span style={{ color: "#FEB959", fontWeight: 700, fontSize: 14 }}>{fmtUsd(totalCharged)}</span>
                </div>
            </div>

            <PaymentElement options={{ layout: "accordion", fields: { billingDetails: { name: "auto" } } }} />

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, margin: "12px 0" }}>
                Full refund if the event is cancelled by the organiser, or if the event is rescheduled and you opt out within 14 days. No refund is issued for incomplete crew boats.
            </p>

            {err && <div style={{ color: "#ff6b6b", fontSize: 12, marginBottom: 10 }}>{err}</div>}

            <button
                type="submit"
                disabled={!stripe || busy}
                style={{
                    padding: "13px",
                    background: !stripe || busy ? "rgba(254,185,89,0.4)" : "#FEB959",
                    color: "#1a1a1e", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: !stripe || busy ? "default" : "pointer",
                    transition: "opacity 0.2s",
                }}
            >
                {busy ? "Processing…" : `Pay ${fmtUsd(totalCharged)} & Confirm Booking`}
            </button>
        </form>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CoachCrewBuilderAndCheckoutModal({
    eventId, eventName, entries, onClose,
}: CoachCrewBuilderAndCheckoutModalProps) {
    // Initialise one crew slot per entry × count
    const [crews, setCrews] = useState<CrewSlot[]>(() => {
        const slots: CrewSlot[] = [];
        let counter = 0;
        entries.forEach(e => {
            for (let i = 0; i < e.count; i++) {
                slots.push({
                    localId: `${e.categoryId}-${counter++}`,
                    categoryId: e.categoryId,
                    categoryName: e.categoryName,
                    boatSize: e.boatSize,
                    rowerUids: [],
                });
            }
        });
        return slots;
    });

    // Athletes fetched per category via listClubRowers (eligibility + existing Firestore boat filtering done server-side)
    const [athletesByCategory, setAthletesByCategory] = useState<Map<string, ClubAthlete[]>>(new Map());
    const [loadingCategoryIds, setLoadingCategoryIds] = useState<Set<string>>(new Set());

    const [phase, setPhase] = useState<Phase>({ name: "building" });

    async function loadAthletesForCategory(categoryId: string, categoryName: string) {
        if (athletesByCategory.has(categoryId) || loadingCategoryIds.has(categoryId)) return;
        setLoadingCategoryIds(prev => new Set(prev).add(categoryId));
        try {
            const result = await listClubRowers({ eventId, categoryId, categoryName });
            setAthletesByCategory(prev => new Map(prev).set(categoryId, result.rowers));
        } catch {
            setAthletesByCategory(prev => new Map(prev).set(categoryId, []));
        } finally {
            setLoadingCategoryIds(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
        }
    }

    // Per-category set of all assigned UIDs (across ALL crews) — used to compute per-card exclusions
    const assignedUidsByCategoryId = useMemo(() => {
        const m = new Map<string, Set<string>>();
        for (const c of crews) {
            if (!m.has(c.categoryId)) m.set(c.categoryId, new Set());
            c.rowerUids.forEach(uid => m.get(c.categoryId)!.add(uid));
        }
        return m;
    }, [crews]);

    const incompleteCount = crews.filter(c => c.rowerUids.length < c.boatSize).length;

    const feeByCategory = useMemo(() => {
        const m = new Map<string, number>();
        entries.forEach(e => m.set(e.categoryId, e.feeCents));
        return m;
    }, [entries]);

    const totalFeeCents = useMemo(
        () => crews.reduce((sum, c) => sum + (feeByCategory.get(c.categoryId) ?? 0), 0),
        [crews, feeByCategory]
    );

    // Per-crew sequence label within its category: "Crew 1", "Crew 2", …
    const sequenceLabels = useMemo(() => {
        const counts = new Map<string, number>();
        return crews.map(c => {
            const n = (counts.get(c.categoryId) ?? 0) + 1;
            counts.set(c.categoryId, n);
            return `Crew ${n}`;
        });
    }, [crews]);

    function addAthlete(localId: string, uid: string) {
        setCrews(prev => prev.map(c =>
            c.localId === localId && !c.rowerUids.includes(uid)
                ? { ...c, rowerUids: [...c.rowerUids, uid] }
                : c
        ));
    }

    function removeAthlete(localId: string, uid: string) {
        setCrews(prev => prev.map(c =>
            c.localId === localId ? { ...c, rowerUids: c.rowerUids.filter(u => u !== uid) } : c
        ));
    }

    function removeCrew(localId: string) {
        setCrews(prev => prev.filter(c => c.localId !== localId));
    }

    async function proceedToCheckout() {
        setPhase({ name: "checkout-loading" });
        try {
            const fns = getFunctions(app);
            const createPI = httpsCallable<
                { eventId: string; crews: { categoryId: string; rowerUids: string[] }[] },
                CoachPaymentIntentResult
            >(fns, "createCoachPaymentIntent");
            const { data } = await createPI({
                eventId,
                crews: crews.map(c => ({ categoryId: c.categoryId, rowerUids: c.rowerUids })),
            });
            setPhase({ name: "paying", clientSecret: data.clientSecret, totalAmountCents: data.totalAmountCents, breakdown: data.breakdown });
        } catch (e: any) {
            setPhase({ name: "error", message: e?.message ?? "Could not initiate payment." });
        }
    }

    const isBuilding = phase.name === "building";

    return (
        <>
            {/* Spinner keyframe — injected once */}
            <style>{`@keyframes ccm-spin{to{transform:rotate(360deg)}}`}</style>

            <div
                style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
                    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 16,
                }}
                onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div style={{
                    width: "100%", maxWidth: 660, maxHeight: "92vh",
                    display: "flex", flexDirection: "column",
                    background: "#1a1a1e", borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
                    overflow: "hidden",
                }}>

                    {/* ── Header ── */}
                    <div style={{
                        padding: "20px 24px 18px",
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                        gap: 12, flexShrink: 0,
                    }}>
                        <div>
                            <div style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                textTransform: "uppercase", color: "rgba(254,185,89,0.6)", marginBottom: 5,
                            }}>
                                {isBuilding ? "Build Your Crews" : phase.name === "paying" ? "Checkout" : ""}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: "#f0eee8", lineHeight: 1.2 }}>
                                {eventName}
                            </div>
                            {isBuilding && crews.length > 0 && (
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 5 }}>
                                    {crews.length} {crews.length === 1 ? "crew" : "crews"} · {fmtUsd(totalFeeCents)} total
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width: 32, height: 32, borderRadius: "50%",
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: "rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.4)", fontSize: 18,
                                cursor: "pointer", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        >×</button>
                    </div>

                    {/* ── Incomplete crew banner (pinned below header, building phase only) ── */}
                    {isBuilding && incompleteCount > 0 && (
                        <div style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "12px 24px",
                            background: "rgba(254,185,89,0.07)",
                            borderBottom: "1px solid rgba(254,185,89,0.15)",
                            flexShrink: 0,
                        }}>
                            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                            <span style={{ fontSize: 12, color: "rgba(254,185,89,0.85)", lineHeight: 1.55 }}>
                                {incompleteCount === 1
                                    ? "1 crew has an incomplete roster."
                                    : `${incompleteCount} crews have incomplete rosters.`}{" "}
                                No refund will be issued for boats that remain incomplete after the event closes.
                            </span>
                        </div>
                    )}

                    {/* ── Body ── */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

                        {/* Building phase */}
                        {isBuilding && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {crews.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "48px 0" }}>
                                        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.12 }}>🚣</div>
                                        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.22)", marginBottom: 20 }}>
                                            All entries removed.
                                        </div>
                                        <button
                                            onClick={onClose}
                                            style={{
                                                padding: "8px 20px", borderRadius: 8,
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                background: "transparent", color: "rgba(255,255,255,0.38)",
                                                fontSize: 13, cursor: "pointer",
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    crews.map((crew, i) => {
                                        // Athletes already assigned in OTHER crews of the same category
                                        const allInCategory = assignedUidsByCategoryId.get(crew.categoryId) ?? new Set<string>();
                                        const assignedElsewhere = new Set<string>();
                                        allInCategory.forEach(uid => {
                                            if (!crew.rowerUids.includes(uid)) assignedElsewhere.add(uid);
                                        });

                                        return (
                                            <CrewCard
                                                key={crew.localId}
                                                crew={crew}
                                                sequenceLabel={sequenceLabels[i]}
                                                athletes={athletesByCategory.get(crew.categoryId) ?? []}
                                                loadingAthletes={loadingCategoryIds.has(crew.categoryId)}
                                                assignedElsewhere={assignedElsewhere}
                                                onAddAthlete={uid => addAthlete(crew.localId, uid)}
                                                onRemoveAthlete={uid => removeAthlete(crew.localId, uid)}
                                                onRemove={() => removeCrew(crew.localId)}
                                                onRequestAthletes={() => loadAthletesForCategory(crew.categoryId, crew.categoryName)}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Checkout loading */}
                        {phase.name === "checkout-loading" && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 16 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: "50%",
                                    border: "3px solid rgba(254,185,89,0.2)",
                                    borderTopColor: "#FEB959",
                                    animation: "ccm-spin 0.8s linear infinite",
                                }} />
                                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Setting up payment…</span>
                            </div>
                        )}

                        {/* Error */}
                        {phase.name === "error" && (
                            <div style={{ textAlign: "center", padding: "48px 0" }}>
                                <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
                                <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 20 }}>{phase.message}</p>
                                <button
                                    onClick={() => setPhase({ name: "building" })}
                                    style={{
                                        padding: "8px 20px", borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        background: "transparent", color: "rgba(255,255,255,0.6)",
                                        fontSize: 13, cursor: "pointer",
                                    }}
                                >
                                    Back
                                </button>
                            </div>
                        )}

                        {/* Stripe payment form */}
                        {phase.name === "paying" && (
                            <Elements
                                stripe={stripePromise}
                                options={{
                                    clientSecret: phase.clientSecret,
                                    appearance: {
                                        theme: "night",
                                        variables: {
                                            colorPrimary: "#FEB959",
                                            colorBackground: "#1a1a1e",
                                            colorText: "#f0eee8",
                                            colorDanger: "#ff4d6d",
                                            borderRadius: "10px",
                                            fontFamily: "system-ui, -apple-system, sans-serif",
                                        },
                                    },
                                }}
                            >
                                <CheckoutForm
                                    totalAmountCents={phase.totalAmountCents}
                                    eventId={eventId}
                                    breakdown={phase.breakdown}
                                />
                            </Elements>
                        )}
                    </div>

                    {/* ── Footer (building phase with crews remaining) ── */}
                    {isBuilding && crews.length > 0 && (
                        <div style={{
                            padding: "16px 24px",
                            borderTop: "1px solid rgba(255,255,255,0.07)",
                            background: "#1a1a1e", flexShrink: 0,
                        }}>
                            <button
                                onClick={proceedToCheckout}
                                style={{
                                    width: "100%", padding: "13px",
                                    background: "#FEB959", color: "#1a1a1e",
                                    border: "none", borderRadius: 12,
                                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                                }}
                            >
                                Proceed to Checkout — {fmtUsd(totalFeeCents)} →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
