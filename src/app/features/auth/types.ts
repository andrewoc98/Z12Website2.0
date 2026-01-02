export type Role = "rower" | "host" | "admin";

export type UserProfile = {
    uid?: string;

    email: string;

    // Always persist this
    fullName: string;
    displayName: string;

    // What they signed up as (don’t let client set admin)
    primaryRole: "rower" | "host";

    roles: {
        rower?: { club: string; coach?: string };
        host?: { location: string };
        admin?: { hostId: string }; // set by server/admin later
    };

    createdAt?: unknown;
    updatedAt?: unknown;
};
