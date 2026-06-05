import { useEffect, useState, useCallback, useMemo } from "react";
import { getAthleteSelectionProfiles } from "../../services/clubAdminService";
import AthleteSelectionProfileModal from "./AthleteSelectionProfile";
import Pagination from "../../../../shared/components/Pagination/Pagination";
import type { AthleteSelectionProfile } from "../../types/admin.types";
import "../../styles/platformAdmin.css";
import "../../styles/federationAdmin.css";

const ATHLETES_PER_PAGE = 20;

type Props = {
    clubIds: string[];
    federationId: string;
};

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

const DIST_OPTS = [
    { label: "100m",   perfKey: "best100m"   as const },
    { label: "500m",   perfKey: "best500m"   as const },
    { label: "2000m",  perfKey: "best2000m"  as const },
    { label: "6000m",  perfKey: "best6000m"  as const },
    { label: "10000m", perfKey: "best10000m" as const },
] as const;

type DistOpt = typeof DIST_OPTS[number];

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(seconds?: number): string {
    if (seconds == null) return "—";
    if (seconds < 60) return seconds.toFixed(1);
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${m}:${s}`;
}

// Accepts "M:SS", "M:SS.s", or plain seconds ("390")
function parseTimeInput(val: string): number | null {
    const t = val.trim();
    if (!t) return null;
    if (t.includes(":")) {
        const [mStr, sStr] = t.split(":");
        const m = parseInt(mStr, 10);
        const s = parseFloat(sStr);
        if (isNaN(m) || isNaN(s)) return null;
        return m * 60 + s;
    }
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
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

    // ── Filters ───────────────────────────────────────────────────────────────
    const [genderFilter,    setGenderFilter]    = useState<"all" | "male" | "female">("all");
    const [clubFilter,      setClubFilter]      = useState("all");
    const [searchQuery,     setSearchQuery]     = useState("");
    const [showShortlisted, setShowShortlisted] = useState(false);
    const [selectedDist,    setSelectedDist]    = useState<DistOpt>(DIST_OPTS[2]); // default 2000m
    const [minAge,          setMinAge]          = useState("");
    const [maxAge,          setMaxAge]          = useState("");
    const [minTime,         setMinTime]         = useState("");
    const [maxTime,         setMaxTime]         = useState("");
    const [page, setPage] = useState(1);

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

    // ── Derived options ───────────────────────────────────────────────────────
    const clubOptions = useMemo(() =>
        [...new Set(athletes.map(a => a.clubName))].sort(),
    [athletes]);

    // ── Filtered + sorted list ────────────────────────────────────────────────
    const displayed = useMemo(() => {
        let list = athletes.slice();

        if (showShortlisted)        list = list.filter(a => shortlisted.has(a.uid));
        if (genderFilter !== "all") list = list.filter(a => a.gender === genderFilter);
        if (clubFilter   !== "all") list = list.filter(a => a.clubName === clubFilter);

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a => a.displayName.toLowerCase().includes(q));
        }

        // Age range
        const minAgeN = parseInt(minAge, 10);
        const maxAgeN = parseInt(maxAge, 10);
        if (!isNaN(minAgeN)) list = list.filter(a => { const age = ageThisYear(a.dateOfBirth); return age != null && age >= minAgeN; });
        if (!isNaN(maxAgeN)) list = list.filter(a => { const age = ageThisYear(a.dateOfBirth); return age != null && age <= maxAgeN; });

        // Erg time range for the selected distance
        const perfKey = selectedDist.perfKey;
        const minSec  = parseTimeInput(minTime);
        const maxSec  = parseTimeInput(maxTime);
        if (minSec != null) list = list.filter(a => { const t = a.performances[perfKey]; return t != null && t >= minSec; });
        if (maxSec != null) list = list.filter(a => { const t = a.performances[perfKey]; return t != null && t <= maxSec; });

        // Sort by selected distance fastest-first; athletes with no time go last
        list.sort((a, b) =>
            (a.performances[perfKey] ?? Infinity) -
            (b.performances[perfKey] ?? Infinity)
        );

        return list;
    }, [athletes, showShortlisted, shortlisted, genderFilter, clubFilter, searchQuery,
        minAge, maxAge, selectedDist, minTime, maxTime]);

    // ── Pagination ────────────────────────────────────────────────────────────
    const totalPages    = Math.ceil(displayed.length / ATHLETES_PER_PAGE);
    const pagedAthletes = useMemo(
        () => displayed.slice((page - 1) * ATHLETES_PER_PAGE, page * ATHLETES_PER_PAGE),
        [displayed, page]
    );

    // ── Counts ────────────────────────────────────────────────────────────────
    const maleCount      = athletes.filter(a => a.gender === "male").length;
    const femaleCount    = athletes.filter(a => a.gender === "female").length;
    const shortlistCount = athletes.filter(a => shortlisted.has(a.uid)).length;

    const hasActiveFilters =
        genderFilter !== "all" || clubFilter !== "all" || searchQuery.trim() !== "" ||
        showShortlisted || minAge !== "" || maxAge !== "" || minTime !== "" || maxTime !== "";

    function clearFilters() {
        setGenderFilter("all");
        setClubFilter("all");
        setSearchQuery("");
        setShowShortlisted(false);
        setMinAge(""); setMaxAge("");
        setMinTime(""); setMaxTime("");
        setPage(1);
    }

    function resetPage<T>(setter: (v: T) => void) {
        return (v: T) => { setter(v); setPage(1); };
    }

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
            {/* ── Filter panel ──────────────────────────────────────────────── */}
            <div className="fa-filter-panel">

                {/* Row 1: gender + club */}
                <div className="fa-filter-row">
                    <div className="fa-filter-tabs">
                        {(["all", "male", "female"] as const).map(g => (
                            <button
                                key={g}
                                className={`fa-filter-tab${genderFilter === g ? " fa-filter-tab--active" : ""}`}
                                onClick={() => resetPage(setGenderFilter)(g)}
                            >
                                {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                            </button>
                        ))}
                    </div>

                    {clubOptions.length > 1 && (
                        <select
                            className="fa-selection-select"
                            value={clubFilter}
                            onChange={e => resetPage(setClubFilter)(e.target.value)}
                        >
                            <option value="all">All clubs</option>
                            {clubOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Row 2: distance + age range + erg time range */}
                <div className="fa-filter-row">
                    <select
                        className="fa-selection-select"
                        value={selectedDist.label}
                        onChange={e => {
                            const d = DIST_OPTS.find(d => d.label === e.target.value) ?? DIST_OPTS[2];
                            setSelectedDist(d);
                            setMinTime("");
                            setMaxTime("");
                            setPage(1);
                        }}
                    >
                        {DIST_OPTS.map(d => (
                            <option key={d.label} value={d.label}>{d.label}</option>
                        ))}
                    </select>

                    <div className="fa-range-group">
                        <span className="fa-range-group__label">Age</span>
                        <input
                            type="number"
                            className="fa-range-input"
                            placeholder="Min"
                            min={10} max={99}
                            value={minAge}
                            onChange={e => { setMinAge(e.target.value); setPage(1); }}
                        />
                        <span className="fa-range-sep">–</span>
                        <input
                            type="number"
                            className="fa-range-input"
                            placeholder="Max"
                            min={10} max={99}
                            value={maxAge}
                            onChange={e => { setMaxAge(e.target.value); setPage(1); }}
                        />
                        <span className="fa-range-group__unit">yrs</span>
                    </div>

                    <div className="fa-range-group">
                        <span className="fa-range-group__label">Erg</span>
                        <input
                            type="text"
                            className="fa-range-input fa-range-input--wide"
                            placeholder="e.g. 6:30"
                            value={minTime}
                            onChange={e => { setMinTime(e.target.value); setPage(1); }}
                        />
                        <span className="fa-range-sep">–</span>
                        <input
                            type="text"
                            className="fa-range-input fa-range-input--wide"
                            placeholder="e.g. 8:00"
                            value={maxTime}
                            onChange={e => { setMaxTime(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                {/* Row 3: name search + shortlist + clear */}
                <div className="fa-filter-row">
                    <input
                        type="search"
                        className="fa-selection-search"
                        placeholder="Search athletes…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                    <button
                        className={`fa-filter-tab${showShortlisted ? " fa-filter-tab--active" : ""}`}
                        onClick={() => { setShowShortlisted(s => !s); setPage(1); }}
                    >
                        ★{shortlistCount > 0 ? ` (${shortlistCount})` : " Shortlisted"}
                    </button>
                    {hasActiveFilters && (
                        <button className="pa-btn pa-btn--ghost" onClick={clearFilters}>
                            Clear
                        </button>
                    )}
                </div>

                {/* Stats summary */}
                <div className="fa-selection-count">
                    {athletes.length} athletes
                    {" · "}{maleCount} male
                    {" · "}{femaleCount} female
                    {shortlistCount > 0 && <> · {shortlistCount} shortlisted</>}
                    {displayed.length !== athletes.length && <> · {displayed.length} shown</>}
                </div>
            </div>

            {/* ── Results ───────────────────────────────────────────────────── */}
            {displayed.length === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty__icon">🔍</div>
                    <p className="pa-empty__text">No athletes match the current filters.</p>
                    <button className="pa-btn pa-btn--ghost" style={{ marginTop: 8 }} onClick={clearFilters}>
                        Clear filters
                    </button>
                </div>
            ) : (
                <>
                    <div className="fa-athlete-grid">
                        {pagedAthletes.map(athlete => (
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
                                <button
                                    className={`fa-shortlist-btn${shortlisted.has(athlete.uid) ? " fa-shortlist-btn--active" : ""}`}
                                    onClick={e => { e.stopPropagation(); toggleShortlist(athlete.uid); }}
                                    aria-label={shortlisted.has(athlete.uid) ? "Remove from shortlist" : "Add to shortlist"}
                                >
                                    ★
                                </button>

                                <div className="fa-athlete-card__avatar">{initials(athlete.displayName)}</div>
                                <div className="fa-athlete-card__name">{athlete.displayName}</div>
                                <div className="fa-athlete-card__meta">
                                    {athlete.clubName}
                                    {(athlete.dateOfBirth || athlete.gender) && (
                                        <><br />{[computedAgeGroup(athlete.dateOfBirth), athlete.gender].filter(Boolean).join(" · ")}</>
                                    )}
                                </div>

                                <div className="fa-athlete-card__2k">
                                    <span className={`fa-athlete-card__2k-time${athlete.performances[selectedDist.perfKey] == null ? " fa-athlete-card__2k-time--empty" : ""}`}>
                                        {fmtTime(athlete.performances[selectedDist.perfKey])}
                                    </span>
                                    <span className="fa-athlete-card__2k-label">{selectedDist.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </>
            )}

            {selected && (
                <AthleteSelectionProfileModal
                    athlete={selected}
                    onClose={() => setSelected(null)}
                    isShortlisted={shortlisted.has(selected.uid)}
                    onToggleShortlist={() => toggleShortlist(selected.uid)}
                    highlightDist={selectedDist}
                />
            )}
        </>
    );
}
