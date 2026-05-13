import { useMemo, useState, useEffect, useRef } from "react";

import "./categories.css";
import type {Gender} from "../../../../auth/types.ts";
import {type BoatClass, categoryKey, DIVISIONS, GENDERS} from "../../../lib/categories.ts";
import type {Gender as GENDER_ID} from "../../../lib/categories.ts";

/* ─── types ───────────────────────────────────────────── */

type Props = {
    event: any;
    boats: any[];
    onSave?: (added: string[], removed: string[]) => Promise<void>;
};

type GenderFilter = "All" | Gender;

/* ─── helpers ─────────────────────────────────────────── */

function parseCategory(cat: any) {
    const parts = (cat.name as string).split(" • ");
    return {
        ...cat,
        gender:   parts[0] ?? "",
        division: parts[1] ?? "",
        boatType: parts[2] ?? "",
    };
}

type ParsedCat = ReturnType<typeof parseCategory>;

/** Synthetic category object built from DIVISIONS/GENDERS constants. */
function makeSyntheticCat(gender: GENDER_ID, division: string, boatClass: BoatClass): ParsedCat {
    return {
        id:       categoryKey(gender, division as any, boatClass),
        name:     `${gender} • ${division} • ${boatClass}`,
        gender,
        division,
        boatType: boatClass,
        _synthetic: true,
    };
}

function groupLabel(division: string): string {
    if (division.startsWith("Junior"))  return "Junior";
    if (division.startsWith("U19"))     return "U19";
    if (division.startsWith("U21"))     return "U21";
    if (division.startsWith("U23"))     return "U23";
    if (division.startsWith("Senior"))  return "Senior";
    if (division.startsWith("Masters")) return "Masters";
    if (division === "Para")            return "Para";
    return "Other";
}

const GROUP_ORDER = ["Senior", "Junior", "U19", "U21", "U23", "Masters", "Para", "Other"];

/** Generate the full universe of ~206 categories from the constants. */
function buildFullUniverse(): ParsedCat[] {
    const all: ParsedCat[] = [];
    for (const d of DIVISIONS as any[]) {
        const allowedGenders: GENDER_ID[] = d.genders ?? (["Men", "Women"] as GENDER_ID[]);
        for (const gender of allowedGenders) {
            for (const bc of d.boatClasses as BoatClass[]) {
                all.push(makeSyntheticCat(gender, String(d.division), bc));
            }
        }
    }
    return all;
}

/* ─── main component ──────────────────────────────────── */

export default function CategoriesTab({ event, boats, onSave }: Props) {
    const [genderFilter, setGenderFilter] = useState<GenderFilter>("All");
    const [isEditing, setIsEditing]       = useState(false);
    const [reviewData, setReviewData]     = useState<{
        added: string[];
        removed: string[];
        addedCats: ParsedCat[];
        removedCats: ParsedCat[];
    } | null>(null);
    const [isSaving, setIsSaving]         = useState(false);
    const [saveError, setSaveError]       = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess]   = useState(false);

    const categories: any[] = event.categories ?? [];

    const boatCountMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of boats) {
            if (!b.categoryId) continue;
            map.set(b.categoryId, (map.get(b.categoryId) ?? 0) + 1);
        }
        return map;
    }, [boats]);

    // Currently-enabled categories (from the event), parsed
    const parsedCategories = useMemo(
        () => categories.map(parseCategory),
        [categories]
    );

    // Full universe — generated from constants, then overlay real ids/names from
    // event.categories so that server-assigned ids are preserved where they exist.
    const fullUniverse = useMemo(() => {
        const byId = new Map<string, ParsedCat>();
        for (const c of parsedCategories) byId.set(c.id, c);

        return buildFullUniverse().map((synthetic) => {
            // If the event already has a real category with this id, use it (preserves
            // any extra server fields). Otherwise keep the synthetic placeholder.
            return byId.get(synthetic.id) ?? synthetic;
        });
    }, [parsedCategories]);

    // Lookup map for the review modal — covers both enabled and missing
    const categoryById = useMemo(() => {
        const map = new Map<string, ParsedCat>();
        for (const c of fullUniverse) map.set(c.id, c);
        return map;
    }, [fullUniverse]);

    const totalCategories = parsedCategories.length;
    const withBoats       = parsedCategories.filter((c) => (boatCountMap.get(c.id) ?? 0) > 0).length;
    const emptyCategories = totalCategories - withBoats;

    // Read-view: only show currently enabled categories
    const genders: GenderFilter[] = ["All", ...GENDERS] as GenderFilter[];

    const grouped = useMemo(() => {
        const filtered = parsedCategories.filter((c) =>
            genderFilter === "All" ? true : c.gender === genderFilter
        );
        const map = new Map<string, ParsedCat[]>();
        for (const c of filtered) {
            const g = groupLabel(c.division);
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(c);
        }
        return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
            group: g,
            cats:  map.get(g)!,
        }));
    }, [parsedCategories, genderFilter]);

    function handleReview(added: string[], removed: string[]) {
        setIsEditing(false);
        setReviewData({
            added,
            removed,
            addedCats:   added.map((id)   => categoryById.get(id)).filter(Boolean) as ParsedCat[],
            removedCats: removed.map((id) => categoryById.get(id)).filter(Boolean) as ParsedCat[],
        });
        setSaveError(null);
    }

    async function handleConfirmSave() {
        if (!reviewData) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave?.(reviewData.added, reviewData.removed);
            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
                setReviewData(null);
            }, 1800);
        } catch (err: any) {
            setSaveError(err?.message ?? "Something went wrong. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    function handleCancelReview() {
        setReviewData(null);
        setSaveError(null);
        setIsEditing(true);
    }

    return (
        <div className="categories-tab">

            {/* ── Header card ── */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <h2 className="categories-title">Categories</h2>
                        <p className="categories-subtitle">{totalCategories} enabled for this event</p>
                    </div>
                    <button
                        className="btn-primary categories-edit-btn"
                        onClick={() => setIsEditing(true)}
                    >
                        ✎ Edit categories
                    </button>
                </div>

                <div className="categories-stats-grid">
                    <StatCard label="Enabled"            value={totalCategories} />
                    <StatCard label="Have registrations" value={withBoats}       accent />
                    <StatCard label="Empty"              value={emptyCategories} />
                </div>
            </div>

            {/* ── Read view chip grid ── */}
            <div className="card">
                <div className="categories-gender-filters">
                    {genders.map((g) => (
                        <button
                            key={g}
                            className={`categories-gender-btn${genderFilter === g ? " active" : ""}`}
                            onClick={() => setGenderFilter(g)}
                        >
                            {g}
                        </button>
                    ))}
                </div>

                {grouped.length === 0 && (
                    <p className="categories-empty-msg">No categories match this filter.</p>
                )}

                <div className="categories-group-list">
                    {grouped.map(({ group, cats }) => (
                        <div key={group} className="categories-group">
                            <span className="categories-group-label">{group}</span>
                            <div className="categories-chip-row">
                                {cats.map((cat) => (
                                    <CategoryChip
                                        key={cat.id}
                                        label={cat.name.replace(/ • /g, " ")}
                                        boatCount={boatCountMap.get(cat.id) ?? 0}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Edit panel ── */}
            {isEditing && (
                <EditPanel
                    fullUniverse={fullUniverse}
                    enabledIds={new Set(parsedCategories.map((c) => c.id))}
                    boatCountMap={boatCountMap}
                    onDiscard={() => setIsEditing(false)}
                    onReview={handleReview}
                />
            )}

            {/* ── Review / confirm modal ── */}
            {reviewData && (
                <ReviewModal
                    added={reviewData.addedCats}
                    removed={reviewData.removedCats}
                    boatCountMap={boatCountMap}
                    isSaving={isSaving}
                    saveError={saveError}
                    saveSuccess={saveSuccess}
                    onBack={handleCancelReview}
                    onConfirm={handleConfirmSave}
                />
            )}
        </div>
    );
}

/* ─── review / confirm modal ──────────────────────────── */

type ReviewModalProps = {
    added: ParsedCat[];
    removed: ParsedCat[];
    boatCountMap: Map<string, number>;
    isSaving: boolean;
    saveError: string | null;
    saveSuccess: boolean;
    onBack: () => void;
    onConfirm: () => void;
};

function ReviewModal({
                         added, removed, boatCountMap, isSaving, saveError, saveSuccess, onBack, onConfirm,
                     }: ReviewModalProps) {
    const affectedBoats = removed.reduce((sum, c) => sum + (boatCountMap.get(c.id) ?? 0), 0);
    const isDestructive = affectedBoats > 0;

    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = modalRef.current;
        if (!el) return;
        const focusable = el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable[0]?.focus();
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== "Tab") return;
            const first = focusable[0];
            const last  = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
            }
        }
        el.addEventListener("keydown", onKeyDown);
        return () => el.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <>
            <div className="review-backdrop" onClick={!isSaving ? onBack : undefined} />
            <div
                className={`review-sheet${saveSuccess ? " review-sheet--success" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="review-modal-title"
                ref={modalRef}
            >
                <div className="review-sheet__handle" />

                {saveSuccess ? (
                    <div className="review-success">
                        <div className="review-success__icon">✓</div>
                        <p className="review-success__msg">Changes saved!</p>
                    </div>
                ) : (
                    <>
                        <div className="review-sheet__header">
                            <button
                                className="review-sheet__back"
                                onClick={onBack}
                                disabled={isSaving}
                                aria-label="Go back to editing"
                            >
                                ← Back
                            </button>
                            <h3 id="review-modal-title" className="review-sheet__title">
                                Review changes
                            </h3>
                            <span className="review-sheet__spacer" />
                        </div>

                        {isDestructive && (
                            <div className="review-warning-banner">
                                <span className="review-warning-banner__icon">⚠</span>
                                <span>
                                    Removing {removed.length} {removed.length === 1 ? "category" : "categories"} will
                                    permanently delete{" "}
                                    <strong>{affectedBoats} registered {affectedBoats === 1 ? "boat" : "boats"}</strong>.
                                    This cannot be undone.
                                </span>
                            </div>
                        )}

                        <div className="review-sheet__body">
                            {added.length > 0 && (
                                <section className="review-section">
                                    <h4 className="review-section__heading review-section__heading--added">
                                        <span className="review-section__badge review-section__badge--added">+{added.length}</span>
                                        Adding
                                    </h4>
                                    <ul className="review-list">
                                        {added.map((c) => (
                                            <li key={c.id} className="review-list__item review-list__item--added">
                                                <span className="review-list__dot" />
                                                <span className="review-list__name">{c.name.replace(/ • /g, " ")}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {removed.length > 0 && (
                                <section className="review-section">
                                    <h4 className="review-section__heading review-section__heading--removed">
                                        <span className="review-section__badge review-section__badge--removed">−{removed.length}</span>
                                        Removing
                                    </h4>
                                    <ul className="review-list">
                                        {removed.map((c) => {
                                            const boats = boatCountMap.get(c.id) ?? 0;
                                            return (
                                                <li
                                                    key={c.id}
                                                    className={`review-list__item review-list__item--removed${boats > 0 ? " review-list__item--has-boats" : ""}`}
                                                >
                                                    <span className="review-list__dot" />
                                                    <span className="review-list__name">{c.name.replace(/ • /g, " ")}</span>
                                                    {boats > 0 && (
                                                        <span className="review-list__boats-badge">
                                                            {boats} {boats === 1 ? "boat" : "boats"}
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}
                        </div>

                        {saveError && (
                            <div className="review-error">
                                <span className="review-error__icon">✕</span>
                                {saveError}
                            </div>
                        )}

                        <div className="review-sheet__footer">
                            <button className="btn-cancel" onClick={onBack} disabled={isSaving}>
                                Back to editing
                            </button>
                            <button
                                className={`btn-confirm${isDestructive ? " btn-confirm--destructive" : ""}`}
                                onClick={onConfirm}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <span className="btn-spinner" />
                                ) : isDestructive ? (
                                    "Confirm & save"
                                ) : (
                                    "Save changes"
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

/* ─── edit panel ──────────────────────────────────────── */

type EditPanelProps = {
    fullUniverse: ParsedCat[];       // all ~206 possible categories
    enabledIds: Set<string>;         // which are currently on the event
    boatCountMap: Map<string, number>;
    onDiscard: () => void;
    onReview: (added: string[], removed: string[]) => void;
};

function EditPanel({ fullUniverse, enabledIds, boatCountMap, onDiscard, onReview }: EditPanelProps) {
    const originalIds = useMemo(() => new Set(enabledIds), [enabledIds]);

    const [localEnabledIds, setLocalEnabledIds] = useState<Set<string>>(
        () => new Set(enabledIds)
    );

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        const map: Record<string, boolean> = {};
        GROUP_ORDER.forEach((g) => {
            map[g] = true;
            map[`missing-${g}`] = false; // missing groups collapsed by default
        });
        return map;
    });

    const [missingSearch, setMissingSearch] = useState("");

    // Split universe into enabled vs missing, grouped
    const groupedWithMissing = useMemo(() => {
        const map = new Map<string, { enabled: ParsedCat[]; missing: ParsedCat[] }>();
        for (const g of GROUP_ORDER) map.set(g, { enabled: [], missing: [] });

        for (const c of fullUniverse) {
            const g = groupLabel(c.division);
            const bucket = map.get(g) ?? { enabled: [], missing: [] };
            if (originalIds.has(c.id)) {
                bucket.enabled.push(c);
            } else {
                bucket.missing.push(c);
            }
            map.set(g, bucket);
        }

        return GROUP_ORDER
            .filter((g) => {
                const b = map.get(g)!;
                return b.enabled.length > 0 || b.missing.length > 0;
            })
            .map((g) => ({ group: g, ...map.get(g)! }));
    }, [fullUniverse, originalIds]);

    const totalMissing = useMemo(
        () => groupedWithMissing.reduce((sum, g) => sum + g.missing.length, 0),
        [groupedWithMissing]
    );

    const searchLower = missingSearch.toLowerCase();
    const filteredGroups = useMemo(() =>
            groupedWithMissing.map(({ group, enabled, missing }) => ({
                group,
                enabled,
                missing: searchLower
                    ? missing.filter((c) => c.name.toLowerCase().includes(searchLower))
                    : missing,
            })),
        [groupedWithMissing, searchLower]
    );

    const noMissingResults = searchLower.length > 0 && filteredGroups.every((g) => g.missing.length === 0);

    function toggle(id: string) {
        setLocalEnabledIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    const added   = useMemo(() => [...localEnabledIds].filter((id) => !originalIds.has(id)), [localEnabledIds, originalIds]);
    const removed = useMemo(() => [...originalIds].filter((id) => !localEnabledIds.has(id)), [localEnabledIds, originalIds]);

    const affectedBoats = useMemo(
        () => removed.reduce((sum, id) => sum + (boatCountMap.get(id) ?? 0), 0),
        [removed, boatCountMap]
    );

    const hasChanges = added.length > 0 || removed.length > 0;

    return (
        <>
            <div className="edit-panel-overlay" onClick={onDiscard} />
            <div className="edit-panel">

                <div className="edit-panel-header">
                    <div>
                        <h3 className="edit-panel-title">Edit categories</h3>
                        <p className="edit-panel-subtitle">Tap chips to toggle on / off</p>
                    </div>
                    <button className="edit-panel-close" onClick={onDiscard} aria-label="Discard and close">
                        ✕
                    </button>
                </div>

                {affectedBoats > 0 && (
                    <div className="edit-panel-warning">
                        ⚠ Removing categories will delete {affectedBoats} registered {affectedBoats === 1 ? "boat" : "boats"}.
                    </div>
                )}

                <div className="edit-panel-body">

                    {/* ── Currently-enabled categories ── */}
                    {filteredGroups.map(({ group, enabled }) => {
                        if (enabled.length === 0) return null;
                        const isOpen = openGroups[group] ?? true;
                        return (
                            <div key={group} className="edit-group">
                                <button
                                    className="edit-group-toggle"
                                    onClick={() => setOpenGroups((p) => ({ ...p, [group]: !isOpen }))}
                                >
                                    <span className="edit-group-caret">{isOpen ? "▾" : "▸"}</span>
                                    <span className="edit-group-name">{group}</span>
                                    <span className="edit-group-count">
                                        {enabled.filter((c) => localEnabledIds.has(c.id)).length}/{enabled.length}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="edit-chip-row">
                                        {enabled.map((cat) => {
                                            const on      = localEnabledIds.has(cat.id);
                                            const boats   = boatCountMap.get(cat.id) ?? 0;
                                            const removing = !on && boats > 0;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    className={
                                                        "edit-chip" +
                                                        (on ? " on" : "") +
                                                        (removing ? " removing" : "")
                                                    }
                                                    onClick={() => toggle(cat.id)}
                                                    aria-pressed={on}
                                                >
                                                    {cat.name.replace(/ • /g, " ")}
                                                    {boats > 0 && (
                                                        <span className="edit-chip__count">{boats}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ── Missing categories section ── */}
                    {totalMissing > 0 && (
                        <div className="edit-missing-section">
                            <div className="edit-missing-header">
                                <span className="edit-missing-title">Not on this event</span>
                                <span className="edit-missing-count">{totalMissing} available to add</span>
                            </div>

                            <div className="edit-missing-search">
                                <input
                                    type="search"
                                    placeholder="Search categories…"
                                    value={missingSearch}
                                    onChange={(e) => setMissingSearch(e.target.value)}
                                    className="edit-missing-search__input"
                                    aria-label="Search missing categories"
                                />
                            </div>

                            {filteredGroups.map(({ group, missing }) => {
                                if (missing.length === 0) return null;
                                const key    = `missing-${group}`;
                                const isOpen = openGroups[key] ?? false;
                                return (
                                    <div key={key} className="edit-group edit-group--missing">
                                        <button
                                            className="edit-group-toggle"
                                            onClick={() => setOpenGroups((p) => ({ ...p, [key]: !isOpen }))}
                                        >
                                            <span className="edit-group-caret">{isOpen ? "▾" : "▸"}</span>
                                            <span className="edit-group-name">{group}</span>
                                            <span className="edit-group-count">
                                                {missing.length} available
                                                {missing.filter((c) => localEnabledIds.has(c.id)).length > 0 && (
                                                    <> · {missing.filter((c) => localEnabledIds.has(c.id)).length} selected</>
                                                )}
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="edit-chip-row">
                                                {missing.map((cat) => {
                                                    const on = localEnabledIds.has(cat.id);
                                                    return (
                                                        <button
                                                            key={cat.id}
                                                            className={`edit-chip edit-chip--missing${on ? " on" : ""}`}
                                                            onClick={() => toggle(cat.id)}
                                                            aria-pressed={on}
                                                        >
                                                            {cat.name.replace(/ • /g, " ")}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {noMissingResults && (
                                <p className="edit-missing-no-results">
                                    No categories match "{missingSearch}"
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="edit-panel-footer">
                    <div className="edit-panel-diff">
                        {hasChanges ? (
                            <>
                                {added.length > 0 && (
                                    <span className="diff-pill diff-pill--added">+{added.length} added</span>
                                )}
                                {removed.length > 0 && (
                                    <span className="diff-pill diff-pill--removed">−{removed.length} removed</span>
                                )}
                                {affectedBoats > 0 && (
                                    <span className="diff-pill diff-pill--warn">{affectedBoats} boats affected</span>
                                )}
                            </>
                        ) : (
                            <span className="diff-pill diff-pill--neutral">No changes</span>
                        )}
                    </div>
                    <div className="edit-panel-actions">
                        <button className="btn-cancel" onClick={onDiscard}>Discard</button>
                        <button
                            className="btn-primary"
                            disabled={!hasChanges}
                            onClick={() => onReview(added, removed)}
                        >
                            Review changes →
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

/* ─── small shared components ─────────────────────────── */

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className={`categories-stat${accent ? " categories-stat--accent" : ""}`}>
            <span className="categories-stat-value">{value}</span>
            <span className="categories-stat-label">{label}</span>
        </div>
    );
}

function CategoryChip({ label, boatCount }: { label: string; boatCount: number }) {
    return (
        <span className="cat-chip">
            {label}
            {boatCount > 0 && <span className="cat-chip__count">{boatCount}</span>}
        </span>
    );
}