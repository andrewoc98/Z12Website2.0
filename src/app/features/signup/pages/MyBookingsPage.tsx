import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    collection, collectionGroup, query, where, orderBy, onSnapshot,
    getDocs, getDoc, doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer";

type BookingStatus = "pending_crew" | "confirmed" | "refunded" | "refund_failed" | "cancelled";

type Booking = {
    id:                         string;
    eventId:                    string;
    eventName:                  string;
    categoryId:                 string;
    categoryName?:              string;
    payerUid:                   string;
    stripePaymentIntentId:      string;
    eventFeeCents:              number;
    processingFeeCents:         number;
    totalChargedCents:          number;
    status:                     BookingStatus;
    boatId:                     string;
    inviteCode:                 string | null;
    crewMemberUids:             string[];
    createdAt:                  any;
    refundedAt?:                any;
    refundId?:                  string;
    hostId?:                    string;
    // Reschedule fields
    rescheduleNotifiedAt?:      any;
    rescheduleRefundDeadline?:  any;
    rescheduleChangeType?:      "start" | "end_shortened" | "end_extended" | "both";
    rescheduleOldStartAt?:      any;
    rescheduleOldEndAt?:        any;
    rescheduleNewStartAt?:      any;
    rescheduleNewEndAt?:        any;
};

type CrewEntry = {
    boatId:        string;
    eventId:       string;
    eventName:     string;
    categoryName?: string;
    bowNumber?:    number;
};

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

const STATUS_STYLE: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
    pending_crew:  { label: "Crew pending",  color: "#FEB959", bg: "rgba(254,185,89,0.1)",  border: "rgba(254,185,89,0.3)" },
    confirmed:     { label: "Confirmed",     color: "#48c78e", bg: "rgba(72,199,142,0.1)",  border: "rgba(72,199,142,0.3)" },
    refunded:      { label: "Refunded",      color: "#a0a0b0", bg: "rgba(160,160,176,0.1)", border: "rgba(160,160,176,0.25)" },
    refund_failed: { label: "Refund failed", color: "#ff6b6b", bg: "rgba(255,107,107,0.1)", border: "rgba(255,107,107,0.3)" },
    cancelled:     { label: "Cancelled",     color: "#a0a0b0", bg: "rgba(160,160,176,0.1)", border: "rgba(160,160,176,0.25)" },
};

function StatusBadge({ status }: { status: BookingStatus }) {
    const s = STATUS_STYLE[status] ?? STATUS_STYLE.confirmed;
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            borderRadius: 5, padding: "2px 9px", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
            {s.label}
        </span>
    );
}

function RescheduleBanner({ b, onRefunded }: { b: Booking; onRefunded: () => void }) {
    const deadline    = b.rescheduleRefundDeadline;
    const deadlineMs  = deadline?.toMillis ? deadline.toMillis() : null;
    const expired     = deadlineMs ? Date.now() > deadlineMs : true;
    const [busy, setBusy]   = useState(false);
    const [err,  setErr]    = useState<string | null>(null);
    const [done, setDone]   = useState(false);
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

function BookingCard({ b, onRefunded }: { b: Booking; onRefunded: () => void }) {
    const inviteUrl = b.inviteCode
        ? `${window.location.origin}/invite/${b.eventId}/${b.inviteCode}`
        : null;

    return (
        <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <Link
                        to={`/events/${b.eventId}`}
                        style={{ color: "#f0eee8", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
                    >
                        {b.eventName || "—"}
                    </Link>
                    {b.categoryName && (
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 3 }}>
                            {b.categoryName}
                        </div>
                    )}
                </div>
                <StatusBadge status={b.status} />
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Booked</div>
                    <div style={{ color: "#f0eee8", fontSize: 13, marginTop: 2 }}>{tsToDateStr(b.createdAt)}</div>
                </div>
                <div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Entry fee</div>
                    <div style={{ color: "#FEB959", fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmt(b.totalChargedCents)}</div>
                </div>
                {b.crewMemberUids?.length > 0 && (
                    <div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Crew</div>
                        <div style={{ color: "#f0eee8", fontSize: 13, marginTop: 2 }}>
                            {b.crewMemberUids.length} rower{b.crewMemberUids.length !== 1 ? "s" : ""}
                        </div>
                    </div>
                )}
            </div>

            {b.status === "pending_crew" && inviteUrl && (
                <InviteLinkRow url={inviteUrl} />
            )}

            <RescheduleBanner b={b} onRefunded={onRefunded} />

            {b.status === "refunded" && b.refundedAt && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    Refunded on {tsToDateStr(b.refundedAt)}
                </div>
            )}

            <Link
                to={`/events/${b.eventId}?tab=entries`}
                style={{ fontSize: 12, color: "#FEB959", textDecoration: "none", alignSelf: "flex-start" }}
            >
                View event →
            </Link>
        </div>
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
            background: "rgba(254,185,89,0.06)",
            border: "1px solid rgba(254,185,89,0.2)",
            borderRadius: 7,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
        }}>
            <span style={{ fontSize: 12, color: "rgba(254,185,89,0.75)", flex: 1, wordBreak: "break-all" }}>
                🔗 {url}
            </span>
            <button
                onClick={copy}
                style={{
                    background: copied ? "rgba(72,199,142,0.15)" : "rgba(254,185,89,0.1)",
                    border: "1px solid " + (copied ? "rgba(72,199,142,0.3)" : "rgba(254,185,89,0.3)"),
                    color: copied ? "#48c78e" : "#FEB959",
                    borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer",
                    fontWeight: 600,
                }}
            >
                {copied ? "Copied!" : "Copy invite"}
            </button>
        </div>
    );
}

export default function MyBookingsPage() {
    const { user } = useAuth() as any;
    const [bookings,     setBookings]     = useState<Booking[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [crewEntries,  setCrewEntries]  = useState<CrewEntry[]>([]);
    const [crewLoading,  setCrewLoading]  = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        const q = query(
            collection(db, "bookings"),
            where("payerUid", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
            setLoading(false);
        }, () => setLoading(false));

        return unsub;
    }, [user]);

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
                await Promise.all(uniqueEventIds.map(async (eid) => {
                    const eSnap = await getDoc(doc(db, "events", eid));
                    nameMap[eid] = eSnap.data()?.name ?? "Unknown Event";
                }));

                setCrewEntries(boats.map((b: any) => ({
                    boatId:       b.id,
                    eventId:      b.eventId ?? "",
                    eventName:    nameMap[b.eventId] ?? "Unknown Event",
                    categoryName: b.categoryName,
                    bowNumber:    b.bowNumber,
                })));
            } catch (e) {
                console.error("Failed to load crew entries:", e);
            } finally {
                setCrewLoading(false);
            }
        }

        void loadCrewEntries();
    }, [user?.uid]);

    const upcoming  = bookings.filter(b => b.status !== "refunded" && b.status !== "cancelled");
    const past      = bookings.filter(b => b.status === "refunded" || b.status === "cancelled");

    // Exclude boats the user already has a paid booking for
    const paidBoatIds = new Set(bookings.map(b => b.boatId).filter(Boolean));
    const crewOnly = crewEntries.filter(e => !paidBoatIds.has(e.boatId));

    return (
        <>
            <Navbar />
            <main>
                <div className="page">
                    <h1>My Bookings</h1>
                    <p className="muted">Events you've paid to enter.</p>

                    {loading && (
                        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{
                                    height: 100, borderRadius: 12,
                                    background: "linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)",
                                    backgroundSize: "600px 100%",
                                    animation: "sk-shimmer 1.4s infinite linear",
                                }} />
                            ))}
                        </div>
                    )}

                    {!loading && !crewLoading && bookings.length === 0 && crewOnly.length === 0 && (
                        <div style={{ marginTop: 40, textAlign: "center" }}>
                            <p className="muted" style={{ marginBottom: 16 }}>No bookings or entries yet.</p>
                            <Link to="/events">
                                <button className="btn-primary">Browse events</button>
                            </Link>
                        </div>
                    )}

                    {!loading && upcoming.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                                Active — {upcoming.length}
                            </h2>
                            <div style={{ display: "grid", gap: 10 }}>
                                {upcoming.map(b => <BookingCard key={b.id} b={b} onRefunded={() => setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: "refunded" } : x))} />)}
                            </div>
                        </section>
                    )}

                    {!loading && past.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                                Past & Refunded — {past.length}
                            </h2>
                            <div style={{ display: "grid", gap: 10 }}>
                                {past.map(b => <BookingCard key={b.id} b={b} onRefunded={() => {}} />)}
                            </div>
                        </section>
                    )}

                    {crewLoading && (
                        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
                            {[1, 2].map(i => (
                                <div key={i} style={{
                                    height: 80, borderRadius: 12,
                                    background: "linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)",
                                    backgroundSize: "600px 100%",
                                    animation: "sk-shimmer 1.4s infinite linear",
                                }} />
                            ))}
                        </div>
                    )}

                    {!crewLoading && crewOnly.length > 0 && (
                        <section style={{ marginTop: 28 }}>
                            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                                Your Entries — {crewOnly.length}
                            </h2>
                            <div style={{ display: "grid", gap: 10 }}>
                                {crewOnly.map(e => (
                                    <div key={e.boatId} style={{
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: 12,
                                        padding: "14px 18px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}>
                                        <Link
                                            to={`/events/${e.eventId}`}
                                            style={{ color: "#f0eee8", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
                                        >
                                            {e.eventName}
                                        </Link>
                                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                            {e.categoryName && (
                                                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                                                    {e.categoryName}
                                                </div>
                                            )}
                                            {e.bowNumber != null && (
                                                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                                                    Bow #{e.bowNumber}
                                                </div>
                                            )}
                                        </div>
                                        <Link
                                            to={`/events/${e.eventId}?tab=entries`}
                                            style={{ fontSize: 12, color: "#FEB959", textDecoration: "none", alignSelf: "flex-start" }}
                                        >
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
