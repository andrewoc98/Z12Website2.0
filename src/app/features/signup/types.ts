export type BoatSize = 1 | 2 | 4 | 8;

export type BoatDoc = {
    id?: string;
    eventId: string;
    category: string;
    clubName: string;
    boatSize: BoatSize;

    // rowers (mock)
    rowerUids: string[];       // confirmed members
    invitedEmails: string[];   // pending invites (future)

    bowNumber?: number;        // assigned when registration closes
    createdAt?: number;
};
