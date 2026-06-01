import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import ClubInfoEditor from "../components/club/ClubInfoEditor";
import MemberList from "../components/club/MemberList";
import InviteMemberModal from "../components/club/InviteMemberModal";
import { useClubAdminData } from "../hooks/useClubAdminData";
import { useAdminClaims } from "../hooks/useAdminClaims";
import "../styles/platformAdmin.css";
import "../styles/clubAdmin.css";

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
