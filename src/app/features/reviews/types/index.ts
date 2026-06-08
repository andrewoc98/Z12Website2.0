export type ReviewDoc = {
    id?: string;
    eventId: string;
    reviewerId: string;
    hostId: string;
    rating: number;
    comment?: string;
    createdAt: any;
};
