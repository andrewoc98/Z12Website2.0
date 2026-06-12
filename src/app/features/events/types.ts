import type {BoatDoc} from "../signup/types.ts";

export type EventStatus = "draft" | "open" | "closed" | "running" | "finished";

export type EventCategory = {
    id: string;
    name: string;
};

export type EventDoc = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    closingDate?: string;
    status: "draft" | "open" | "closed" | "running" | "finished";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    createdByUid?: string;
    createdByName?: string;
    categories: EventCategory[];
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
    status: "draft" | "open" | "closed" | "running" | "finished";
    location: string;
    description?: string;
    lengthMeters: number;
    clubId?: string;
    createdByName?: string;
    createdByUid: string;
    categories: EventCategory[];
    resultsPublishMode:
        | "live"
        | "category_complete"
        | "manual";
    boats: BoatDoc
};