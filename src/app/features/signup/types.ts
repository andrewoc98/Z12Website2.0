export type BoatSize = 1 | 2 | 4 | 8;

export type BoatDoc = {
    id?: string;

    eventId: string;

    categoryId: string;
    categoryName: string;


    category?: string;

    clubName: string;
    boatSize: BoatSize;

    rowerUids: string[];
    invitedEmails: string[];

    inviteCode?: string | null;
    status?: "pending_crew" | "registered";

    bowNumber?: number;
    createdAt?: number;

    startedAt?: number;
    finishedAt?: number;
};
