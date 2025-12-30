export type EventDoc = {
    hostId: string; // for now: use uid as hostId
    name: string;
    description: string;
    location: string;
    startDate: string;   // YYYY-MM-DD
    endDate: string;     // YYYY-MM-DD
    closingDate: string; // YYYY-MM-DD
    lengthMeters: number;
    categories: string[];
    status: "draft" | "open" | "closed" | "running" | "finished";
    createdAt?: any;
};
