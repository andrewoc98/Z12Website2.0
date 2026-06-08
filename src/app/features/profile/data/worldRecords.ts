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
        description: "Open heavyweight men",
        records: {
            best100m:   12.4,    // 12.4s
            best500m:   69.8,    // 1:09.8
            best2000m:  334.7,   // 5:34.7
            best6000m:  1084.7,  // 18:04.7
            best10000m: 1865.2,  // 31:05.2
        },
    },
    male_lightweight: {
        label: "Men's Lightweight",
        description: "Men under 75 kg (senior)",
        records: {
            best100m:   13.4,    // 13.4s
            best500m:   77.4,    // 1:17.4
            best2000m:  356.7,   // 5:56.7
            best6000m:  1156,    // 19:16.0
            best10000m: 1969.6,  // 32:49.6
        },
    },
    male_junior: {
        label: "Men's Junior",
        description: "Men under 19",
        records: {
            best100m:   13.1,    // 13.1s
            best500m:   73.5,    // 1:13.5
            best2000m:  345.5,   // 5:45.5
            best6000m:  1124.5,  // 18:44.5
            best10000m: 1944.9,  // 32:24.9
        },
    },
    female_senior: {
        label: "Women's Senior",
        description: "Open heavyweight women",
        records: {
            best100m:   14.6,    // 14.6s
            best500m:   84.5,    // 1:24.5
            best2000m:  381.1,   // 6:21.1
            best6000m:  1217.7,  // 20:17.7
            best10000m: 2133,    // 35:33.0
        },
    },
    female_lightweight: {
        label: "Women's Lightweight",
        description: "Women under 61.5 kg",
        records: {
            best100m:   16.4,    // 16.4s
            best500m:   93.2,    // 1:33.2
            best2000m:  413.8,   // 6:53.8
            best6000m:  1304,    // 21:44.0
            best10000m: 2263.9,  // 37:43.9
        },
    },
    female_junior: {
        label: "Women's Junior",
        description: "Women under 19",
        records: {
            best100m:   16.1,    // 16.1s
            best500m:   85.3,    // 1:25.3
            best2000m:  388.2,   // 6:28.2
            best6000m:  1274.7,  // 21:14.7
            best10000m: 2201.2,  // 36:41.2
        },
    },
};

/** Lightweight weight thresholds in kg */
export const LIGHTWEIGHT_THRESHOLD_KG = {
    male: 75,
    female: 61.5,
} as const;
