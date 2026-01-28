export type Role = "rower" | "host" | "admin" | "coach";
export type Gender = "male" | "female";

export type UserProfile = {
    uid: string;

    email: string;
    displayName: string;

    fullName?: string;

    primaryRole?: Role;

    gender: Gender;
    dateOfBirth: string; // "YYYY-MM-DD"

    birthYear?: number;
    ageGroup?: "junior" | "u19" | "u21" | "u23" | "senior" | "masters";

    roles: {
        rower?: {
            club: string;
            coachId?: string;
        };
        coach?: {
            club: string;
        };
        host?: {
            name?: string;
            email?: string;
            location: string;
        };
        admin?: {
            name: string;
            email: string;
            hostId: string;
        };
    };
};

export type AdminInvite = {
    id: string;
    used: boolean;
};
