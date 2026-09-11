import type {BoatDoc} from "../signup/types.ts";

export type EventStatus = "draft" | "open" | "closed" | "running" | "finished" | "cancelled";

export type EventSeriesType = "regional_series" | "national_series" | "national_event";

// Open-water races and indoor erg events are the two kinds of event a host can
// create. `eventType` is optional and absent means "open_water", so every event
// created before erg support existed reads correctly with no backfill.
export type EventType = "open_water" | "erg";

// Per-event erg configuration. Kept as a nested object rather than loose fields
// so adding 500m / 5k / 60min later widens these unions and touches nothing else.
export type ErgConfig = {
    machineType: "rower";     // matches Concept2 result.type; RowErg only for now
    distanceMeters: 2000;
};

export const DEFAULT_ERG_CONFIG: ErgConfig = { machineType: "rower", distanceMeters: 2000 };

// Countries where Stripe Connect onboarding and paid events are supported.
// Add new country codes here as support is rolled out.
export const STRIPE_SUPPORTED_COUNTRIES = new Set(["US"]);

export const SERIES_LENGTH_METERS: Record<EventSeriesType, number> = {
    regional_series: 3000,
    national_series: 3000,
    national_event:  6000,
};

export type EventCategory = {
    id: string;
    name: string;
    feeCents?: number;       // entry fee in cents; absent or 0 = free registration
    lengthMeters?: number;   // per-category override; absent means use event-level lengthMeters
};

export type EventDoc = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    closingDate?: string;
    // A water event the host chose to run without a registration deadline. The
    // stored closeAt is the event end in that case, so every date-driven
    // consumer keeps working; this flag is what the UI reads to say
    // "open until the event" rather than printing that date as a deadline.
    noClosingDate?: boolean;
    // The host's manual registration switch. Absent means "follow the dates",
    // which is every event created before the switch existed. See
    // lib/registration.ts for the exact precedence.
    registrationOpen?: boolean;
    status: "draft" | "open" | "closed" | "running" | "finished" | "cancelled";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    federationId?: string;
    seriesType?: EventSeriesType;
    seriesGroupId?: string;
    eventType?: EventType;    // absent === "open_water"
    ergConfig?: ErgConfig;    // present iff eventType === "erg"
    createdByUid?: string;
    createdByName?: string;
    hostId?: string;
    categories: EventCategory[];
    excludedBowNumbers?: number[];
    resultsPublishMode:
        | "live"
        | "category_complete"
        | "manual";
    boats?: BoatDoc
};


// A /payments/{id} doc as written by the Stripe fulfillment functions.
// Athlete payments cover one boat (boatId); coach bulk payments cover several (boatIds).
export type EventPayment = {
    id: string;
    eventId: string;
    eventName?: string;
    boatId?: string;
    boatIds?: string[];
    payerId: string;
    hostId: string | null;
    stripePaymentIntentId: string;
    eventFeeCents: number;
    processingFeeCents: number;
    totalChargedCents: number;
    status: "held" | "succeeded" | "refunded" | "disputed";
    createdAt: any; // Timestamp
};

export type FirestoreEventDoc = {
    name: string;
    startAt: any;   // Timestamp
    endAt: any;     // Timestamp
    closeAt?: any;  // Timestamp
    noClosingDate?: boolean;   // water event run without a registration deadline
    registrationOpen?: boolean; // host's manual switch; absent === follow the dates
    status: "draft" | "open" | "closed" | "running" | "finished" | "cancelled";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    federationId?: string;
    seriesType?: EventSeriesType;
    seriesGroupId?: string;
    eventType?: EventType;    // absent === "open_water"
    ergConfig?: ErgConfig;    // present iff eventType === "erg"
    createdByName?: string;
    createdByUid: string;
    categories: EventCategory[];
    resultsPublishMode:
        | "live"
        | "category_complete"
        | "manual";
    boats: BoatDoc
};

// ── Indoor erg scores ─────────────────────────────────────────────────────────

export type ErgScoreStatus =
    | "ranked"          // Concept2-verified, in window, right distance/machine
    | "unverified"      // Concept2 verified=false; shown to the athlete, never ranked
    | "ineligible"      // wrong distance/machine/date, or implausibly fast
    | "disqualified";   // host action

// One imported Concept2 result, at /events/{eventId}/ergScores/{uid}__{c2ResultId}.
// Written only by Cloud Functions — see firestore.rules.
export type ErgScoreDoc = {
    id: string;
    eventId: string;
    entryId: string;          // the /events/{eventId}/boats/{boatId} entry
    uid: string;
    categoryId: string;
    categoryName: string;
    clubName: string;

    source: "concept2";
    c2ResultId: number;
    c2UserId: number;

    machineType: string;
    workoutType: string;
    distanceMeters: number;
    timeTenths: number;
    timeMs: number;           // what the leaderboard sorts on
    strokeRate?: number;
    avgHeartRate?: number;

    workoutAt: any;           // Timestamp
    c2Verified: boolean;

    status: ErgScoreStatus;
    ineligibleReason?: string;
    disqualifiedReason?: string;
    disqualifiedBy?: string;
    disqualifiedAt?: any;     // Timestamp

    importedAt: any;          // Timestamp
};

// Denormalised best-score fields the Cloud Functions write back onto an erg
// entry, so ranking an event costs no reads beyond the entries themselves.
export type ErgEntryFields = {
    ergBestTimeMs?: number | null;
    ergBestScoreId?: string | null;
    ergScoreCount?: number;
    ergLastSyncAt?: any;      // Timestamp
};

// The public mirror of a user's Concept2 link, on /users/{uid}.
export type Concept2LinkState = {
    linked: boolean;
    username: string;
    linkedAt: any;            // Timestamp
};
