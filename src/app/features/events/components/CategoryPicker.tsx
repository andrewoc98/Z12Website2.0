import { useMemo, useState } from "react";
import { DIVISIONS, GENDERS, categoryKey, type Gender, type Division } from "../lib/categories";

type Props = {
    value: string[];
    onChange: (next: string[]) => void;
};

type GenderFilter = "All" | Gender;
type GroupKey = "All" | "Junior" | "U19" | "U21" | "U23" | "Senior" | "Masters" | "Para";

type DivisionConfig = (typeof DIVISIONS)[number] & {
    genders?: readonly Gender[];
};

function boatClassesForGender(d: DivisionConfig) {
    return d.boatClasses;
}

function groupFromDivision(division: Division): GroupKey {
    const s = String(division);
    if (s.startsWith("Junior")) return "Junior";
    if (s.startsWith("U19")) return "U19";
    if (s.startsWith("U21")) return "U21";
    if (s.startsWith("U23")) return "U23";
    if (s.startsWith("Senior")) return "Senior";
    if (s.startsWith("Masters")) return "Masters";
    if (s === "Para") return "Para";
    return "All";
}

function prettyGender(g: Gender) {
    return g;
}

function genderShort(g: Gender) {
    if (g === "Men") return "M";
    if (g === "Women") return "W";
    return "Mix";
}

export default function CategoryPicker({ value, onChange }: Props) {
    const selected = useMemo(() => new Set(value), [value]);

    const [genderFilter, setGenderFilter] = useState<GenderFilter>("All");
    const [group, setGroup] = useState<GroupKey>("All");
    const [query, setQuery] = useState("");
    const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);

    // Group accordions (collapsed by default for big groups)
    const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>({
        All: true,
        Junior: false,
        U19: false,
        U21: false,
        U23: false,
        Senior: false,
        Masters: false,
        Para: false,
    });

    const groups: GroupKey[] = ["All", "Junior", "U19", "U21", "U23", "Senior", "Masters", "Para"];

    const allowedGendersForDivision = (d: DivisionConfig): readonly Gender[] => {
        // default: Men/Women
        return d.genders ?? (["Men", "Women"] as const);
    };

    const visibleGendersForDivision = (d: DivisionConfig): readonly Gender[] => {
        const allowed = allowedGendersForDivision(d);
        if (genderFilter === "All") return allowed;
        return allowed.includes(genderFilter) ? ([genderFilter] as const) : ([] as const);
    };

    const filteredDivisions = useMemo(() => {
        const q = query.trim().toLowerCase();

        return (DIVISIONS as DivisionConfig[]).filter((d) => {
            const g = groupFromDivision(d.division);
            if (group !== "All" && g !== group) return false;
            if (q && !String(d.division).toLowerCase().includes(q)) return false;

            if (genderFilter !== "All") {
                const allowed = allowedGendersForDivision(d);
                if (!allowed.includes(genderFilter)) return false;
            }

            return true;
        });
    }, [group, query, genderFilter]);

    const divisionsByGroup = useMemo(() => {
        const map: Record<GroupKey, DivisionConfig[]> = {
            All: [],
            Junior: [],
            U19: [],
            U21: [],
            U23: [],
            Senior: [],
            Masters: [],
            Para: [],
        };

        for (const d of filteredDivisions as DivisionConfig[]) {
            const g = groupFromDivision(d.division);
            map[g].push(d);
        }
        return map;
    }, [filteredDivisions]);

    function toggle(cat: string) {
        const next = new Set(selected);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        onChange(Array.from(next));
    }

    function setAllGlobal(on: boolean) {
        if (!on) return onChange([]);
        const all: string[] = [];
        for (const d of DIVISIONS as DivisionConfig[]) {
            const genders = allowedGendersForDivision(d);
            for (const g of genders) {
                for (const bc of boatClassesForGender(d)) {
                    all.push(categoryKey(g, d.division, bc));
                }
            }
        }
        onChange(all);
    }

    function setDivisionAll(d: DivisionConfig, on: boolean) {
        const next = new Set(selected);
        const genders = visibleGendersForDivision(d);
        for (const g of genders) {
            for (const bc of boatClassesForGender(d)) {
                const cat = categoryKey(g, d.division, bc);
                if (on) next.add(cat);
                else next.delete(cat);
            }
        }
        onChange(Array.from(next));
    }

    function divisionCounts(d: DivisionConfig) {
        const genders = visibleGendersForDivision(d);
        let total = 0;
        let checked = 0;

        for (const g of genders) {
            for (const bc of boatClassesForGender(d)) {
                total += 1;
                if (selected.has(categoryKey(g, d.division, bc))) checked += 1;
            }
        }
        return { total, checked };
    }

    return (
        <div className="card" style={{ marginTop: 14 }}>
            <div className="space-between">
                <h3>Categories</h3>
                <div className="row">
                    <button type="button" className="btn-ghost" onClick={() => setAllGlobal(true)}>
                        Enable all
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setAllGlobal(false)}>
                        Disable all
                    </button>
                </div>
            </div>

            <p className="muted">Default is everything enabled — filter and tap to omit quickly.</p>

            {/* Controls */}
            <div className="card card--tight" style={{ marginTop: 12 }}>
                <div className="row">
                    {(["All", ...GENDERS] as const).map((g) => {
                        const active = genderFilter === g;
                        return (
                            <button
                                key={g}
                                type="button"
                                className={active ? "btn-primary" : "btn-ghost"}
                                onClick={() => setGenderFilter(g)}
                            >
                                {g === "All" ? "All" : prettyGender(g)}
                            </button>
                        );
                    })}
                </div>

                <div className="row" style={{ marginTop: 10 }}>
                    <select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)}>
                        {groups.map((k) => (
                            <option key={k} value={k}>
                                {k}
                            </option>
                        ))}
                    </select>

                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search divisions…" />
                </div>

                <label style={{ marginTop: 10 }}>
                    <div className="row" style={{ marginTop: 0 }}>
                        <input
                            type="checkbox"
                            checked={showOnlyEnabled}
                            onChange={(e) => setShowOnlyEnabled(e.target.checked)}
                            style={{ width: 18, height: 18 }}
                        />
                        <span>Show only enabled (within filters)</span>
                    </div>
                </label>
            </div>

            {/* Groups */}
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {groups
                    .filter((g) => group === "All" || g === group)
                    .filter((g) => g !== "All")
                    .filter((g) => divisionsByGroup[g].length > 0)
                    .map((g) => {
                        const list = divisionsByGroup[g];
                        const isOpen = openGroups[g];

                        return (
                            <div key={g} className="card card--tight">
                                <div className="space-between">
                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        onClick={() => setOpenGroups((p) => ({ ...p, [g]: !isOpen }))}
                                    >
                                        {isOpen ? "▾" : "▸"} {g}
                                    </button>

                                    <span className="badge">{list.length} divisions</span>
                                </div>

                                {isOpen && (
                                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                                        {list.map((d) => {
                                            const genders = visibleGendersForDivision(d);
                                            if (genders.length === 0) return null;

                                            const { total, checked } = divisionCounts(d);
                                            if (showOnlyEnabled && checked === 0) return null;

                                            return (
                                                <div key={String(d.division)} className="card card--tight">
                                                    <div className="space-between">
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>{d.division}</div>
                                                            <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                                                                {checked}/{total} enabled
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <button type="button" className="btn-ghost" onClick={() => setDivisionAll(d, true)}>
                                                                Enable
                                                            </button>
                                                            <button type="button" className="btn-ghost" onClick={() => setDivisionAll(d, false)}>
                                                                Disable
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Chips */}
                                                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                                                        {genders.map((gen) => (
                                                            <div key={gen}>
                                                                <div className="muted" style={{ fontWeight: 800, fontSize: 13 }}>
                                                                    {prettyGender(gen)}
                                                                </div>

                                                                <div className="row" style={{ marginTop: 8 }}>
                                                                    {d.boatClasses.map((bc) => {
                                                                        const cat = categoryKey(gen, d.division, bc);
                                                                        const on = selected.has(cat);

                                                                        // use your button styling; primary for "on"
                                                                        return (
                                                                            <button
                                                                                key={cat}
                                                                                type="button"
                                                                                className={on ? "btn-primary" : ""}
                                                                                onClick={() => toggle(cat)}
                                                                                aria-pressed={on}
                                                                            >
                                                                                {genderShort(gen)}{bc}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {showOnlyEnabled && list.every((d) => divisionCounts(d).checked === 0) && (
                                            <div className="muted" style={{ fontWeight: 700 }}>
                                                Nothing enabled in this group under current filters.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                {filteredDivisions.length === 0 && (
                    <div className="card card--tight">
                        <div className="muted">No divisions match your filters.</div>
                    </div>
                )}
            </div>

            {/* Bottom summary */}
            <div className="card card--tight" style={{ marginTop: 12 }}>
                <div className="space-between">
                    <div style={{ fontWeight: 800 }}>
                        Enabled categories <span className="badge badge--brand">{value.length}</span>
                    </div>

                    <div className="row">
                        <button type="button" className="btn-ghost" onClick={() => setAllGlobal(false)}>
                            Clear
                        </button>
                        <button type="button" className="btn-primary" onClick={() => setAllGlobal(true)}>
                            Enable all
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
