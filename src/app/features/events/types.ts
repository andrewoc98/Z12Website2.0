import type {BoatDoc} from "../signup/types.ts";

export type EventStatus = "draft" | "open" | "closed" | "running" | "finished" | "cancelled";

export type EventSeriesType = "regional_series" | "national_series" | "national_event";

export const SERIES_LENGTH_METERS: Record<EventSeriesType, number> = {
    regional_series: 3000,
    national_series: 6000,
    national_event:  6000,
};

export type EventCategory = {
    id: string;
    name: string;
    feeCents?: number;  // entry fee in cents; absent or 0 = free registration
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