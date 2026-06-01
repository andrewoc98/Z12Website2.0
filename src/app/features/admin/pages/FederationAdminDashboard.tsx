import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import ClubOverviewCard from "../components/federation/ClubOverviewCard";
import ClubRequestsPanel from "../components/federation/ClubRequestsPanel";
import AthleteSelectionGrid from "../components/federation/AthleteSelectionGrid";
import { useFederationAdminData } from "../hooks/useFederationAdminData";
import { useAdminClaims } from "../hooks/useAdminClaims";
import { updateFederationSettings } from "../services/federationService";
import "../styles/platformAdmin.css";
import "../styles/federationAdmin.css";

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

export default function FederationAdminDashboard() {
    return (
        <AdminGuard role="federationAdmin">
            <FederationAdminContent />
        </AdminGuard>
    );
}

function FederationAdminContent() {
    const { federationId } = useAdminClaims();
    const { federation, clubs, pendingRequests, loading, error, reload } =
        useFederationAdminData(federationId);
    const { toast, notify } = useToast();
    const [savingToggle, setSavingToggle] = useState(false);

    async function handleAutoApproveToggle(enabled: boolean) {
        setSavingToggle(true);
        try {
            await updateFederationSettings({ autoApproveClubRequests: enabled });
            reload();
        } catch (err: any) {
            notify(err?.message ?? "Failed to update setting.", "error");
        } finally {
            setSavingToggle(false);
        }
    }

    const clubIds = clubs.map(c => c.id);

    return (
        <>
            <Navbar />

            <main data-tour="federation-dashboard">
                <div className="pa-page">

                    <div className="pa-page-header">
                        <div>
                            <h2 className="pa-page-title" style={{ margin: 0 }}>
                                {loading ? "Loading…" : (federation?.name ?? "Federation Admin")}
                            </h2>
                            <p className="pa-page-subtitle">
                                Manage clubs, review creation requests, and browse selection profiles
                            </p>
                        </div>
                    </div>

                    {error && <div className="pa-error">{error}</div>}

                    {/* Clubs overview */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">
                                Clubs
                                {!loading && (
                                    <span className="pa-section__count">{clubs.length}</span>
                                )}
                            </h3>
                        </div>

                        {loading ? (
                            <div className="fa-club-grid">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="pa-skeleton-row" style={{ height: 110, borderRadius: "var(--radius-sm)" }} />
                                ))}
                            </div>
                        ) : clubs.length === 0 ? (
                            <div className="pa-empty">
                                <div className="pa-empty__icon">🏠</div>
                                <p className="pa-empty__text">
                                    No clubs in your federation yet. Approve a club creation request to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="fa-club-grid">
                                {clubs.map(club => (
                                    <ClubOverviewCard key={club.id} club={club} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Pending club creation requests */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">
                                Club Requests
                                {!loading && pendingRequests.length > 0 && (
                                    <span className="pa-section__count"
                                        style={{ color: "var(--brand-warm)" }}>
                                        {pendingRequests.length} pending
                                    </span>
                                )}
                            </h3>

                            {!loading && federation && (
                                <label className="fa-toggle-label">
                                    <span className="fa-toggle-text">Auto-approve</span>
                                    <span className="fa-toggle">
                                        <input
                                            type="checkbox"
                                            className="fa-toggle__input"
                                            checked={federation.autoApproveClubRequests ?? false}
                                            disabled={savingToggle}
                                            onChange={e => handleAutoApproveToggle(e.target.checked)}
                                        />
                                        <span className="fa-toggle__track" />
                                    </span>
                                </label>
                            )}
                        </div>

                        {loading ? (
                            <div className="stack">
                                {[1, 2].map(i => <div key={i} className="pa-skeleton-row" />)}
                            </div>
                        ) : (
                            <ClubRequestsPanel
                                requests={pendingRequests}
                                onAction={notify}
                                onReload={reload}
                            />
                        )}
                    </section>

                    {/* National selection */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">National Selection</h3>
                        </div>
                        <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                            Athletes who have opted in to national selection visibility.
                            Click any profile for full details.
                        </p>

                        {!loading && clubIds.length > 0 ? (
                            <AthleteSelectionGrid clubIds={clubIds} federationId={federationId ?? ""} />
                        ) : loading ? (
                            <div className="fa-athlete-grid">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="pa-skeleton-row" style={{ height: 120, borderRadius: "var(--radius-sm)" }} />
                                ))}
                            </div>
                        ) : (
                            <div className="pa-empty">
                                <div className="pa-empty__icon">🏅</div>
                                <p className="pa-empty__text">
                                    Add clubs to your federation to see athlete selection profiles.
                                </p>
                            </div>
                        )}
                    </section>

                </div>
            </main>

            <Toast toast={toast} />
        </>
    );
}
