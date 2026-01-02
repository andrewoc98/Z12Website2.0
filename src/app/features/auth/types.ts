export type Role = "rower" | "host" | "admin";

export type Gender = "male" | "female";

export type UserProfile = {
    email: string;
    displayName: string;

    gender: Gender;
    dateOfBirth: string; // "YYYY-MM-DD"

    birthYear?: number;
    ageGroup?: "junior" | "u19" | "u21" | "u23" | "senior" | "masters";

    roles: {
        rower?: { club: string; coach: string };
        host?: { name: string; email: string; location: string };
        admin?: { name: string; email: string; hostId: string };
    };
};

