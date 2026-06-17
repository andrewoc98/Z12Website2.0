import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import ClubInfoEditor from "../components/club/ClubInfoEditor";
import MemberList from "../components/club/MemberList";
import AdminList from "../components/club/AdminList";
import InviteMemberModal from "../components/club/InviteMemberModal";
import InviteAdminModal from "../components/club/InviteAdminModal";
import { useClubAdminData } from "../hooks/useClubAdminData";
import { useAdminClaims } from "../hooks/useAdminClaims";
import { useAuth } from "../../../providers/AuthProvider";
import { createConnectAccount } from "../services/stripeService";

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
    if (!toast) return null;
    return <div className={`pa-toast pa-toast--${toast.type}`}>{toast.msg}</div>;
}

function useToast() {
    const [toast, setToast] = useState<ToastState>(null);
    function notify(msg: string, type: "success" | "error" = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }
    return { toast, notify };
}

export default function ClubAdminDashboard() {
    return (
        <AdminGuard role="clubAdmin">
            <ClubAdminContent />
        </AdminGuard>
    );
}

type Payment = {
    id:                    string;
    eventId:               string;
    eventName?:            string;
    payerId:               string;
    hostId:                string | null;
    stripePaymentIntentId: string;
    eventFeeCents:         number;
    processingFeeCents:    number;
    totalChargedCents:     number;
    status:                "held" | "succeeded" | "refunded" | "disputed";
    createdAt:             any;
};

const PAYMENT_STATUS: Record<Payment["status"], { label: string; color: string }> = {
    held:      { label: "Held",     color: "#FEB959" },
    succeeded: { label: "Paid out", color: "#48c78e" },
    refunded:  { label: "Refunded", color: "#a0a0b0" },
    disputed:  { label: "Disputed", color: "#ff6b6b" },
};

function fmtCents(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(ts: any): string {
    if (!ts) return "—";
    try {
        const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch { return "—"; }
}

function PaymentsSection() {
    const { user } = useAuth() as any;
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading,  setLoading]  = useState(true);

    useEffect(() => {
        if (!user?.uid) { setLoading(false); return; }

        const q = query(
            collection(db, "payments"),
            where("hostId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
            setLoading(false);
        }, () => setLoading(false));

        return unsub;
    }, [user?.uid]);

    const totalCollected = payments
        .filter(p => p.status !== "refunded")
        .reduce((sum, p) => sum + p.totalChargedCents, 0);

    return (
        <section className="card pa-section" style={{ borderColor: "rgba(254,185,89,0.15)" }}>
            <div className="pa-section__header">
                <h3 className="pa-section__title">Entry Payments</h3>
                {!loading && payments.length > 0 && (
                    <span style={{ color: "#FEB959", fontWeight: 700, fontSize: 14 }}>
                        {fmtCents(totalCollected)} collected
                    </span>
                )}
            </div>

            {loading && (
                <div style={{ display: "grid", gap: 8 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            height: 44, borderRadius: 8,
                            background: "linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)",
                            backgroundSize: "600px 100%",
                            animation: "sk-shimmer 1.4s infinite linear",
                        }} />
                    ))}
                </div>
            )}

            {!loading && payments.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>No payments received yet.</p>
            )}

            {!loading && payments.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>
                                <th style={{ textAlign: "left", padding: "6px 8px 10px 0", fontWeight: 600 }}>Event</th>
                                <th style={{ textAlign: "right", padding: "6px 8px 10px", fontWeight: 600 }}>Amount</th>
                                <th style={{ textAlign: "right", padding: "6px 8px 10px", fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: "right", padding: "6px 0 10px 8px", fontWeight: 600 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => {
                                const s = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.held;
                                return (
                                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                                        <td style={{ padding: "10px 8px 10px 0" }}>
                                            <Link
                                                to={`/events/${p.eventId}`}
                                                style={{ color: "#f0eee8", textDecoration: "none" }}
                                            >
                                                {p.eventName || p.eventId}
                                            </Link>
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#FEB959", fontWeight: 600 }}>
                                            {fmtCents(p.totalChargedCents)}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.45)" }}>
                                            {fmtDate(p.createdAt)}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 0 10px 8px", color: s.color, fontWeight: 700 }}>
                                            {s.label}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function StripeSection({ notify }: { notify: (msg: string, type?: "success" | "error") => void }) {
    const { profile } = useAuth() as any;
    const [connecting, setConnecting] = useState(false);

    const onboarded: boolean = profile?.roles?.clubAdmin?.stripeOnboarded ?? false;

    async function handleConnect() {
        setConnecting(true);
        try {
            const { url } = await createConnectAccount({});
            window.location.href = url;
        } catch (e: any) {
            notify(e?.message ?? "Could not initiate Stripe setup.", "error");
            setConnecting(false);
        }
    }

    return (
        <section className="card pa-section" style={{ borderColor: "rgba(254,185,89,0.2)" }}>
            <div className="pa-section__header">
                <h3 className="pa-section__title">Payments</h3>
                {onboarded && (
                    <span style={{
                        background: "rgba(72,199,142,0.12)",
                        color: "#48c78e",
                        border: "1px solid rgba(72,199,142,0.3)",
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                    }}>
                        Connected
                    </span>
                )}
            </div>

            {onboarded ? (
                <>
                    <p className="muted" style={{ marginBottom: 16 }}>
                        Your Stripe account is connected. Entry fees are paid out to your Stripe balance
                        automatically when athletes register. Manage payouts in your Stripe Express Dashboard.
                    </p>
                    <button
                        className="pa-btn pa-btn--secondary"
                        onClick={handleConnect}
                        disabled={connecting}
                    >
                        {connecting ? "Opening…" : "Open Stripe Dashboard"}
                    </button>
                </>
            ) : (
                <>
                    <p className="muted" style={{ marginBottom: 16 }}>
                        Connect a Stripe account to charge entry fees for your events. Funds are transferred
                        directly to your balance after each registration — the platform retains a 10% fee.
                    </p>
                    <div style={{
                        background: "rgba(254,185,89,0.06)",
                        border: "1px solid rgba(254,185,89,0.18)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 16,
                        fontSize: 13,
                        color: "rgba(254,185,89,0.85)",
                    }}>
                        Events with entry fees require Stripe to be connected before athletes can pay.
                    </div>
                    <button
                        className="pa-btn pa-btn--primary"
                        onClick={handleConnect}
                        disabled={connecting}
                    >
                        {connecting ? "Opening Stripe…" : "Connect Stripe"}
                    </button>
                </>
            )}
        </section>
    );
}

function ClubAdminContent() {
    const { clubId }                       = useAdminClaims();
    const { club, loading, error, reload } = useClubAdminData(clubId);
    const { toast, notify }                = useToast();
    const { user, profile }                 = useAuth() as any;
    const [showInviteMember, setShowInviteMember] = useState(false);
    const [showInviteAdmin,  setShowInviteAdmin]  = useState(false);

    function onMemberAdded(msg: string) {
        setShowInviteMember(false);
        notify(msg);
    }

    function onAdminInvited(msg: string) {
        setShowInviteAdmin(false);
        notify(msg);
        reload();
    }

    return (
        <>
            <Navbar />

            <main>
                <div className="pa-page">

                    <div className="pa-page-header">
                        <div>
                            <h2 className="pa-page-title" style={{ margin: 0 }}>
                                {loading ? "Loading…" : (club?.name ?? "Club Admin")}
                            </h2>
                            <p className="pa-page-subtitle">
                                {club?.location?.city
                                    ? `${club.location.city}${club.location.country ? `, ${club.location.country}` : ""}`
                                    : "Manage your club info and members"}
                            </p>
                        </div>
                        {club && (
                            <span className={`pa-status pa-status--${club.status === "pending_approval" ? "pending" : club.status}`}>
                                {club.status === "pending_approval" ? "pending" : club.status}
                            </span>
                        )}
                    </div>

                    {error && <div className="pa-error">{error}</div>}

                    {/* Club info editor */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">Club Info</h3>
                        </div>

                        {loading ? (
                            <div className="stack">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="pa-skeleton-row" style={{ height: 52, borderRadius: 12 }} />
                                ))}
                            </div>
                        ) : club ? (
                            <ClubInfoEditor
                                club={club}
                                onSaved={msg => { notify(msg); reload(); }}
                            />
                        ) : null}
                    </section>

                    {/* Stripe payments */}
                    <StripeSection notify={notify} />

                    {/* Payment history — only shown once Stripe is connected */}
                    {profile?.roles?.clubAdmin?.stripeOnboarded && <PaymentsSection />}

                    {/* Admins section — visible to all club admins; actions gated by canManageAdmins */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">Admins</h3>
                            <button
                                className="pa-btn pa-btn--primary"
                                onClick={() => setShowInviteAdmin(true)}
                                disabled={loading || !club}
                            >
                                + Invite admin
                            </button>
                        </div>

                        {clubId && club && user && (
                            <AdminList
                                clubId={clubId}
                                adminUids={club.adminUids ?? []}
                                currentUid={user.uid}
                                onAction={(msg: string, type?: "success" | "error") => { notify(msg, type); reload(); }}
                            />
                        )}
                    </section>

                    {/* Member list */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">Members</h3>
                            <button
                                className="pa-btn pa-btn--primary"
                                onClick={() => setShowInviteMember(true)}
                                disabled={loading || !club}
                            >
                                + Invite member
                            </button>
                        </div>

                        {clubId && (
                            <MemberList
                                clubId={clubId}
                                onAction={(msg, type) => notify(msg, type)}
                            />
                        )}
                    </section>

                </div>
            </main>

            {showInviteMember && (
                <InviteMemberModal
                    onClose={() => setShowInviteMember(false)}
                    onInvited={onMemberAdded}
                />
            )}

            {showInviteAdmin && club && (
                <InviteAdminModal
                    clubName={club.name}
                    onClose={() => setShowInviteAdmin(false)}
                    onInvited={onAdminInvited}
                />
            )}

            <Toast toast={toast} />
        </>
    );
}
