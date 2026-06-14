import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import ClubInfoEditor from "../components/club/ClubInfoEditor";
import MemberList from "../components/club/MemberList";
import InviteMemberModal from "../components/club/InviteMemberModal";
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
    const { clubId }                           = useAdminClaims();
    const { club, loading, error, reload }     = useClubAdminData(clubId);
    const { toast, notify }                    = useToast();
    const [showInvite, setShowInvite]          = useState(false);

    function onMemberAdded(msg: string) {
        setShowInvite(false);
        notify(msg);
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

                    {/* Member list */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">Members</h3>
                            <button
                                className="pa-btn pa-btn--primary"
                                onClick={() => setShowInvite(true)}
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

            {showInvite && (
                <InviteMemberModal
                    onClose={() => setShowInvite(false)}
                    onInvited={onMemberAdded}
                />
            )}

            <Toast toast={toast} />
        </>
    );
}
