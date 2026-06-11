import { useState, useMemo } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import AdminGuard from "../components/AdminGuard";
import ClubOverviewCard from "../components/federation/ClubOverviewCard";
import ClubDetailModal from "../components/federation/ClubDetailModal";
import ClubRequestsPanel from "../components/federation/ClubRequestsPanel";
import AthleteSelectionGrid from "../components/federation/AthleteSelectionGrid";
import Pagination from "../../../shared/components/Pagination/Pagination";
import { useFederationAdminData } from "../hooks/useFederationAdminData";
import { useAdminClaims } from "../hooks/useAdminClaims";
import { updateFederationSettings } from "../services/federationService";

import type { Club } from "../../auth/club";

type ToastState = { msg: string; type: "success" | "error" } | null;
type ClubStatusFilter = "all" | "active" | "suspended" | "pending_approval";

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
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);

    // ── Club search + filter ──────────────────────────────────────────────────
    const [clubPage,   setClubPage]   = useState(1);
    const [clubSearch, setClubSearch] = useState("");
    const [clubStatus, setClubStatus] = useState<ClubStatusFilter>("all");
    const CLUBS_PER_PAGE = 9;

    const filteredClubs = useMemo(() => {
        let list = clubs;
        if (clubStatus !== "all") list = list.filter(c => c.status === clubStatus);
        if (clubSearch.trim()) {
            const q = clubSearch.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.location?.city?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [clubs, clubSearch, clubStatus]);

    const clubTotalPages = Math.ceil(filteredClubs.length / CLUBS_PER_PAGE);
    const pagedClubs = useMemo(
        () => filteredClubs.slice((clubPage - 1) * CLUBS_PER_PAGE, clubPage * CLUBS_PER_PAGE),
        [filteredClubs, clubPage]
    );

    function onClubSearch(q: string) { setClubSearch(q); setClubPage(1); }
    function onClubStatus(s: ClubStatusFilter) { setClubStatus(s); setClubPage(1); }
    function clearClubFilters() { setClubSearch(""); setClubStatus("all"); setClubPage(1); }
    const hasClubFilters = clubSearch.trim() !== "" || clubStatus !== "all";

    // ── Settings ──────────────────────────────────────────────────────────────
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

                    {/* ── Clubs overview ──────────────────────────────────────── */}
                    <section className="card pa-section">
                        <div className="pa-section__header">
                            <h3 className="pa-section__title">
                                Clubs
                                {!loading && (
                                    <span className="pa-section__count">
                                        {hasClubFilters
                                            ? `${filteredClubs.length} / ${clubs.length}`
                                            : clubs.length}
                                    </span>
                                )}
                            </h3>
                        </div>

                        {/* Search + status filter toolbar */}
                        {!loading && clubs.length > 0 && (
                            <div className="fa-club-toolbar">
                                <input
                                    type="search"
                                    className="fa-selection-search fa-club-search"
                                    placeholder="Search clubs…"
                                    value={clubSearch}
                                    onChange={e => onClubSearch(e.target.value)}
                                />
                                <div className="fa-filter-tabs">
                                    {(["all", "active", "suspended", "pending_approval"] as const).map(s => (
                                        <button
                                            key={s}
                                            className={`fa-filter-tab${clubStatus === s ? " fa-filter-tab--active" : ""}`}
                                            onClick={() => onClubStatus(s)}
                                        >
                                            {s === "all"              ? "All"
                                             : s === "pending_approval" ? "Pending"
                                             : s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                        ) : filteredClubs.length === 0 ? (
                            <div className="pa-empty">
                                <div className="pa-empty__icon">🔍</div>
                                <p className="pa-empty__text">No clubs match your search.</p>
                                <button
                                    className="pa-btn pa-btn--ghost"
                                    style={{ marginTop: 8 }}
                                    onClick={clearClubFilters}
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="fa-club-grid">
                                    {pagedClubs.map(club => (
                                        <ClubOverviewCard
                                            key={club.id}
                                            club={club}
                                            onClick={() => setSelectedClub(club)}
                                        />
                                    ))}
                                </div>
                                <Pagination
                                    page={clubPage}
                                    totalPages={clubTotalPages}
                                    onPageChange={p => setClubPage(p)}
                                />
                            </>
                        )}
                    </section>

                    {/* ── Pending club creation requests ──────────────────────── */}
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

                    {/* ── National selection ──────────────────────────────────── */}
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

            {selectedClub && (
                <ClubDetailModal
                    club={selectedClub}
                    onClose={() => setSelectedClub(null)}
                    onAction={notify}
                    onReload={reload}
                />
            )}

            <Toast toast={toast} />
        </>
    );
}
