export type Role = "rower" | "host" | "admin";

export type UserProfile = {
    email: string;
    displayName: string;
    roles: {
        rower?: { club: string; coach: string };
        host?: { name: string; email: string; location: string };
        admin?: { name: string; email: string; hostId: string };
    };
};
