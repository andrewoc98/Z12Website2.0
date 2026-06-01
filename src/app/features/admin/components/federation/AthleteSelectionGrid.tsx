import { useEffect, useState, useCallback, useMemo } from "react";
import { getAthleteSelectionProfiles } from "../../services/clubAdminService";
import AthleteSelectionProfileModal from "./AthleteSelectionProfile";
import type { AthleteSelectionProfile } from "../../types/admin.types";
import "../../styles/platformAdmin.css";
import "../../styles/federationAdmin.css";

type Props = {
    clubIds: string[];
    federationId: string;
};

type SortMode = "name" | "100m" | "500m" | "2000m" | "6000m" | "10000m";
type AgeGroupFilter = "all" | "junior" | "u23" | "senior";

const CURRENT_YEAR = new Date().getFullYear();

function ageThisYear(dob: string): number | null {
    if (!dob) return null;
    return CURRENT_YEAR - new Date(dob).getFullYear();
}

function computedAgeGroup(dob: string): string {
    const age = ageThisYear(dob);
    if (age == null) return "";
    if (age <= 18) return "Junior";
    if (age <= 23) return "U23";
    return "Senior";
}

const DIST_OPTS: { label: SortMode; perfKey: keyof AthleteSelectionProfile["performances"] }[] = [
    { label: "100m",   perfKey: "best100m"   },
    { label: "500m",   perfKey: "best500m"   },
    { label: "2000m",  perfKey: "best2000m"  },
    { label: "6000m",  perfKey: "best6000m"  },
    { label: "10000m", perfKey: "best10000m" },
];

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(seconds?: number): string {
    if (seconds == null) return "—";
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function SkeletonGrid() {
    return (
        <div className="fa-athlete-grid">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="pa-skeleton-row" style={{ height: 140, borderRadius: "var(--radius-sm)" }} />
            ))}
        </div>
    );
}

export default function AthleteSelectionGrid({ clubIds, federationId }: Props) {
    const [athletes, setAthletes] = useState<AthleteSelectionProfile[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [selected, setSelected] = useState<AthleteSelectionProfile | null>(null);

    // ── Filters & sort ────────────────────────────────────────────────────────
    const [genderFilter,    setGenderFilter]    = useState<"all" | "male" | "female">("all");
    const [ageGroupFilter,  setAgeGroupFilter]  = useState<AgeGroupFilter>("all");
    const [clubFilter,      setClubFilter]      = useState<string>("all");
    const [searchQuery,     setSearchQuery]     = useState<string>("");
    const [sortMode,        setSortMode]        = useState<SortMode>("2000m");
    const [showShortlisted, setShowShortlisted] = useState(false);

    // ── Shortlist (localStorage, keyed by federation) ─────────────────────────
    const [shortlisted, setShortlisted] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem(`shortlist_${federationId}`);
            return new Set<string>(raw ? JSON.parse(raw) : []);
        } catch { return new Set<string>(); }
    });

    function toggleShortlist(uid: string) {
        setShortlisted(prev => {
            const next = new Set(prev);
            next.has(uid) ? next.delete(uid) : next.add(uid);
            try {
                localStorage.setItem(`shortlist_${federationId}`, JSON.stringify([...next]));
            } catch { /* storage quota exceeded */ }
            return next;
        });
    }

    // ── Data load ─────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            setAthletes(await getAthleteSelectionProfiles(clubIds));
        } catch (err) {
            console.error("[AthleteSelectionGrid]", err);
        } finally {
            setLoading(false);
        }
    }, [clubIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    // ── Derived filter options (built from live data) ─────────────────────────
    const clubOptions = useMemo(() =>
        [...new Set(athletes.map(a => a.clubName))].sort(),
    [athletes]);

    const availableDistances = useMemo(() =>
        DIST_OPTS.filter(d => athletes.some(a => a.performances[d.perfKey] != null)),
    [athletes]);

    // ── Filtered + sorted list ────────────────────────────────────────────────
    const displayed = useMemo(() => {
        let list = athletes.slice();
        if (showShortlisted)          list = list.filter(a => shortlisted.has(a.uid));
        if (genderFilter !== "all")   list = list.filter(a => a.gender === genderFilter);
        if (ageGroupFilter === "junior") {
            list = list.filter(a => { const age = ageThisYear(a.dateOfBirth); return age != null && age <= 18; });
        } else if (ageGroupFilter === "u23") {
            list = list.filter(a => { const age = ageThisYear(a.dateOfBirth); return age != null && age >= 19 && age <= 23; });
        } else if (ageGroupFilter === "senior") {
            list = list.filter(a => { const age = ageThisYear(a.dateOfBirth); return age != null && age >= 24; });
        }
        if (clubFilter !== "all")     list = list.filter(a => a.clubName === clubFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a => a.displayName.toLowerCase().includes(q));
        }
        if (sortMode !== "name") {
            const distOpt = DIST_OPTS.find(d => d.label === sortMode)!;
            list.sort((a, b) =>
                (a.performances[distOpt.perfKey] ?? Infinity) -
                (b.performances[distOpt.perfKey] ?? Infinity)
            );
        } else {
            list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        }
        return list;
    }, [athletes, showShortlisted, shortlisted, genderFilter, ageGroupFilter, clubFilter, searchQuery, sortMode]);

    // ── Counts ────────────────────────────────────────────────────────────────
    const maleCount      = athletes.filter(a => a.gender === "male").length;
    const femaleCount    = athletes.filter(a => a.gender === "female").length;
    const shortlistCount = athletes.filter(a => shortlisted.has(a.uid)).length;

    function clearFilters() {
        setGenderFilter("all");
        setAgeGroupFilter("all");
        setClubFilter("all");
        setSearchQuery("");
        setShowShortlisted(false);
    }

    const activeDistOpt = sortMode !== "name"
        ? DIST_OPTS.find(d => d.label === sortMode) ?? DIST_OPTS[2]
        : (availableDistances[0] ?? DIST_OPTS[2]);

    if (loading) return <SkeletonGrid />;

    if (athletes.length === 0) {
        return (
            <div className="pa-empty">
                <div className="pa-empty__icon">🏅</div>
                <p className="pa-empty__text">
                    No athletes have opted in to national selection visibility yet.
                    Athletes can enable this from their profile settings.
                </p>
            </div>
        );
    }

    return (
        <>
            {/* ── Filter toolbar ────────────────────────────────────────────── */}
            <div className="fa-selection-toolbar">
                <div className="fa-selection-top-row">

                    {/* Gender tabs */}
                    <div className="fa-filter-tabs">
                        {(["all", "male", "female"] as const).map(g => (
                            <button
                                key={g}
                                className={`fa-filter-tab${genderFilter === g ? " fa-filter-tab--active" : ""}`}
                                onClick={() => setGenderFilter(g)}
                            >
                                {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Age group */}
                    <select
                        className="fa-selection-select"
                        value={ageGroupFilter}
                        onChange={e => setAgeGroupFilter(e.target.value as AgeGroupFilter)}
                    >
                        <option value="all">All ages</option>
                        <option value="junior">Junior</option>
                        <option value="u23">U23</option>
                        <option value="senior">Senior</option>
                    </select>

                    {/* Club */}
                    {clubOptions.length > 1 && (
                        <select
                            className="fa-selection-select"
                            value={clubFilter}
                            onChange={e => setClubFilter(e.target.value)}
                        >
                            <option value="all">All clubs</option>
                            {clubOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}

                    {/* Sort */}
                    <select
                        className="fa-selection-select"
                        value={sortMode}
                        onChange={e => setSortMode(e.target.value as SortMode)}
                    >
                        {availableDistances.map(d => (
                            <option key={d.label} value={d.label}>Best {d.label}</option>
                        ))}
                        <option value="name">Name A–Z</option>
                    </select>
                </div>

                <div className="fa-selection-search-row">
                    <input
                        type="search"
                        className="fa-selection-search"
                        placeholder="Search athletes…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <button
                        className={`fa-filter-tab${showShortlisted ? " fa-filter-tab--active" : ""}`}
                        onClick={() => setShowShortlisted(s => !s)}
                    >
                        ★{shortlistCount > 0 ? ` (${shortlistCount})` : " Shortlisted"}
                    </button>
                </div>

                <div className="fa-selection-count">
                    {athletes.length} athletes
                    {" · "}{maleCount} male
                    {" · "}{femaleCount} female
                    {shortlistCount > 0 && <> · {shortlistCount} shortlisted</>}
                    {displayed.length !== athletes.length && <> · {displayed.length} shown</>}
                </div>
            </div>

            {/* ── Filtered-empty state ──────────────────────────────────────── */}
            {displayed.length === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty__icon">🔍</div>
                    <p className="pa-empty__text">No athletes match the current filters.</p>
                    <button
                        className="pa-btn pa-btn--ghost"
                        style={{ marginTop: 8 }}
                        onClick={clearFilters}
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="fa-athlete-grid">
                    {displayed.map(athlete => (
                        <div
                            key={athlete.uid}
                            role="button"
                            tabIndex={0}
                            className={`fa-athlete-card${shortlisted.has(athlete.uid) ? " fa-athlete-card--shortlisted" : ""}`}
                            style={{ cursor: "pointer", position: "relative" }}
                            onClick={() => setSelected(athlete)}
                            onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") setSelected(athlete);
                            }}
                        >
                            {/* Shortlist star */}
                            <button
                                className={`fa-shortlist-btn${shortlisted.has(athlete.uid) ? " fa-shortlist-btn--active" : ""}`}
                                onClick={e => { e.stopPropagation(); toggleShortlist(athlete.uid); }}
                                aria-label={shortlisted.has(athlete.uid) ? "Remove from shortlist" : "Add to shortlist"}
                            >
                                ★
                            </button>

                            <div className="fa-athlete-card__avatar">
                                {initials(athlete.displayName)}
                            </div>
                            <div className="fa-athlete-card__name">{athlete.displayName}</div>
                            <div className="fa-athlete-card__meta">
                                {athlete.clubName}
                                {(athlete.dateOfBirth || athlete.gender) && (
                                    <><br />{[computedAgeGroup(athlete.dateOfBirth), athlete.gender].filter(Boolean).join(" · ")}</>
                                )}
                            </div>

                            {/* Active sort metric */}
                            <div className="fa-athlete-card__2k">
                                <span className={`fa-athlete-card__2k-time${athlete.performances[activeDistOpt.perfKey] == null ? " fa-athlete-card__2k-time--empty" : ""}`}>
                                    {fmtTime(athlete.performances[activeDistOpt.perfKey])}
                                </span>
                                <span className="fa-athlete-card__2k-label">{activeDistOpt.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selected && (
                <AthleteSelectionProfileModal
                    athlete={selected}
                    onClose={() => setSelected(null)}
                    isShortlisted={shortlisted.has(selected.uid)}
                    onToggleShortlist={() => toggleShortlist(selected.uid)}
                    highlightDist={activeDistOpt}
                />
            )}
        </>
    );
}
