export type Gender = "Men" | "Women" | "Mixed";
export type BoatClass = "1x" | "2x" | "2-" | "4x+";
export type Division =
    | "Junior 14"
    | "Junior 15"
    | "Junior 16"
    | "U19 70kgs"
    | "U19 80kgs"
    | "U19 Open"
    | "U21 70kgs"
    | "U21 80kgs"
    | "U21 Open"
    | "U23 70kg"
    | "U23 80kgs"
    | "U23 Open"
    | "Senior 70kgs"
    | "Senior 80kgs"
    | "Senior Open"
    | `Masters ${"A" | "B" | "C" | "D" | "E" | "F"} ${"70kgs" | "80kgs" | "Open"}`
    | "Para";

export const GENDERS: Gender[] = ["Men", "Women", "Mixed"];

export type DivisionConfig = {
    division: Division;
    boatClasses: readonly BoatClass[];
    /** If omitted: defaults to Men/Women (and Mixed too if you want). If set: restrict to these genders. */
    genders?: readonly Gender[];
};

const MASTERS_BANDS = ["A", "B", "C", "D", "E", "F"] as const;
const MASTERS_WEIGHTS = ["70kgs", "80kgs", "Open"] as const;
const MASTERS_BOAT_CLASSES = ["1x", "2x", "4x+", "2-"] as const satisfies readonly BoatClass[];

const BASE_DIVISIONS: readonly DivisionConfig[] = [
    { division: "Junior 14", boatClasses: ["4x+", "2x"] as const },
    { division: "Junior 15", boatClasses: ["4x+", "2x"] as const },
    { division: "Junior 16", boatClasses: ["1x", "2x"] as const },

    { division: "U19 70kgs", boatClasses: ["1x", "2-"] as const },
    { division: "U19 80kgs", boatClasses: ["1x", "2-"] as const },
    { division: "U19 Open", boatClasses: ["1x", "2-"] as const },

    { division: "U21 70kgs", boatClasses: ["1x", "2-"] as const },
    { division: "U21 80kgs", boatClasses: ["1x", "2-"] as const },
    { division: "U21 Open", boatClasses: ["1x", "2-"] as const },

    { division: "U23 70kg", boatClasses: ["1x", "2-"] as const },
    { division: "U23 80kgs", boatClasses: ["1x", "2-"] as const },
    { division: "U23 Open", boatClasses: ["1x", "2-"] as const },

    { division: "Senior 70kgs", boatClasses: ["1x", "2-"] as const },
    { division: "Senior 80kgs", boatClasses: ["1x", "2-"] as const },
    { division: "Senior Open", boatClasses: ["1x", "2-"] as const },

    // ✅ Para is Mixed only
    { division: "Para", boatClasses: ["4x+", "2x"] as const, genders: ["Mixed"] as const },
];

const MASTERS_DIVISIONS: DivisionConfig[] = MASTERS_BANDS.flatMap((band) =>
    MASTERS_WEIGHTS.map((w) => ({
        division: `Masters ${band} ${w}` as const,
        boatClasses: MASTERS_BOAT_CLASSES,
        // (optional) set genders here if Masters should also be Mixed; otherwise omit
    }))
);

export const DIVISIONS: DivisionConfig[] = [...BASE_DIVISIONS, ...MASTERS_DIVISIONS];

/** Display label stored for now */
export function categoryKey(gender: Gender, division: Division, boatClass: BoatClass) {
    return `${gender} • ${division} • ${boatClass}`;
}

/** Default enabled categories: all combos, respecting per-division genders */
export function buildDefaultCategories(): string[] {
    const out: string[] = [];
    for (const d of DIVISIONS) {
        const allowedGenders = d.genders ?? (["Men", "Women"] as const); // 👈 default rule
        for (const g of allowedGenders) {
            for (const bc of d.boatClasses) {
                out.push(categoryKey(g, d.division, bc));
            }
        }
    }
    return out;
}

export type BoatClass = "1x" | "2x" | "2-" | "4x+";

/**
 * Extract the boat class from a category string like:
 * "Men • Senior Open • 1x"
 */
export function parseBoatClassFromCategory(cat: string): BoatClass | null {
    if (!cat) return null;

    const parts = cat.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;

    const boat = parts[2];

    if (boat === "1x" || boat === "2x" || boat === "2-" || boat === "4x+") {
        return boat;
    }

    return null;
}

export type BoatSize = 1 | 2 | 4;

/**
 * Convert a boat class into crew size
 */
export function boatSizeFromBoatClass(bc: BoatClass): BoatSize {
    switch (bc) {
        case "1x":
            return 1;
        case "2x":
        case "2-":
            return 2;
        case "4x+":
            return 4;
        default:
            // Exhaustive safety for future changes
            throw new Error(`Unknown boat class: ${bc}`);
    }
}

