export type EventStatus = "draft" | "open" | "closed" | "running" | "finished";

export type EventCategory = {
    id: string;
    name: string;
};

export type EventDoc = {
    name: string;
    description: string;
    location: string;

    startAt: unknown;
    endAt: unknown;
    closeAt: unknown;

    lengthMeters: number;

    categories: EventCategory[];

    status: EventStatus;

    createdByUid: string;
    createdByName: string;

    createdAt?: unknown;
    updatedAt?: unknown;
};
