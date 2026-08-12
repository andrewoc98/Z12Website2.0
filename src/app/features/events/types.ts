import type {BoatDoc} from "../signup/types.ts";

export type EventStatus = "draft" | "open" | "closed" | "running" | "finished" | "cancelled";

export type EventSeriesType = "regional_series" | "national_series" | "national_event";

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
    status: "draft" | "open" | "closed" | "running" | "finished" | "cancelled";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    federationId?: string;
    seriesType?: EventSeriesType;
    seriesGroupId?: string;
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
    status: "draft" | "open" | "closed" | "running" | "finished" | "cancelled";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    federationId?: string;
    seriesType?: EventSeriesType;
    seriesGroupId?: string;
    createdByName?: string;
    createdByUid: string;
    categories: EventCategory[];
    resultsPublishMode:
        | "live"
        | "category_complete"
        | "manual";
    boats: BoatDoc
};