export type Gender = "Men" | "Women" | "Mixed";
export type BoatClass = "1x" | "2x" | "2-" | "4x+";

const WEIGHT_ORDER: readonly WeightClass[] = [
    "60kg",
    "70kg",
    "80kg",
    "Open",
] as const;


// Keep ages as-is
export type JuniorDivision = "Junior 14" | "Junior 15" | "Junior 16";

// Make “base division” separate from weight
export type AgeBand = "U19" | "U21" | "U23" | "Senior";
export type MastersBand = "A" | "B" | "C" | "D" | "E" | "F";

export type WeightClass = "60kg" | "70kg" | "80kg" | "Open";

export type Division =
    | JuniorDivision
    | `${AgeBand} ${WeightClass}`
    | `Masters ${MastersBand} ${WeightClass}`
    | "Para";

export const GENDERS: Gender[] = ["Men", "Women", "Mixed"];

export type DivisionConfig = {
    division: Division;
    boatClasses: readonly BoatClass[];
    genders?: readonly Gender[];
};

const MEN_WOMEN = ["Men", "Women"] as const;
const MEN_ONLY = ["Men"] as const;
const WOMEN_ONLY = ["Women"] as const;
const BOAT_SWEEP: readonly BoatClass[] = ["1x", "2-"] as const;
const BOAT_JUNIOR_14_15: readonly BoatClass[] = ["4x+", "2x"] as const;
const BOAT_JUNIOR_16: readonly BoatClass[] = ["1x", "2x"] as const;

const MASTERS_BOAT_CLASSES = ["1x", "2x", "4x+", "2-"] as const satisfies readonly BoatClass[];

const AGE_BANDS: readonly AgeBand[] = ["U19", "U21", "U23", "Senior"] as const;
const MASTERS_BANDS: readonly MastersBand[] = ["A", "B", "C", "D", "E", "F"] as const;

function gendersForWeight(w: WeightClass) {
    if (w === "60kg") return WOMEN_ONLY;
    if (w === "80kg") return MEN_ONLY;
    return MEN_WOMEN;
}

function buildWeightedDivisions(): DivisionConfig[] {
    const out: DivisionConfig[] = [];

    for (const band of AGE_BANDS) {
        for (const w of WEIGHT_ORDER) {
            const genders = gendersForWeight(w);
            if (!genders.length) continue;

            out.push({
                division: `${band} ${w}` as const,
                boatClasses: BOAT_SWEEP,
                genders,
            });
        }
    }

    return out;
}


function buildMastersDivisions(): DivisionConfig[] {
    const out: DivisionConfig[] = [];

    for (const band of MASTERS_BANDS) {
        for (const w of WEIGHT_ORDER) {
            out.push({
                division: `Masters ${band} ${w}` as const,
                boatClasses: MASTERS_BOAT_CLASSES,
                genders: gendersForWeight(w),
            });
        }
    }

    return out;
}


export const DIVISIONS: DivisionConfig[] = [
    { division: "Junior 14", boatClasses: BOAT_JUNIOR_14_15 },
    { division: "Junior 15", boatClasses: BOAT_JUNIOR_14_15 },
    { division: "Junior 16", boatClasses: BOAT_JUNIOR_16 },

    ...buildWeightedDivisions(),
    ...buildMastersDivisions(),

    { division: "Para", boatClasses: ["4x+", "2x"] as const, genders: ["Mixed"] as const },
];

/** Display label stored for now */
export function categoryKey(gender: Gender, division: Division, boatClass: BoatClass) {
    return `${gender} • ${division} • ${boatClass}`;
}

export function buildDefaultCategories(): string[] {
    const out: string[] = [];
    for (const d of DIVISIONS) {
        const allowedGenders = d.genders ?? (["Men", "Women"] as const);
        for (const g of allowedGenders) {
            for (const bc of d.boatClasses) {
                out.push(categoryKey(g, d.division, bc));
            }
        }
    }
    return out;
}

export function parseBoatClassFromCategory(cat: string): BoatClass | null {
    if (!cat) return null;
    const parts = cat.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;
    const boat = parts[2];
    if (boat === "1x" || boat === "2x" || boat === "2-" || boat === "4x+") return boat;
    return null;
}

export type BoatSize = 1 | 2 | 4;

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
            throw new Error(`Unknown boat class: ${bc}`);
    }
}
