/**
 * admin.test.ts
 *
 * Security rules tests for BigAdminsUpdate collections:
 *   federations, clubs (top-level), clubCreationRequests, federationInvites
 *
 * Covers every ✅/❌ row in §9 of BigAdminsUpdate.md plus role-escalation checks.
 */
import { describe, it, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import {
    RulesTestEnvironment,
    assertFails,
    assertSucceeds,
    createTestEnv,
    authedDb,
    unauthDb,
    seed,
} from "./helpers";
import {
    doc, setDoc, updateDoc, deleteDoc,
    getDoc, collection, getDocs,
} from "firebase/firestore";

let env: RulesTestEnvironment;

// ── Fixed UIDs ────────────────────────────────────────────────────────────────

const PLATFORM_ADMIN_UID  = "uid-platform-admin";
const FED_ADMIN_RI_UID    = "uid-fed-admin-ri";
const FED_ADMIN_USR_UID   = "uid-fed-admin-usr";
const CLUB_ADMIN_UID      = "uid-club-admin";
const ROWER_UID           = "uid-rower";
const STRANGER_UID        = "uid-stranger";

// ── Custom-claim sets ─────────────────────────────────────────────────────────

const PLATFORM_ADMIN_CLAIMS  = { role: "platformAdmin" };
const FED_ADMIN_RI_CLAIMS    = { role: "federationAdmin", federationId: "fed-ri" };
const FED_ADMIN_USR_CLAIMS   = { role: "federationAdmin", federationId: "fed-usr" };
const CLUB_ADMIN_CLAIMS      = { role: "clubAdmin", clubId: "club-neptune", federationId: "fed-ri" };

// ── Seed data ─────────────────────────────────────────────────────────────────

const FED_RI = {
    id: "fed-ri", name: "Rowing Ireland", slug: "rowing-ireland",
    country: "IE", contactEmail: "info@ri.ie",
    adminUids: [FED_ADMIN_RI_UID], createdBy: PLATFORM_ADMIN_UID,
    status: "active", createdAt: "2025-01-01", updatedAt: "2025-01-01",
};

const FED_USR = {
    id: "fed-usr", name: "USRowing", slug: "usrowing",
    country: "US", contactEmail: "info@usr.org",
    adminUids: [FED_ADMIN_USR_UID], createdBy: PLATFORM_ADMIN_UID,
    status: "active", createdAt: "2025-01-01", updatedAt: "2025-01-01",
};

const CLUB_NEPTUNE = {
    id: "club-neptune", name: "Neptune Rowing Club", federationId: "fed-ri",
    adminUids: [CLUB_ADMIN_UID], status: "active", openMembership: true,
    createdBy: CLUB_ADMIN_UID, approvedAt: "2025-01-01", approvedBy: FED_ADMIN_RI_UID,
    memberCount: 0, rowerCount: 0, coachCount: 0,
    location: { city: "Cork", country: "IE" },
    createdAt: "2025-01-01", updatedAt: "2025-01-01",
};

const CLUB_VESPER = {
    id: "club-vesper", name: "Vesper Boat Club", federationId: "fed-usr",
    adminUids: [], status: "active", openMembership: true,
    createdBy: STRANGER_UID, approvedAt: "2025-01-01", approvedBy: FED_ADMIN_USR_UID,
    memberCount: 0, rowerCount: 0, coachCount: 0,
    location: { city: "Philadelphia", country: "US" },
    createdAt: "2025-01-01", updatedAt: "2025-01-01",
};

const PENDING_REQUEST = {
    id: "req-001", requestedBy: ROWER_UID,
    requesterDisplayName: "Rower One", requesterEmail: "rower@test.com",
    federationId: "fed-ri", proposedClubName: "New Club",
    proposedClubLocation: "Galway", proposedClubDescription: "desc",
    supportingInfo: null, status: "pending",
    submittedAt: "2025-01-01", reviewedAt: null, reviewedBy: null,
    rejectionReason: null, resultingClubId: null,
};

const FED_INVITE = {
    id: "invite-001", invitedEmail: "new.admin@test.com",
    federationId: "fed-ri", federationName: "Rowing Ireland",
    invitedBy: PLATFORM_ADMIN_UID, status: "pending",
    token: "hashed-token", createdAt: "2025-01-01",
    expiresAt: "2099-01-01", acceptedAt: null, acceptedByUid: null,
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

// ─────────────────────────────────────────────────────────────────────────────
// FEDERATIONS
// ─────────────────────────────────────────────────────────────────────────────

describe("federations — read", () => {
    beforeEach(async () => {
        await seed(env, "federations/fed-ri",  FED_RI);
        await seed(env, "federations/fed-usr", FED_USR);
    });

    it("✅ platformAdmin can read any federation", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "federations", "fed-ri")));
        await assertSucceeds(getDoc(doc(db, "federations", "fed-usr")));
    });

    it("✅ federationAdmin can read their own federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "federations", "fed-ri")));
    });

    it("❌ federationAdmin cannot read another federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(getDoc(doc(db, "federations", "fed-usr")));
    });

    it("❌ unauthenticated user cannot read any federation", async () => {
        const db = unauthDb(env);
        await assertFails(getDoc(doc(db, "federations", "fed-ri")));
    });

    it("❌ regular rower cannot read any federation", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(getDoc(doc(db, "federations", "fed-ri")));
    });
});

describe("federations — create", () => {
    it("✅ platformAdmin can create a federation", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertSucceeds(setDoc(doc(db, "federations", "fed-new"), {
            ...FED_RI, id: "fed-new",
        }));
    });

    it("❌ federationAdmin cannot create a federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(setDoc(doc(db, "federations", "fed-new"), {
            ...FED_RI, id: "fed-new",
        }));
    });

    it("❌ unauthenticated user cannot create a federation", async () => {
        const db = unauthDb(env);
        await assertFails(setDoc(doc(db, "federations", "fed-new"), FED_RI));
    });
});

describe("federations — update", () => {
    beforeEach(async () => {
        await seed(env, "federations/fed-ri", FED_RI);
    });

    it("✅ federationAdmin can update safe fields on their own federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertSucceeds(updateDoc(doc(db, "federations", "fed-ri"), {
            contactEmail: "new@ri.ie",
        }));
    });

    it("❌ federationAdmin cannot update adminUids", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "federations", "fed-ri"), {
            adminUids: [FED_ADMIN_RI_UID, "some-new-uid"],
        }));
    });

    it("❌ federationAdmin cannot update status", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "federations", "fed-ri"), {
            status: "suspended",
        }));
    });

    it("❌ federationAdmin cannot update another federation", async () => {
        await seed(env, "federations/fed-usr", FED_USR);
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "federations", "fed-usr"), {
            contactEmail: "hacked@usr.org",
        }));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLUBS
// ─────────────────────────────────────────────────────────────────────────────

describe("clubs — read", () => {
    beforeEach(async () => {
        await seed(env, "clubs/club-neptune", CLUB_NEPTUNE);
        await seed(env, "clubs/club-vesper",  CLUB_VESPER);
    });

    it("✅ any signed-in user can read any club (get)", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertSucceeds(getDoc(doc(db, "clubs", "club-neptune")));
    });

    it("✅ federationAdmin can read clubs in their federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "clubs", "club-neptune")));
    });

    it("❌ federationAdmin cannot read clubs in another federation (via write path)", async () => {
        // Write access to clubs in another federation is blocked
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-vesper"), {
            contactEmail: "hacked@vesper.org",
        }));
    });

    it("✅ clubAdmin can read their own club", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "clubs", "club-neptune")));
    });

    it("❌ unauthenticated user cannot read a club", async () => {
        const db = unauthDb(env);
        await assertFails(getDoc(doc(db, "clubs", "club-neptune")));
    });
});

describe("clubs — update", () => {
    beforeEach(async () => {
        await seed(env, "clubs/club-neptune", CLUB_NEPTUNE);
        await seed(env, "clubs/club-vesper",  CLUB_VESPER);
    });

    it("✅ clubAdmin can update safe fields on their own club", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertSucceeds(updateDoc(doc(db, "clubs", "club-neptune"), {
            contactEmail: "new@neptune.ie",
        }));
    });

    it("❌ clubAdmin cannot update federationId", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-neptune"), {
            federationId: "fed-usr",
        }));
    });

    it("❌ clubAdmin cannot update status", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-neptune"), {
            status: "suspended",
        }));
    });

    it("❌ clubAdmin cannot update adminUids", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-neptune"), {
            adminUids: [CLUB_ADMIN_UID, "new-uid"],
        }));
    });

    it("❌ clubAdmin cannot update approvedAt or approvedBy", async () => {
        const db = authedDb(env, CLUB_ADMIN_UID, CLUB_ADMIN_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-neptune"), {
            approvedBy: ROWER_UID,
        }));
    });

    it("✅ federationAdmin can update safe fields on clubs in their federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertSucceeds(updateDoc(doc(db, "clubs", "club-neptune"), {
            contactEmail: "updated@neptune.ie",
        }));
    });

    it("❌ federationAdmin cannot update clubs in another federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubs", "club-vesper"), {
            contactEmail: "hacked@vesper.org",
        }));
    });

    it("❌ no client can create a club directly", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertFails(setDoc(doc(db, "clubs", "club-new"), {
            ...CLUB_NEPTUNE, id: "club-new",
        }));
    });

    it("❌ no client can delete a club", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertFails(deleteDoc(doc(db, "clubs", "club-neptune")));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLUB CREATION REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("clubCreationRequests — create", () => {
    it("✅ any authenticated user can submit a request", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertSucceeds(setDoc(doc(db, "clubCreationRequests", "req-new"), {
            ...PENDING_REQUEST, requestedBy: ROWER_UID,
        }));
    });

    it("❌ cannot submit a request on behalf of another user", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(setDoc(doc(db, "clubCreationRequests", "req-new"), {
            ...PENDING_REQUEST, requestedBy: STRANGER_UID,
        }));
    });

    it("❌ cannot submit a request with status other than pending", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(setDoc(doc(db, "clubCreationRequests", "req-new"), {
            ...PENDING_REQUEST, requestedBy: ROWER_UID, status: "approved",
        }));
    });

    it("❌ unauthenticated user cannot submit a request", async () => {
        const db = unauthDb(env);
        await assertFails(setDoc(doc(db, "clubCreationRequests", "req-new"), PENDING_REQUEST));
    });
});

describe("clubCreationRequests — read", () => {
    beforeEach(async () => {
        await seed(env, "clubCreationRequests/req-001", PENDING_REQUEST);
    });

    it("✅ requester can read their own request", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertSucceeds(getDoc(doc(db, "clubCreationRequests", "req-001")));
    });

    it("❌ another user cannot read someone else's request", async () => {
        const db = authedDb(env, STRANGER_UID);
        await assertFails(getDoc(doc(db, "clubCreationRequests", "req-001")));
    });

    it("✅ federationAdmin can read requests for their federation", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "clubCreationRequests", "req-001")));
    });

    it("❌ federationAdmin cannot read requests for another federation", async () => {
        const db = authedDb(env, FED_ADMIN_USR_UID, FED_ADMIN_USR_CLAIMS);
        await assertFails(getDoc(doc(db, "clubCreationRequests", "req-001")));
    });

    it("✅ platformAdmin can read all requests", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "clubCreationRequests", "req-001")));
    });
});

describe("clubCreationRequests — update/delete", () => {
    beforeEach(async () => {
        await seed(env, "clubCreationRequests/req-001", PENDING_REQUEST);
    });

    it("❌ no client can update a request (Functions only)", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubCreationRequests", "req-001"), {
            status: "approved",
        }));
    });

    it("❌ platformAdmin cannot update a request directly", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertFails(updateDoc(doc(db, "clubCreationRequests", "req-001"), {
            status: "approved",
        }));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// FEDERATION INVITES
// ─────────────────────────────────────────────────────────────────────────────

describe("federationInvites — read", () => {
    beforeEach(async () => {
        await seed(env, "federationInvites/invite-001", FED_INVITE);
    });

    it("✅ platformAdmin can read all invites", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, PLATFORM_ADMIN_CLAIMS);
        await assertSucceeds(getDoc(doc(db, "federationInvites", "invite-001")));
    });

    it("❌ federationAdmin cannot read invites", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(getDoc(doc(db, "federationInvites", "invite-001")));
    });

    it("❌ regular user cannot read invites", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(getDoc(doc(db, "federationInvites", "invite-001")));
    });

    it("❌ unauthenticated user cannot read invites", async () => {
        const db = unauthDb(env);
        await assertFails(getDoc(doc(db, "federationInvites", "invite-001")));
    });
});

describe("federationInvites — write", () => {
    it("❌ non-platformAdmin cannot create an invite", async () => {
        const db = authedDb(env, FED_ADMIN_RI_UID, FED_ADMIN_RI_CLAIMS);
        await assertFails(setDoc(doc(db, "federationInvites", "invite-new"), FED_INVITE));
    });

    it("❌ unauthenticated user cannot create an invite", async () => {
        const db = unauthDb(env);
        await assertFails(setDoc(doc(db, "federationInvites", "invite-new"), FED_INVITE));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ESCALATION — client cannot self-assign any admin role
// ─────────────────────────────────────────────────────────────────────────────

describe("role escalation — blocked", () => {
    const BASE = { fullName: "Rower", email: "rower@test.com" };

    beforeEach(async () => {
        await seed(env, `users/${ROWER_UID}`, BASE);
    });

    it("❌ user cannot set primaryRole to platformAdmin on create", async () => {
        const db = authedDb(env, STRANGER_UID);
        await assertFails(setDoc(doc(db, "users", STRANGER_UID), {
            fullName: "Hacker", primaryRole: "platformAdmin",
        }));
    });

    it("❌ user cannot change their own primaryRole to federationAdmin", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), {
            primaryRole: "federationAdmin",
        }));
    });

    it("❌ user cannot change their own primaryRole to clubAdmin", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), {
            primaryRole: "clubAdmin",
        }));
    });

    it("❌ user cannot set role field to platformAdmin", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), {
            role: "platformAdmin",
        }));
    });
});
