export type EventStatus = "draft" | "open" | "closed" | "running" | "finished";

export type EventDoc = {
    id?: string;
    hostId: string;
    name: string;
    description: string;
    location: string;
    startDate: string;   // YYYY-MM-DD
    endDate: string;     // YYYY-MM-DD
    closingDate: string; // YYYY-MM-DD
    lengthMeters: number;
    categories: string[];
    status: EventStatus;
    createdAt?: number;
};
