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
    createdByUid?: string;
    createdByName?: string;
    categories: EventCategory[];
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
    createdByName?: string;
    createdByUid: string;
    categories: EventCategory[];
};