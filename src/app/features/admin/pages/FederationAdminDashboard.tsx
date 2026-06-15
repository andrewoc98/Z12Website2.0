import { useState, useMemo, useEffect, useCallback } from "react";
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
import {
    listSeriesGroups,
    createSeriesGroup,
    updateSeriesGroupClubs,
    type SeriesGroup,
} from "../../events/api/events";

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

// ── Regional Series Groups section ───────────────────────────────────────────

function SeriesGroupsSection({ federationId, clubs }: { federationId: string; clubs: Club[] }) {
    const [groups, setGroups] = useState<SeriesGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState("");
    const [creating, setCreating] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editClubIds, setEditClubIds] = useState<string[]>([]);
    const [clubSearch, setClubSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setGroups(await listSeriesGroups(federationId));
        } finally {
            setLoading(false);
        }
    }, [federationId]);

    useEffect(() => { void load(); }, [load]);

    async function handleCreate() {
        if (!newGroupName.trim()) return;
        setCreating(true);
        setErr(null);
        try {
            await createSeriesGroup(federationId, newGroupName.trim());
            setNewGroupName("");
            await load();
        } catch (e: any) {
            setErr(e?.message ?? "Failed to create group");
        } finally {
            setCreating(false);
        }
    }

    function startEdit(group: SeriesGroup) {
        setEditingGroupId(group.id);
        setEditClubIds(group.clubIds ?? []);
        setClubSearch("");
    }

    function cancelEdit() {
        setEditingGroupId(null);
        setClubSearch("");
    }

    function addClub(clubId: string) {
        setEditClubIds(prev => prev.includes(clubId) ? prev : [...prev, clubId]);
        setClubSearch("");
    }

    function removeClub(clubId: string) {
        setEditClubIds(prev => prev.filter(id => id !== clubId));
    }

    async function handleSaveClubs() {
        if (!editingGroupId) return;
        setSaving(true);
        setErr(null);
        try {
            await updateSeriesGroupClubs(federationId, editingGroupId, editClubIds);
            cancelEdit();
            await load();
        } catch (e: any) {
            setErr(e?.message ?? "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    // Clubs not yet added to the group being edited, filtered by search
    const searchResults = useMemo(() => {
        if (!clubSearch.trim()) return [];
        const q = clubSearch.toLowerCase();
        return clubs
            .filter(c => !editClubIds.includes(c.id))
            .filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.location?.city ?? "").toLowerCase().includes(q) ||
                (c.location?.county ?? "").toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [clubs, editClubIds, clubSearch]);

    return (
        <section className="card pa-section">
            <div className="pa-section__header">
                <h3 className="pa-section__title">
                    Regional Series Groups
                    {!loading && groups.length > 0 && (
                        <span className="pa-section__count">{groups.length}</span>
                    )}
                </h3>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                Group clubs into regional series. Each group qualifies athletes for the National Series.
                Regional Series events must be 3000m; National Series and National Events must be 6000m.
            </p>

            {err && <div className="pa-error" style={{ marginBottom: 12 }}>{err}</div>}

            {/* Create new group */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                    className="fa-selection-search"
                    style={{ flex: 1 }}
                    placeholder="New group name (e.g. Munster Regional Series)"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !creating && void handleCreate()}
                />
                <button
                    className="pa-btn pa-btn--primary"
                    disabled={creating || !newGroupName.trim()}
                    onClick={() => void handleCreate()}
                >
                    {creating ? "Creating…" : "Create Group"}
                </button>
            </div>

            {loading ? (
                <div className="stack">
                    {[1, 2].map(i => <div key={i} className="pa-skeleton-row" style={{ height: 80 }} />)}
                </div>
            ) : groups.length === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty__icon">🏅</div>
                    <p className="pa-empty__text">No regional series groups yet. Create one above to start grouping clubs.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {groups.map(group => {
                        const isEditing = editingGroupId === group.id;
                        const assignedClubs = (group.clubIds ?? [])
                            .map(id => clubs.find(c => c.id === id))
                            .filter(Boolean) as Club[];

                        return (
                            <div
                                key={group.id}
                                style={{ borderRadius: 10, overflow: "hidden", border: "2px solid rgba(255,212,0,0.4)" }}
                            >
                                {/* Group header stripe */}
                                <div style={{
                                    background: "rgba(255,212,0,0.08)",
                                    padding: "5px 14px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}>
                                    <span style={{
                                        color: "rgba(255,212,0,0.6)",
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                    }}>
                                        ◈ Regional Series
                                    </span>
                                </div>

                                <div style={{ padding: "12px 14px" }}>
                                    {/* Group name row */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                        <div style={{ fontWeight: 600, fontSize: "1rem" }}>{group.name}</div>
                                        <button
                                            className="pa-btn pa-btn--ghost"
                                            style={{ padding: "4px 12px", fontSize: "0.8rem", flexShrink: 0 }}
                                            onClick={() => isEditing ? cancelEdit() : startEdit(group)}
                                        >
                                            {isEditing ? "Cancel" : "Edit"}
                                        </button>
                                    </div>

                                    {/* Assigned clubs — pills */}
                                    {!isEditing && (
                                        assignedClubs.length === 0 ? (
                                            <span className="muted" style={{ fontSize: "0.82rem" }}>No clubs assigned yet — click Edit to add some.</span>
                                        ) : (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {assignedClubs.map(club => (
                                                    <span key={club.id} style={{
                                                        padding: "3px 10px",
                                                        borderRadius: 999,
                                                        background: "rgba(255,255,255,0.08)",
                                                        fontSize: "0.8rem",
                                                        color: "var(--text)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                    }}>
                                                        {club.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )
                                    )}

                                    {/* Edit panel */}
                                    {isEditing && (
                                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>

                                            {/* Assigned clubs as removable pills */}
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, minHeight: 32 }}>
                                                {editClubIds.length === 0 && (
                                                    <span className="muted" style={{ fontSize: "0.82rem", alignSelf: "center" }}>
                                                        No clubs added yet — search below to add.
                                                    </span>
                                                )}
                                                {editClubIds.map(clubId => {
                                                    const club = clubs.find(c => c.id === clubId);
                                                    return (
                                                        <span key={clubId} style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 6,
                                                            padding: "3px 8px 3px 10px",
                                                            borderRadius: 999,
                                                            background: "rgba(255,212,0,0.12)",
                                                            border: "1px solid rgba(255,212,0,0.35)",
                                                            fontSize: "0.8rem",
                                                            color: "var(--text)",
                                                        }}>
                                                            {club?.name ?? clubId}
                                                            <button
                                                                onClick={() => removeClub(clubId)}
                                                                style={{
                                                                    background: "none",
                                                                    border: "none",
                                                                    padding: 0,
                                                                    width: 16,
                                                                    height: 16,
                                                                    borderRadius: "50%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    cursor: "pointer",
                                                                    color: "var(--muted)",
                                                                    fontSize: "0.9rem",
                                                                    lineHeight: 1,
                                                                    flexShrink: 0,
                                                                }}
                                                                aria-label={`Remove ${club?.name}`}
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {/* Club search */}
                                            <div style={{ position: "relative", marginBottom: 12 }}>
                                                <input
                                                    className="fa-selection-search"
                                                    style={{ width: "100%" }}
                                                    placeholder="Search clubs by name, city or county…"
                                                    value={clubSearch}
                                                    onChange={e => setClubSearch(e.target.value)}
                                                    autoFocus
                                                />
                                                {searchResults.length > 0 && (
                                                    <div style={{
                                                        position: "absolute",
                                                        top: "calc(100% + 4px)",
                                                        left: 0,
                                                        right: 0,
                                                        background: "var(--surface-2)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "var(--radius-sm)",
                                                        zIndex: 50,
                                                        overflow: "hidden",
                                                    }}>
                                                        {searchResults.map((club, i) => (
                                                            <button
                                                                key={club.id}
                                                                onClick={() => addClub(club.id)}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    width: "100%",
                                                                    padding: "9px 14px",
                                                                    background: "transparent",
                                                                    border: "none",
                                                                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                                                                    borderRadius: 0,
                                                                    textAlign: "left",
                                                                    cursor: "pointer",
                                                                    color: "var(--text)",
                                                                    fontSize: "0.875rem",
                                                                }}
                                                            >
                                                                <span>{club.name}</span>
                                                                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                                                                    {club.location?.city}{club.location?.county ? `, ${club.location.county}` : ""}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Save */}
                                            <button
                                                className="pa-btn pa-btn--primary"
                                                disabled={saving}
                                                onClick={() => void handleSaveClubs()}
                                            >
                                                {saving ? "Saving…" : "Save"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
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

                    {/* ── Regional series groups ──────────────────────────────── */}
                    {!loading && federationId && (
                        <SeriesGroupsSection federationId={federationId} clubs={clubs} />
                    )}

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
