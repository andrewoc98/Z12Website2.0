import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import FederationTable from "../components/platform/FederationTable";
import PendingInvitesList from "../components/platform/PendingInvitesList";
import CreateFederationModal from "../components/platform/CreateFederationModal";
import InviteFederationAdminModal from "../components/platform/InviteFederationAdminModal";
import { usePlatformAdminData } from "../hooks/usePlatformAdminData";
import type { Federation } from "../../auth/club";
import "../styles/platformAdmin.css";

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
    if (!toast) return null;
    return (
        <div className={`pa-toast pa-toast--${toast.type}`}>{toast.msg}</div>
    );
}

function useToast() {
    const [toast, setToast] = useState<ToastState>(null);
    function notify(msg: string, type: "success" | "error" = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }
    return { toast, notify };
}

export default function PlatformAdminDashboard() {
    return (
        <AdminGuard role="platformAdmin">
            <PlatformAdminContent />
        </AdminGuard>
    );
}

function PlatformAdminContent() {
    const { federations, invites, loading, error, reload } = usePlatformAdminData();
    const { toast, notify } = useToast();

    const [showCreate, setShowCreate]             = useState(false);
    const [inviteTarget, setInviteTarget]         = useState<Federation | null>(null);

    function onFederationCreated(federationId: string) {
        setShowCreate(false);
        notify("Federation created.");
        reload();
        void federationId;
    }

    function onInviteSent() {
        setInviteTarget(null);
        notify("Invite sent.");
        reload();
    }

    return (
        <>
            <Navbar />

            <main>
                <div className="pa-page">

                    <div className="pa-page-header">
                        <div>
                            <h2 className="pa-page-title" style={{ margin: 0 }}>Platform Admin</h2>
                            <p className="pa-page-subtitle">Manage federations and their administrators</p>
                        </div>
                        <button
                            className="pa-btn pa-btn--primary"
                            onClick={() => setShowCreate(true)}
                        >
                            + New federation
                        </button>
                    </div>

                    {error && (
                        <div className="pa-error">{error}</div>
                    )}

                    {/* Federations */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">
                                Federations
                                {!loading && (
                                    <span className="pa-section__count">
                                        {federations.length}
                                    </span>
                                )}
                            </h3>
                            <button
                                className="pa-btn"
                                onClick={() => setShowCreate(true)}
                                disabled={loading}
                            >
                                + Create
                            </button>
                        </div>

                        <FederationTable
                            federations={federations}
                            loading={loading}
                            onInviteClick={setInviteTarget}
                        />
                    </section>

                    {/* Pending invites */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">
                                Pending Invites
                                {!loading && (
                                    <span className="pa-section__count">
                                        {invites.length}
                                    </span>
                                )}
                            </h3>
                            <button
                                className="pa-btn pa-btn--primary"
                                onClick={() => setInviteTarget(federations[0] ?? null)}
                                disabled={loading || federations.length === 0}
                            >
                                + Invite admin
                            </button>
                        </div>

                        {loading ? (
                            <div className="stack">
                                {[1, 2].map(i => <div key={i} className="pa-skeleton-row" />)}
                            </div>
                        ) : (
                            <PendingInvitesList invites={invites} />
                        )}
                    </section>

                </div>
            </main>

            {/* Modals */}
            {showCreate && (
                <CreateFederationModal
                    onClose={() => setShowCreate(false)}
                    onCreated={onFederationCreated}
                />
            )}

            {inviteTarget && (
                <InviteFederationAdminModal
                    federations={federations}
                    onClose={() => setInviteTarget(null)}
                    onInvited={onInviteSent}
                />
            )}

            <Toast toast={toast} />
        </>
    );
}
