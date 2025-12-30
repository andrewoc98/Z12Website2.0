export type MockRole = "rower" | "host" | "admin";

export type MockUser = {
    uid: string;
    email: string;
    displayName: string;
    roles: {
        rower?: { club: string; coach: string };
        host?: { name: string; email: string; location: string };
        admin?: { name: string; email: string; hostId: string };
    };
};

export const MOCK_USERS: Record<MockRole, MockUser> = {
    rower: {
        uid: "mock-rower-uid",
        email: "rower@test.com",
        displayName: "Rory Rower",
        roles: {
            rower: { club: "Z12 RC", coach: "Coach A" },
        },
    },

    host: {
        uid: "mock-host-uid",
        email: "host@test.com",
        displayName: "Hannah Host",
        roles: {
            host: {
                name: "Hannah Host",
                email: "host@test.com",
                location: "Boston, MA",
            },
        },
    },

    admin: {
        uid: "mock-admin-uid",
        email: "admin@test.com",
        displayName: "Adam Admin",
        roles: {
            admin: {
                name: "Adam Admin",
                email: "admin@test.com",
                hostId: "mock-host-uid",
            },
        },
    },
};
