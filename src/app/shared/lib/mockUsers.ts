// ----------------------------------
// Roles
// ----------------------------------
export type MockRole = "rower" | "host" | "admin";

export type Gender = "male" | "female";

// ----------------------------------
// Mock user profile (mirrors UserProfile)
// ----------------------------------
export type MockUser = {
    uid: string;
    email: string;
    displayName: string;

    primaryRole: MockRole;

    gender?: Gender;
    dateOfBirth?: string; // YYYY-MM-DD
    birthYear?: number;

    roles: {
        rower?: {
            club: string;
            coach?: string;
        };
        host?: {
            location: string;
        };
        admin?: {
            // admins are timers only
            name: string;
            email: string;
        };
    };
};

// ----------------------------------
// Mock users
// ----------------------------------
export const MOCK_USERS: Record<MockRole, MockUser> = {
    rower: {
        uid: "mock-rower-uid",
        email: "rower@test.com",
        displayName: "Rory Rower",
        primaryRole: "rower",

        // eligibility fields
        gender: "male",
        dateOfBirth: "2006-03-12", // age depends on current date
        birthYear: 2006,

        roles: {
            rower: {
                club: "Z12 RC",
                coach: "Coach A",
            },
        },
    },

    host: {
        uid: "mock-host-uid",
        email: "host@test.com",
        displayName: "Hannah Host",
        primaryRole: "host",

        // hosts do NOT need eligibility fields
        roles: {
            host: {
                location: "Boston, MA",
            },
        },
    },

    admin: {
        uid: "mock-admin-uid",
        email: "admin@test.com",
        displayName: "Adam Admin",
        primaryRole: "admin",

        roles: {
            admin: {
                name: "Adam Admin",
                email: "admin@test.com",
            },
        },
    },
};
