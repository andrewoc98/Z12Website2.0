/**
 * Concept2 Indoor Rowing World Records by category and distance.
 * All times are in seconds. Update values here as records are broken.
 *
 * Lightweight thresholds used when resolving a user's category:
 *   Men: weightKg < 75
 *   Women: weightKg < 61.5
 *
 * Age-group boundaries (approximate, matches Concept2 / World Rowing):
 *   junior:  < 19
 *   u21:     19–20
 *   u23:     21–22
 *   senior:  23–26  (or no ageGroup set)
 *   masters: 27+
 */

export type DistanceKey = "best100m" | "best500m" | "best2000m" | "best6000m" | "best10000m";

export interface WorldRecordEntry {
    /** Short display label shown in the tooltip header */
    label: string;
    /** Human-readable eligibility description */
    description: string;
    /** Times in seconds; null = no official record for this distance */
    records: Record<DistanceKey, number | null>;
}

export const WORLD_RECORDS: Record<string, WorldRecordEntry> = {
    male_senior: {
        label: "Men's Senior",
        description: "Open heavyweight men (23+)",
        records: {
            best100m: 12.9,
            best500m: 69.7,
            best2000m: 335.8,
            best6000m: 1131.7,
            best10000m: 1929.2,
        },
    },
    male_lightweight: {
        label: "Men's Lightweight",
        description: "Men under 75 kg (senior/u23)",
        records: {
            best100m: 13.8,
            best500m: 74.1,
            best2000m: 364.7,
            best6000m: 1192.4,
            best10000m: 2033.9,
        },
    },
    male_u23: {
        label: "Men's U23",
        description: "Men aged 21–22",
        records: {
            best100m: 13.2,
            best500m: 70.8,
            best2000m: 342.0,
            best6000m: 1148.0,
            best10000m: 1956.0,
        },
    },
    male_u21: {
        label: "Men's U21",
        description: "Men aged 19–20",
        records: {
            best100m: 13.5,
            best500m: 72.5,
            best2000m: 351.0,
            best6000m: 1168.0,
            best10000m: 1980.0,
        },
    },
    male_junior: {
        label: "Men's Junior",
        description: "Men under 19",
        records: {
            best100m: 13.9,
            best500m: 74.5,
            best2000m: 360.6,
            best6000m: 1182.5,
            best10000m: 2010.0,
        },
    },
    female_senior: {
        label: "Women's Senior",
        description: "Open heavyweight women (23+)",
        records: {
            best100m: 14.7,
            best500m: 82.0,
            best2000m: 381.3,
            best6000m: 1282.0,
            best10000m: 2202.9,
        },
    },
    female_lightweight: {
        label: "Women's Lightweight",
        description: "Women under 61.5 kg (senior/u23)",
        records: {
            best100m: 15.5,
            best500m: 87.0,
            best2000m: 418.8,
            best6000m: 1376.8,
            best10000m: 2338.3,
        },
    },
    female_u23: {
        label: "Women's U23",
        description: "Women aged 21–22",
        records: {
            best100m: 15.0,
            best500m: 83.5,
            best2000m: 390.0,
            best6000m: 1305.0,
            best10000m: 2240.0,
        },
    },
    female_u21: {
        label: "Women's U21",
        description: "Women aged 19–20",
        records: {
            best100m: 15.4,
            best500m: 85.5,
            best2000m: 400.0,
            best6000m: 1328.0,
            best10000m: 2268.0,
        },
    },
    female_junior: {
        label: "Women's Junior",
        description: "Women under 19",
        records: {
            best100m: 15.8,
            best500m: 88.0,
            best2000m: 427.7,
            best6000m: 1440.0,
            best10000m: 2430.0,
        },
    },
};

/** Lightweight weight thresholds in kg */
export const LIGHTWEIGHT_THRESHOLD_KG = {
    male: 75,
    female: 61.5,
} as const;
