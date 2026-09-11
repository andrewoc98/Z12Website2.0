import type {EventDoc, EventSeriesType, EventType} from "../types.ts";

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

// ── Event type ────────────────────────────────────────────────────────────────

/**
 * Reads an event's type. Events created before erg support have no `eventType`
 * field, so absent means open water — always go through this rather than
 * reading `e.eventType` directly.
 */
export function eventTypeOf(e: Pick<EventDoc, "eventType">): EventType {
    return e.eventType ?? "open_water";
}

export function isErgEvent(e: Pick<EventDoc, "eventType">): boolean {
    return eventTypeOf(e) === "erg";
}

// ── Category ids ──────────────────────────────────────────────────────────────

/**
 * Category ids are their own display label, split on "•".
 * Open water: "Men • Senior 70kg • 1x"   (gender, division, boat class)
 * Erg:        "Men • Senior 70kg"        (no boat class — there is no boat)
 */
export function parseCategoryParts(
    cat: string,
): { gender: string; division: string; boatClass?: string } | null {
    if (!cat) return null;
    const parts = cat.split("•").map((s) => s.trim());
    if (parts.length === 3) return { gender: parts[0], division: parts[1], boatClass: parts[2] };
    if (parts.length === 2) return { gender: parts[0], division: parts[1] };
    return null;
}

/** Erg category id — the open-water key with the boat-class segment dropped. */
export function ergCategoryKey(gender: Gender, division: Division) {
    return `${gender} • ${division}`;
}

/**
 * Every erg category, reusing the open-water division taxonomy. Genders come
 * from the division config (60kg is women-only, 80kg men-only, Para is Mixed);
 * boat classes are ignored because an erg event has none.
 *
 * Unlike buildDefaultCategories these are NOT pre-selected — a host picks the
 * handful of classes their event actually runs.
 */
export function buildErgCategories(): string[] {
    const out: string[] = [];
    for (const d of DIVISIONS) {
        const allowedGenders = d.genders ?? (["Men", "Women"] as const);
        for (const g of allowedGenders) {
            out.push(ergCategoryKey(g, d.division));
        }
    }
    return out;
}

// ── Eligibility ───────────────────────────────────────────────────────────────
// Shared by the event page and the legacy signup page. Works for both 2-segment
// erg categories and 3-segment open-water ones.

export type EligibilityProfile = {
    dateOfBirth?: string;
    gender?: "male" | "female";
};

export function todayYMD(): string {
    return new Date().toISOString().slice(0, 10);
}

export function ageOnDate(dobYmd: string, onYmd: string): number {
    const [y, m, d] = dobYmd.split("-").map(Number);
    const [yy, mm, dd] = onYmd.split("-").map(Number);
    let age = yy - y;
    if (mm < m || (mm === m && dd < d)) age -= 1;
    return age;
}

export function juniorLimitFromDivision(division: string): number | null {
    const m = division.match(/^Junior\s+(\d{1,2})$/i);
    return m ? Number(m[1]) : null;
}

export function mastersBandFromDivision(division: string): { min: number; max: number | null } | null {
    const m = division.match(/^Masters(?:\s+([A-K]))?/i);
    if (!m) return { min: 27, max: null };
    const band = (m[1] ?? "").toUpperCase();
    const bands: Record<string, { min: number; max: number | null }> = {
        A: { min: 27, max: 35 }, B: { min: 36, max: 42 }, C: { min: 43, max: 49 },
        D: { min: 50, max: 54 }, E: { min: 55, max: 59 }, F: { min: 60, max: 64 },
        G: { min: 65, max: 69 }, H: { min: 70, max: 74 }, I: { min: 75, max: 79 },
        J: { min: 80, max: 84 }, K: { min: 85, max: null },
    };
    return bands[band] ?? { min: 27, max: null };
}

export function isEligibleForCategory(profile: EligibilityProfile, catName: string): boolean {
    const parts = parseCategoryParts(catName);
    if (!parts || !profile.dateOfBirth || !profile.gender) return false;

    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;

    if (parts.gender === "Men" && profile.gender !== "male") return false;
    if (parts.gender === "Women" && profile.gender !== "female") return false;

    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;

    const juniorLimit = juniorLimitFromDivision(div);
    if (juniorLimit !== null && age >= juniorLimit) return false;

    if (div.startsWith("Masters")) {
        const band = mastersBandFromDivision(div);
        if (!band) return false;
        if (age < band.min) return false;
        if (band.max !== null && age > band.max) return false;
    }

    return true;
}

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

// Divisions that race 3000m instead of the standard 6000m at National Events.
// Add entries here as rules change — no other code needs updating.
const NATIONAL_EVENT_SHORT_DISTANCE_DIVISIONS = new Set<string>([
    "Junior 14",
    "Junior 15",
    "Junior 16",
]);

export function parseDivisionFromCategory(cat: string): string | null {
    return parseCategoryParts(cat)?.division ?? null;
}

export function isShortDistanceNationalCategory(categoryId: string): boolean {
    const division = parseDivisionFromCategory(categoryId);
    if (!division) return false;
    return NATIONAL_EVENT_SHORT_DISTANCE_DIVISIONS.has(division) || division.startsWith("Masters ");
}

export function getCategoryRaceMeters(
    categoryId: string,
    seriesType: EventSeriesType | "" | undefined,
    eventLengthMeters: number,
): number {
    if (seriesType === "national_event" && isShortDistanceNationalCategory(categoryId)) {
        return 3000;
    }
    return eventLengthMeters;
}

export function parseBoatClassFromCategory(cat: string): BoatClass | null {
    const boat = parseCategoryParts(cat)?.boatClass;
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

export function getEventStatus(e: EventDoc): "open" | "closed" | "running" | "finished" {
    const now = new Date();

    const start = e.startDate ? new Date(e.startDate) : null;
    const end = e.endDate ? new Date(e.endDate) : null;
    const close = e.closingDate ? new Date(e.closingDate) : null;

    // Finished: after end date
    if (end && now > end) return "finished";

    // Running: between start and end
    if (start && end && now >= start && now <= end) return "running";

    // Before the event runs, the host's manual switch outranks the closing date;
    // see lib/registration.ts.
    if (e.registrationOpen === false) return "closed";
    if (e.registrationOpen === true) return "open";

    // Closed: after closing date but before start
    if (close && now > close) return "closed";

    return "open";
}

export function formatDate(dateStr?: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: "medium",
    });
}