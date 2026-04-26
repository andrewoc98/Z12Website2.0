export type BoatStatus = "registered" | "in_progress" | "finished";

export type BoatTimingDoc = {
    id: string;
    eventId: string;
    bowNumber: number;
    boatSize: number;
    category: string;
    categoryId: string;
    categoryName: string;
    clubName: string;
    rowerUids: string[];
    status: BoatStatus;
    activeRunId: string | null;
    startedAt: number | null; // Unix ms timestamp
    finishedAt: number | null; // Unix ms timestamp
    elapsedMs: number | null;
    adjustmentMs: number; // time adjustment in ms
    inviteCode: string | null;
    invitedEmails: string[];
    createdAt: any; // Timestamp
    updatedAt: any; // Timestamp
};

export type PlaceholderFinish = {
    id: string;
    eventId: string;
    finishedAt: number; // Unix ms timestamp
    bowNumber?: number; // optional, if assigned later
    createdAt: any;
};