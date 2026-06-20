import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    collection, collectionGroup, query, where, orderBy,
    onSnapshot, getDocs, getDoc, doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStatus = "pending_crew" | "confirmed" | "partially_refunded" | "refunded" | "refund_failed" | "cancelled";

type Booking = {
    id: string;
    eventId: string;
    eventName: string;
    payerUid: string;
    payerRole: "athlete" | "coach";
    // athlete-specific
    categoryId?: string;
    categoryName?: string;
    boatId?: string;
    inviteCode?: string | null;
    crewMemberUids?: string[];
    // coach-specific (one payment covers N boats)
    boatIds?: string[];
    partialRefunds?: Array<{ boatId: string; refundCents: number; refundId?: string; refundedAt: any }>;
    // shared
    stripePaymentIntentId: string;
    eventFeeCents: number;
    processingFeeCents: number;
    totalChargedCents: number;
    status: BookingStatus;
    eventDate?: any;
    createdAt: any;
    refundedAt?: any;
    hostId?: string;
    // reschedule
    rescheduleNotifiedAt?: any;
    rescheduleRefundDeadline?: any;
    rescheduleChangeType?: "start" | "end_shortened" | "end_extended" | "both";
    rescheduleOldStartAt?: any;
    rescheduleNewStartAt?: any;
    rescheduleOldEndAt?: any;
    rescheduleNewEndAt?: any;
};

type BoatDetail = {
    id: string;
    categoryId: string;
    categoryName: string;
    rowerUids: string[];
    boatSize?: number;
    status: string;
    inviteCode?: string | null;
};

type CrewEntry = {
    boatId: string;
    eventId: string;
    eventName: string;
    eventYear?: number;
    categoryName?: string;
    bowNumber?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function tsToDateStr(ts: any): string {
    if (!ts) return "—";
    try {
        const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return "—";
    }
}

function eventYear(ts: any): number | null {
    if (!ts) return null;
    try {
        const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
        return d.getFullYear();
    } catch {
        return null;
    }
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const BOOKING_STATUS_STYLE: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
    pending_crew:       { label: "Crew pending",    color: "#FEB959", bg: "rgba(254,185,89,0.1)",  border: "rgba(254,185,89,0.3)"  },
    confirmed:          { label: "Confirmed",        color: "#48c78e", bg: "rgba(72,199,142,0.1)",  border: "rgba(72,199,142,0.3)"  },
    partially_refunded: { label: "Partial refund",   color: "#FEB959", bg: "rgba(254,185,89,0.08)", border: "rgba(254,185,89,0.25)" },
    refunded:           { label: "Refunded",         color: "#a0a0b0", bg: "rgba(160,160,176,0.1)", border: "rgba(160,160,176,0.25)" },
    refund_failed:      { label: "Refund failed",    color: "#ff6b6b", bg: "rgba(255,107,107,0.1)", border: "rgba(255,107,107,0.3)" },
    cancelled:          { label: "Cancelled",        color: "#a0a0b0", bg: "rgba(160,160,176,0.1)", border: "rgba(160,160,176,0.25)" },
};

const BOAT_STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending_crew: { label: "Awaiting crew", color: "#FEB959", bg: "rgba(254,185,89,0.08)",  border: "rgba(254,185,89,0.25)"  },
    registered:   { label: "Crew set",      color: "#48c78e", bg: "rgba(72,199,142,0.08)",  border: "rgba(72,199,142,0.25)"  },
    in_progress:  { label: "In progress",   color: "#7c8cff", bg: "rgba(124,140,255,0.08)", border: "rgba(124,140,255,0.25)" },
    finished:     { label: "Finished",      color: "#a0a0b0", bg: "rgba(160,160,176,0.08)", border: "rgba(160,160,176,0.2)"  },
    cancelled:    { label: "Cancelled",     color: "#a0a0b0", bg: "rgba(160,160,176,0.05)", border: "rgba(160,160,176,0.15)" },
};

function BookingStatusBadge({ status }: { status: BookingStatus }) {
    const s = BOOKING_STATUS_STYLE[status] ?? BOOKING_STATUS_STYLE.confirmed;
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            borderRadius: 5, padding: "2px 9px", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
        }}>
            {s.label}
        </span>
    );
}

function BoatStatusBadge({ status }: { status: string }) {
    const s = BOAT_STATUS_STYLE[status] ?? BOAT_STATUS_STYLE.pending_crew;
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
        }}>
            {s.label}
        </span>
    );
}

function InviteLinkRow({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try { await navigator.clipboard.writeText(url); } catch { void 0; }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <div style={{
            background: "rgba(254,185,89,0.05)",
            border: "1px solid rgba(254,185,89,0.18)",
            borderRadius: 6,
            padding: "7px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
        }}>
            <span style={{ fontSize: 12, color: "rgba(254,185,89,0.65)", flex: 1, wordBreak: "break-all" }}>
                🔗 {url}
            </span>
            <button
                onClick={copy}
                style={{
                    background: copied ? "rgba(72,199,142,0.12)" : "rgba(254,185,89,0.08)",
                    border: "1px solid " + (copied ? "rgba(72,199,142,0.3)" : "rgba(254,185,89,0.25)"),
                    color: copied ? "#48c78e" : "#FEB959",
                    borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer",
                    fontWeight: 700,
                }}
            >
                {copied ? "Copied!" : "Copy"}
            </button>
        </div>
    );
}

// ─── Reschedule banner ────────────────────────────────────────────────────────

function RescheduleBanner({ b, onRefunded }: { b: Booking; onRefunded: () => void }) {
    const deadline   = b.rescheduleRefundDeadline;
    const deadlineMs = deadline?.toMillis ? deadline.toMillis() : null;
    const expired    = deadlineMs ? Date.now() > deadlineMs : true;
    const [busy, setBusy] = useState(false);
    const [err,  setErr]  = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const didRequest = useRef(false);

    if (!b.rescheduleNotifiedAt || b.status === "refunded") return null;

    const changeLabel =
        b.rescheduleChangeType === "end_extended"  ? "extended its run dates" :
        b.rescheduleChangeType === "end_shortened" ? "shortened its end date" :
        "been rescheduled";

    const deadlineStr = deadlineMs
        ? new Date(deadlineMs).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
        : "";

    async function requestRefund() {
        if (didRequest.current) return;
        didRequest.current = true;
        setBusy(true);
        setErr(null);
        try {
            const fn = httpsCallable<{ bookingId: string }, { success: boolean }>(
                getFunctions(app), "requestRescheduleRefund"
            );
            await fn({ bookingId: b.id });
            setDone(true);
            onRefunded();
        } catch (e: any) {
            setErr(e?.message ?? "Failed to request refund. Please try again.");
            didRequest.current = false;
        } finally {
            setBusy(false);
        }
    }

    if (done) {
        return (
            <div style={{
                background: "rgba(72,199,142,0.08)", border: "1px solid rgba(72,199,142,0.25)",
                borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#48c78e",
            }}>
                Refund requested — your full payment will be returned within 5–10 business days.
            </div>
        );
    }

    return (
        <div style={{
            background: expired ? "rgba(160,160,176,0.07)" : "rgba(254,185,89,0.07)",
            border: `1px solid ${expired ? "rgba(160,160,176,0.2)" : "rgba(254,185,89,0.25)"}`,
            borderRadius: 8, padding: "10px 14px",
        }}>
            <p style={{ margin: "0 0 6px", color: expired ? "rgba(255,255,255,0.45)" : "#FEB959", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {expired ? "Event rescheduled" : "Event rescheduled — refund available"}
            </p>
            <p style={{ margin: "0 0 8px", color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5 }}>
                This event has {changeLabel}.{" "}
                {expired
                    ? `The refund window closed on ${deadlineStr}.`
                    : `You can request a full refund until ${deadlineStr}.`}
            </p>
            {!expired && (
                <button
                    onClick={requestRefund}
                    disabled={busy}
                    style={{
                        background: "rgba(254,185,89,0.12)", border: "1px solid rgba(254,185,89,0.35)",
                        color: "#FEB959", borderRadius: 6, padding: "5px 14px",
                        fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.6 : 1,
                    }}
                >
                    {busy ? "Processing…" : "Request full refund"}
                </button>
            )}
            {err && <p style={{ margin: "6px 0 0", color: "#ff6b6b", fontSize: 12 }}>{err}</p>}
        </div>
    );
}

// ─── Card: athlete booking ────────────────────────────────────────────────────

function AthleteBookingCard({ b, onRefunded }: { b: Booking; onRefunded: () => void }) {
    const inviteUrl = b.inviteCode
        ? `${window.location.origin}/invite/${b.eventId}/${b.inviteCode}`
        : null;

    return (
        <div style={CARD_STYLE}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <Link to={`/events/${b.eventId}`} style={EVENT_LINK_STYLE}>
                        {b.eventName || "—"}
                    </Link>
                    {b.eventDate && (
                        <div style={META_STYLE}>{eventYear(b.eventDate)}</div>
                    )}
                    {b.categoryName && (
                        <div style={{ ...META_STYLE, marginTop: 3 }}>{b.categoryName}</div>
                    )}
                </div>
                <BookingStatusBadge status={b.status} />
            </div>

            {/* Details row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <MetaCol label="Booked" value={tsToDateStr(b.createdAt)} />
                <MetaCol label="Fee" value={fmt(b.totalChargedCents)} accent />
                {(b.crewMemberUids?.length ?? 0) > 1 && (
                    <MetaCol label="Crew" value={`${b.crewMemberUids!.length} rowers`} />
                )}
            </div>

            {/* Invite link (pending crew) */}
            {b.status === "pending_crew" && inviteUrl && <InviteLinkRow url={inviteUrl} />}

            {/* Reschedule banner */}
            <RescheduleBanner b={b} onRefunded={onRefunded} />

            {b.status === "refunded" && b.refundedAt && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Refunded {tsToDateStr(b.refundedAt)}
                </div>
            )}

            <Link to={`/events/${b.eventId}?tab=entries`} style={VIEW_EVENT_LINK_STYLE}>
                View event →
            </Link>
        </div>
    );
}

// ─── Card: coach booking ──────────────────────────────────────────────────────

function CoachBoatRow({ boat, eventId, userNames, refundEntry }: {
    boat: BoatDetail;
    eventId: string;
    userNames: Record<string, string>;
    refundEntry?: { refundCents: number; refundedAt: any } | null;
}) {
    const inviteUrl = boat.inviteCode && boat.status !== "cancelled"
        ? `${window.location.origin}/invite/${eventId}/${boat.inviteCode}`
        : null;

    const hasCrewMembers = boat.rowerUids.length > 0;
    const isCancelled    = boat.status === "cancelled";

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "10px 12px",
            background: isCancelled ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
            borderRadius: 8,
            border: `1px solid ${isCancelled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)"}`,
            opacity: isCancelled ? 0.65 : 1,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                    {boat.categoryName}
                </span>
                <BoatStatusBadge status={boat.status} />
            </div>

            {isCancelled && refundEntry ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#a0a0b0" }}>{fmt(refundEntry.refundCents)} refunded</span>
                    {refundEntry.refundedAt && (
                        <span>· {tsToDateStr(refundEntry.refundedAt)}</span>
                    )}
                </div>
            ) : !isCancelled && hasCrewMembers ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {boat.rowerUids.map(uid => (
                        <div key={uid} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: "rgba(72,199,142,0.5)", flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                {userNames[uid] ?? uid}
                            </span>
                        </div>
                    ))}
                </div>
            ) : !isCancelled && inviteUrl ? (
                <InviteLinkRow url={inviteUrl} />
            ) : null}
        </div>
    );
}

function CoachBookingCard({ b, boats, userNames, boatsLoading, onRefunded }: {
    b: Booking;
    boats: BoatDetail[];
    userNames: Record<string, string>;
    boatsLoading: boolean;
    onRefunded: () => void;
}) {
    const boatCount      = b.boatIds?.length ?? 0;
    const partialRefunds = b.partialRefunds ?? [];
    const totalRefunded  = partialRefunds.reduce((sum, r) => sum + r.refundCents, 0);
    const refundByBoatId = new Map(partialRefunds.map(r => [r.boatId, r]));

    return (
        <div style={CARD_STYLE}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <Link to={`/events/${b.eventId}`} style={EVENT_LINK_STYLE}>
                        {b.eventName || "—"}
                    </Link>
                    {b.eventDate && (
                        <div style={META_STYLE}>{eventYear(b.eventDate)}</div>
                    )}
                    <div style={{ ...META_STYLE, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                            textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 3, padding: "1px 5px",
                        }}>
                            Coach entry
                        </span>
                    </div>
                </div>
                <BookingStatusBadge status={b.status} />
            </div>

            {/* Details row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <MetaCol label="Booked" value={tsToDateStr(b.createdAt)} />
                <MetaCol
                    label={totalRefunded > 0 ? "Net paid" : "Total paid"}
                    value={fmt(b.totalChargedCents - totalRefunded)}
                    accent
                />
                <MetaCol label="Boats" value={String(boatCount)} />
            </div>

            {/* Partial refund summary banner */}
            {partialRefunds.length > 0 && b.status === "partially_refunded" && (
                <div style={{
                    background: "rgba(254,185,89,0.06)",
                    border: "1px solid rgba(254,185,89,0.2)",
                    borderRadius: 8, padding: "8px 12px",
                    fontSize: 12, color: "#FEB959", lineHeight: 1.5,
                }}>
                    {partialRefunds.length === 1 ? "1 boat" : `${partialRefunds.length} boats`} had no crew by closing date —{" "}
                    <strong>{fmt(totalRefunded)}</strong> refunded.
                </div>
            )}

            {/* Boats section */}
            {boatsLoading ? (
                <div style={{ display: "grid", gap: 6 }}>
                    {Array.from({ length: boatCount }).map((_, i) => (
                        <div key={i} style={{
                            height: 52, borderRadius: 8,
                            background: "linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)",
                            backgroundSize: "600px 100%",
                            animation: "sk-shimmer 1.4s infinite linear",
                        }} />
                    ))}
                </div>
            ) : boats.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
                        marginBottom: 2,
                    }}>
                        Boats
                    </div>
                    {boats.map(boat => (
                        <CoachBoatRow
                            key={boat.id}
                            boat={boat}
                            eventId={b.eventId}
                            userNames={userNames}
                            refundEntry={refundByBoatId.get(boat.id) ?? null}
                        />
                    ))}
                </div>
            ) : null}

            {/* Reschedule banner */}
            <RescheduleBanner b={b} onRefunded={onRefunded} />

            {b.status === "refunded" && b.refundedAt && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Refunded {tsToDateStr(b.refundedAt)}
                </div>
            )}

            <Link to={`/events/${b.eventId}?tab=entries`} style={VIEW_EVENT_LINK_STYLE}>
                View event →
            </Link>
        </div>
    );
}

// ─── Shared style constants ───────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
};

const EVENT_LINK_STYLE: React.CSSProperties = {
    color: "#f0eee8", fontWeight: 600, fontSize: 15, textDecoration: "none",
};

const META_STYLE: React.CSSProperties = {
    color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2,
};

const VIEW_EVENT_LINK_STYLE: React.CSSProperties = {
    fontSize: 12, color: "#FEB959", textDecoration: "none", alignSelf: "flex-start",
};

function MetaCol({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
            </div>
            <div style={{ color: accent ? "#FEB959" : "#f0eee8", fontWeight: accent ? 700 : 400, fontSize: 13, marginTop: 2 }}>
                {value}
            </div>
        </div>
    );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
    return (
        <h2 style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
            marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
        }}>
            {label}
            <span style={{
                background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)",
                borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600,
                letterSpacing: 0,
            }}>
                {count}
            </span>
        </h2>
    );
}

function SkeletonCard({ height = 110 }: { height?: number }) {
    return (
        <div style={{
            height, borderRadius: 12,
            background: "linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)",
            backgroundSize: "600px 100%",
            animation: "sk-shimmer 1.4s infinite linear",
        }} />
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyBookingsPage() {
    const { user } = useAuth() as any;

    const [bookings,       setBookings]       = useState<Booking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [coachBoatsMap,  setCoachBoatsMap]  = useState<Record<string, BoatDetail[]>>({});
    const [boatsLoading,   setBoatsLoading]   = useState(false);
    const [userNames,      setUserNames]      = useState<Record<string, string>>({});
    const [crewEntries,    setCrewEntries]    = useState<CrewEntry[]>([]);
    const [crewLoading,    setCrewLoading]    = useState(true);

    // ── Bookings listener ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) { setBookingsLoading(false); return; }

        const q = query(
            collection(db, "bookings"),
            where("payerUid", "==", user.uid),
            orderBy("createdAt", "desc"),
        );

        const unsub = onSnapshot(q, snap => {
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
            setBookingsLoading(false);
        }, () => setBookingsLoading(false));

        return unsub;
    }, [user]);

    // ── Fetch boat details + crew names for coach bookings ─────────────────────
    useEffect(() => {
        const coachBookings = bookings.filter(
            b => b.payerRole === "coach" && (b.boatIds?.length ?? 0) > 0
        );
        if (coachBookings.length === 0) return;

        setBoatsLoading(true);

        async function loadCoachBoats() {
            const newBoatsMap: Record<string, BoatDetail[]> = {};
            const rowerUidSet = new Set<string>();

            await Promise.all(coachBookings.map(async (booking) => {
                const boats = await Promise.all(
                    (booking.boatIds ?? []).map(async boatId => {
                        const snap = await getDoc(
                            doc(db, "events", booking.eventId, "boats", boatId)
                        );
                        if (!snap.exists()) return null;
                        const data = snap.data() as BoatDetail;
                        data.rowerUids?.forEach(uid => rowerUidSet.add(uid));
                        return { ...data, id: snap.id } as BoatDetail;
                    })
                );
                newBoatsMap[booking.id] = boats.filter(Boolean) as BoatDetail[];
            }));

            setCoachBoatsMap(newBoatsMap);

            // Fetch display names for all rowers across all coach boats
            if (rowerUidSet.size > 0) {
                const names: Record<string, string> = {};
                await Promise.all([...rowerUidSet].map(async uid => {
                    try {
                        const snap = await getDoc(doc(db, "users", uid));
                        names[uid] = snap.data()?.displayName ?? snap.data()?.fullName ?? uid;
                    } catch {
                        names[uid] = uid;
                    }
                }));
                setUserNames(prev => ({ ...prev, ...names }));
            }

            setBoatsLoading(false);
        }

        void loadCoachBoats();
    }, [bookings]);

    // ── Crew entries (boats this user rows in but didn't pay for) ──────────────
    useEffect(() => {
        if (!user) { setCrewLoading(false); return; }

        async function loadCrewEntries() {
            try {
                const q = query(
                    collectionGroup(db, "boats"),
                    where("rowerUids", "array-contains", user.uid)
                );
                const snap = await getDocs(q);
                const boats = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

                const uniqueEventIds = [...new Set(
                    boats.map((b: any) => b.eventId as string).filter(Boolean)
                )];
                const nameMap: Record<string, string> = {};
                const yearMap: Record<string, number> = {};
                await Promise.all(uniqueEventIds.map(async eid => {
                    const eSnap = await getDoc(doc(db, "events", eid));
                    const data = eSnap.data();
                    nameMap[eid] = data?.name ?? "Unknown Event";
                    const startAt = data?.startAt;
                    if (startAt?.toDate) yearMap[eid] = startAt.toDate().getFullYear();
                }));

                setCrewEntries(boats.map((b: any) => ({
                    boatId:       b.id,
                    eventId:      b.eventId ?? "",
                    eventName:    nameMap[b.eventId] ?? "Unknown Event",
                    eventYear:    yearMap[b.eventId],
                    categoryName: b.categoryName,
                    bowNumber:    b.bowNumber,
                })));
            } catch {
                // non-critical
            } finally {
                setCrewLoading(false);
            }
        }

        void loadCrewEntries();
    }, [user?.uid]);

    // ── Derived state ──────────────────────────────────────────────────────────
    const PAST_STATUSES = new Set<BookingStatus>(["refunded", "cancelled"]);
    const active = bookings.filter(b => !PAST_STATUSES.has(b.status));
    const past   = bookings.filter(b => PAST_STATUSES.has(b.status));
    const paidBoatIds = new Set(
        bookings.flatMap(b =>
            b.payerRole === "coach"
                ? (b.boatIds ?? [])
                : b.boatId ? [b.boatId] : []
        )
    );
    const crewOnly = crewEntries.filter(e => !paidBoatIds.has(e.boatId));

    function markRefunded(id: string) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "refunded" } : b));
    }

    function renderBooking(b: Booking) {
        if (b.payerRole === "coach") {
            return (
                <CoachBookingCard
                    key={b.id}
                    b={b}
                    boats={coachBoatsMap[b.id] ?? []}
                    userNames={userNames}
                    boatsLoading={boatsLoading && !(b.id in coachBoatsMap)}
                    onRefunded={() => markRefunded(b.id)}
                />
            );
        }
        return (
            <AthleteBookingCard
                key={b.id}
                b={b}
                onRefunded={() => markRefunded(b.id)}
            />
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <Navbar />
            <main>
                <div className="page">
                    <h1>My Bookings</h1>
                    <p className="muted">Events you've paid to enter.</p>

                    {bookingsLoading && (
                        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
                            <SkeletonCard height={120} />
                            <SkeletonCard height={120} />
                            <SkeletonCard height={90} />
                        </div>
                    )}

                    {!bookingsLoading && !crewLoading && bookings.length === 0 && crewOnly.length === 0 && (
                        <div style={{ marginTop: 48, textAlign: "center" }}>
                            <p className="muted" style={{ marginBottom: 16 }}>No bookings or entries yet.</p>
                            <Link to="/events">
                                <button className="btn-primary">Browse events</button>
                            </Link>
                        </div>
                    )}

                    {!bookingsLoading && active.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <SectionHeading label="Active" count={active.length} />
                            <div style={{ display: "grid", gap: 10 }}>
                                {active.map(renderBooking)}
                            </div>
                        </section>
                    )}

                    {!bookingsLoading && past.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <SectionHeading label="Past & Refunded" count={past.length} />
                            <div style={{ display: "grid", gap: 10 }}>
                                {past.map(renderBooking)}
                            </div>
                        </section>
                    )}

                    {/* Crew entries — boats this user rows in but didn't pay for */}
                    {crewLoading && (
                        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
                            <SkeletonCard height={80} />
                            <SkeletonCard height={80} />
                        </div>
                    )}

                    {!crewLoading && crewOnly.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <SectionHeading label="Your Entries" count={crewOnly.length} />
                            <div style={{ display: "grid", gap: 10 }}>
                                {crewOnly.map(e => (
                                    <div key={e.boatId} style={CARD_STYLE}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                            <div>
                                                <Link to={`/events/${e.eventId}`} style={EVENT_LINK_STYLE}>
                                                    {e.eventName}
                                                </Link>
                                                {e.eventYear && <div style={META_STYLE}>{e.eventYear}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                            {e.categoryName && (
                                                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                                                    {e.categoryName}
                                                </div>
                                            )}
                                            {e.bowNumber != null && (
                                                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                                                    Bow #{e.bowNumber}
                                                </div>
                                            )}
                                        </div>
                                        <Link to={`/events/${e.eventId}?tab=entries`} style={VIEW_EVENT_LINK_STYLE}>
                                            View event →
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
