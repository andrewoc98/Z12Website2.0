/**
 * adminFlow.test.ts — End-to-end smoke tests
 *
 * These tests verify the complete admin role hierarchy flow:
 *
 *   1. platformAdmin creates a federation
 *   2. platformAdmin invites a federationAdmin
 *   3. federationAdmin accepts the invite (state transition verified)
 *   4. Any user submits a club creation request
 *   5. federationAdmin approves → requester becomes clubAdmin
 *   6. clubAdmin manages their club and members
 *
 * Each "action" is seeded as the state the Cloud Function would have written.
 * The tests then verify:
 *   - Security rules allow/deny the right follow-on operations
 *   - Data model invariants hold after each transition
 *   - Custom claim scoping (federationId, clubId) is enforced correctly
 *
 * Requires: Firestore emulator on 127.0.0.1:8080
 * Run with: npx vitest run test/smoke/
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
} from "../rules/helpers";
import {
    doc, setDoc, updateDoc, deleteDoc,
    getDoc, getDocs, collection, query, where,
} from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

// ── Fixed identifiers ────────────────────────────────────────────────────────

const PLATFORM_ADMIN_UID = "smoke-platform-admin";
const FED_ADMIN_UID      = "smoke-fed-admin";
const ROWER_UID          = "smoke-rower";
const CLUB_ADMIN_UID     = "smoke-club-admin";   // same as ROWER_UID after approval
const COACH_UID          = "smoke-coach";

const FEDERATION_ID      = "smoke-federation";
const CLUB_ID            = "smoke-club";
const REQUEST_ID         = "smoke-request";
const INVITE_ID          = "smoke-invite";

// ── Claim sets ───────────────────────────────────────────────────────────────

const AS_PLATFORM_ADMIN   = { role: "platformAdmin" };
const AS_FED_ADMIN        = { role: "federationAdmin", federationId: FEDERATION_ID };
const AS_CLUB_ADMIN       = { role: "clubAdmin",       clubId: CLUB_ID, federationId: FEDERATION_ID };
const AS_ROWER            = {}; // no admin claims

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedFederation() {
    await seed(env, `federations/${FEDERATION_ID}`, {
        id: FEDERATION_ID, name: "Smoke Federation", slug: "smoke-federation",
        country: "IE", contactEmail: "admin@smoke.ie", status: "active",
        adminUids: [FED_ADMIN_UID], createdBy: PLATFORM_ADMIN_UID,
        createdAt: "2025-01-01", updatedAt: "2025-01-01",
    });
}

async function seedFedAdminUser() {
    await seed(env, `users/${FED_ADMIN_UID}`, {
        uid: FED_ADMIN_UID, email: "fed.admin@smoke.ie",
        displayName: "Smoke Fed Admin",
        federationId: FEDERATION_ID,
        roles: { federationAdmin: { federationId: FEDERATION_ID } },
        status: { isActive: true, isVerified: true },
        createdAt: "2025-01-01", updatedAt: "2025-01-01",
    });
}

async function seedRowerUser() {
    await seed(env, `users/${ROWER_UID}`, {
        uid: ROWER_UID, email: "rower@smoke.ie",
        displayName: "Smoke Rower", primaryRole: "rower",
        roles: { rower: { clubMemberships: [], stats: {}, performances: {} } },
        status: { isActive: true, isVerified: true },
        createdAt: "2025-01-01", updatedAt: "2025-01-01",
    });
}

async function seedPendingRequest() {
    await seed(env, `clubCreationRequests/${REQUEST_ID}`, {
        id: REQUEST_ID, requestedBy: ROWER_UID,
        requesterDisplayName: "Smoke Rower", requesterEmail: "rower@smoke.ie",
        federationId: FEDERATION_ID,
        proposedClubName: "Smoke Rowing Club", proposedClubLocation: "Smoke City",
        proposedClubDescription: "A test club.", supportingInfo: null,
        status: "pending", submittedAt: "2025-01-01",
        reviewedAt: null, reviewedBy: null, rejectionReason: null, resultingClubId: null,
    });
}

async function seedApprovedClub() {
    await seed(env, `clubs/${CLUB_ID}`, {
        id: CLUB_ID, name: "Smoke Rowing Club", federationId: FEDERATION_ID,
        adminUids: [ROWER_UID], status: "active", openMembership: false,
        memberCount: 0, rowerCount: 0, coachCount: 0,
        location: { city: "Smoke City", country: "IE" },
        createdBy: ROWER_UID, approvedAt: "2025-01-02", approvedBy: FED_ADMIN_UID,
        createdAt: "2025-01-02", updatedAt: "2025-01-02",
    });
    // Private config subcollection
    await seed(env, `clubs/${CLUB_ID}/private/config`, {
        inviteCodeHashes: [], updatedAt: "2025-01-02",
    });
}

async function seedClubAdminUser() {
    // The requester was promoted to clubAdmin after approval.
    // No primaryRole field — role is determined by roles.clubAdmin presence.
    await seed(env, `users/${ROWER_UID}`, {
        uid: ROWER_UID, email: "rower@smoke.ie",
        displayName: "Smoke Rower",
        clubId: CLUB_ID, federationId: FEDERATION_ID,
        roles: {
            rower:     { clubMemberships: [], stats: {}, performances: {} },
            clubAdmin: { clubId: CLUB_ID, federationId: FEDERATION_ID },
        },
        status: { isActive: true, isVerified: true },
        createdAt: "2025-01-01", updatedAt: "2025-01-02",
    });
}

async function seedClubMember(uid: string, role: "rower" | "coach") {
    await seed(env, `clubs/${CLUB_ID}/members/${uid}`, {
        uid, clubId: CLUB_ID,
        displayName: `Smoke ${role}`, email: `${role}@smoke.ie`,
        role, status: "active", joinedAt: "2025-01-03", updatedAt: "2025-01-03",
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1: Platform admin creates a federation and invites a federation admin
// ─────────────────────────────────────────────────────────────────────────────

describe("Flow 1 — federation creation", () => {

    it("platformAdmin can create a federation document", async () => {
        const db = authedDb(env, PLATFORM_ADMIN_UID, AS_PLATFORM_ADMIN);
        await assertSucceeds(setDoc(doc(db, "federations", FEDERATION_ID), {
            id: FEDERATION_ID, name: "Smoke Federation", slug: "smoke-federation",
            country: "IE", contactEmail: "admin@smoke.ie", status: "active",
            adminUids: [], createdBy: PLATFORM_ADMIN_UID,
            createdAt: "2025-01-01", updatedAt: "2025-01-01",
        }));
    });

    it("platformAdmin can create a federation invite", async () => {
        await seedFederation();
        const db = authedDb(env, PLATFORM_ADMIN_UID, AS_PLATFORM_ADMIN);
        await assertSucceeds(setDoc(doc(db, "federationInvites", INVITE_ID), {
            id: INVITE_ID, invitedEmail: "fed.admin@smoke.ie",
            federationId: FEDERATION_ID, federationName: "Smoke Federation",
            invitedBy: PLATFORM_ADMIN_UID, status: "pending",
            token: "hashed-token", createdAt: "2025-01-01",
            expiresAt: "2099-01-01", acceptedAt: null, acceptedByUid: null,
        }));
    });

    it("after acceptance: federationAdmin can read their federation", async () => {
        await seedFederation();
        await seedFedAdminUser();
        const db = authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN);
        await assertSucceeds(getDoc(doc(db, "federations", FEDERATION_ID)));
    });

    it("after acceptance: federationAdmin can update safe federation fields", async () => {
        await seedFederation();
        const db = authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN);
        await assertSucceeds(updateDoc(doc(db, "federations", FEDERATION_ID), {
            contactEmail: "updated@smoke.ie",
        }));
    });

    it("after acceptance: federationAdmin cannot update adminUids or status", async () => {
        await seedFederation();
        const db = authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN);
        await assertFails(updateDoc(doc(db, "federations", FEDERATION_ID), {
            adminUids: [FED_ADMIN_UID, "intruder-uid"],
        }));
        await assertFails(updateDoc(doc(db, "federations", FEDERATION_ID), {
            status: "suspended",
        }));
    });

    it("invite record: non-platformAdmin cannot read federation invites", async () => {
        await seedFederation();
        await seed(env, `federationInvites/${INVITE_ID}`, {
            id: INVITE_ID, invitedEmail: "fed.admin@smoke.ie",
            federationId: FEDERATION_ID, federationName: "Smoke Federation",
            invitedBy: PLATFORM_ADMIN_UID, status: "pending",
            token: "hashed-token", createdAt: "2025-01-01",
            expiresAt: "2099-01-01", acceptedAt: null, acceptedByUid: null,
        });
        await assertFails(getDoc(doc(authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN), "federationInvites", INVITE_ID)));
        await assertFails(getDoc(doc(authedDb(env, ROWER_UID, AS_ROWER),         "federationInvites", INVITE_ID)));
        await assertFails(getDoc(doc(unauthDb(env),                              "federationInvites", INVITE_ID)));
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2: Club creation request → approval → requester becomes clubAdmin
// ─────────────────────────────────────────────────────────────────────────────

describe("Flow 2 — club creation request and approval", () => {

    beforeEach(async () => {
        await seedFederation();
        await seedRowerUser();
    });

    it("any authenticated user can submit a club creation request", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertSucceeds(setDoc(doc(db, "clubCreationRequests", REQUEST_ID), {
            id: REQUEST_ID, requestedBy: ROWER_UID,
            requesterDisplayName: "Smoke Rower", requesterEmail: "rower@smoke.ie",
            federationId: FEDERATION_ID, proposedClubName: "Smoke Rowing Club",
            proposedClubLocation: "Smoke City", proposedClubDescription: "A test club.",
            supportingInfo: null, status: "pending",
            submittedAt: "2025-01-01", reviewedAt: null, reviewedBy: null,
            rejectionReason: null, resultingClubId: null,
        }));
    });

    it("request must be submitted as the calling user", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(setDoc(doc(db, "clubCreationRequests", REQUEST_ID), {
            id: REQUEST_ID, requestedBy: "someone-else", // wrong uid
            requesterDisplayName: "Smoke Rower", requesterEmail: "rower@smoke.ie",
            federationId: FEDERATION_ID, proposedClubName: "Smoke Rowing Club",
            proposedClubLocation: "Smoke City", proposedClubDescription: "A test club.",
            supportingInfo: null, status: "pending",
            submittedAt: "2025-01-01", reviewedAt: null, reviewedBy: null,
            rejectionReason: null, resultingClubId: null,
        }));
    });

    it("federationAdmin can read requests for their federation", async () => {
        await seedFedAdminUser();
        await seedPendingRequest();
        const db = authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN);
        await assertSucceeds(getDoc(doc(db, "clubCreationRequests", REQUEST_ID)));
    });

    it("federationAdmin from a different federation cannot read the request", async () => {
        await seedPendingRequest();
        const db = authedDb(env, "other-fed-admin", { role: "federationAdmin", federationId: "other-fed" });
        await assertFails(getDoc(doc(db, "clubCreationRequests", REQUEST_ID)));
    });

    it("after approval: club document is created with correct shape", async () => {
        await seedPendingRequest();
        await seedApprovedClub();
        // Verify the resulting club is readable by the new clubAdmin
        const db = authedDb(env, ROWER_UID, AS_CLUB_ADMIN);
        const snap = await getDoc(doc(db, "clubs", CLUB_ID));
        const data = snap.data()!;
        expect(data.status).toBe("active");
        expect(data.federationId).toBe(FEDERATION_ID);
        expect(data.adminUids).toContain(ROWER_UID);
        expect(data.approvedBy).toBe(FED_ADMIN_UID);
    });

    it("after approval: request is marked approved with resultingClubId", async () => {
        await seedPendingRequest();
        await env.withSecurityRulesDisabled(async ctx => {
            await ctx.firestore().doc(`clubCreationRequests/${REQUEST_ID}`).update({
                status: "approved", resultingClubId: CLUB_ID,
                reviewedAt: "2025-01-02", reviewedBy: FED_ADMIN_UID,
            });
        });
        // withSecurityRulesDisabled returns void — capture via closure
        let status = "", resultingClubId = "";
        await env.withSecurityRulesDisabled(async ctx => {
            const snap = await ctx.firestore().doc(`clubCreationRequests/${REQUEST_ID}`).get();
            status          = snap.data()!.status;
            resultingClubId = snap.data()!.resultingClubId;
        });
        expect(status).toBe("approved");
        expect(resultingClubId).toBe(CLUB_ID);
    });

    it("after approval: requester's user doc has clubAdmin role sub-object and scoped IDs", async () => {
        await seedApprovedClub();
        await seedClubAdminUser();
        let clubId = "", federationId = "", hasRower = false, hasClubAdmin = false;
        await env.withSecurityRulesDisabled(async ctx => {
            const snap = await ctx.firestore().doc(`users/${ROWER_UID}`).get();
            const d    = snap.data()!;
            clubId       = d.clubId;
            federationId = d.federationId;
            hasRower     = !!d.roles?.rower;
            hasClubAdmin = !!d.roles?.clubAdmin;
        });
        // primaryRole is no longer written for admin users — role determined by roles.clubAdmin
        expect(clubId).toBe(CLUB_ID);
        expect(federationId).toBe(FEDERATION_ID);
        expect(hasRower).toBe(true);      // dual role preserved
        expect(hasClubAdmin).toBe(true);
    });

    it("after approval: no client can directly update the request (Functions only)", async () => {
        await seedPendingRequest();
        // Even platformAdmin cannot update a request via client SDK
        await assertFails(updateDoc(
            doc(authedDb(env, PLATFORM_ADMIN_UID, AS_PLATFORM_ADMIN), "clubCreationRequests", REQUEST_ID),
            { status: "approved" }
        ));
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3: clubAdmin manages their club and members
// ─────────────────────────────────────────────────────────────────────────────

describe("Flow 3 — club admin manages club and members", () => {

    beforeEach(async () => {
        await seedFederation();
        await seedApprovedClub();
        await seedClubAdminUser();
    });

    it("clubAdmin can update safe club fields (name, contactEmail)", async () => {
        const db = authedDb(env, ROWER_UID, AS_CLUB_ADMIN);
        await assertSucceeds(updateDoc(doc(db, "clubs", CLUB_ID), {
            name:         "Updated Club Name",
            contactEmail: "new@smokeclub.ie",
        }));
    });

    it("clubAdmin cannot update federationId, status, adminUids, approvedBy", async () => {
        const db = authedDb(env, ROWER_UID, AS_CLUB_ADMIN);
        await assertFails(updateDoc(doc(db, "clubs", CLUB_ID), { federationId: "other-fed"   }));
        await assertFails(updateDoc(doc(db, "clubs", CLUB_ID), { status:       "suspended"   }));
        await assertFails(updateDoc(doc(db, "clubs", CLUB_ID), { adminUids:    ["intruder"]  }));
        await assertFails(updateDoc(doc(db, "clubs", CLUB_ID), { approvedBy:   "intruder"   }));
    });

    it("clubAdmin cannot create or delete clubs directly", async () => {
        const db = authedDb(env, ROWER_UID, AS_CLUB_ADMIN);
        await assertFails(setDoc(doc(db, "clubs", "new-club"), { name: "Hijacked Club" }));
        await assertFails(deleteDoc(doc(db, "clubs", CLUB_ID)));
    });

    it("after adminAddMember: member doc exists and is readable by any signed-in user", async () => {
        await seedClubMember(COACH_UID, "coach");
        // Any signed-in user (e.g. for coach browse) can read member docs
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertSucceeds(getDoc(doc(db, `clubs/${CLUB_ID}/members`, COACH_UID)));
    });

    it("member writes are blocked for all clients — Functions only", async () => {
        await seedClubMember(COACH_UID, "coach");
        // clubAdmin cannot write member docs via client SDK
        const adminDb = authedDb(env, ROWER_UID, AS_CLUB_ADMIN);
        await assertFails(updateDoc(doc(adminDb, `clubs/${CLUB_ID}/members`, COACH_UID), {
            status: "removed",
        }));
        // Neither can a rower
        await assertFails(updateDoc(doc(authedDb(env, ROWER_UID, AS_ROWER), `clubs/${CLUB_ID}/members`, COACH_UID), {
            status: "removed",
        }));
    });

    it("after adminRemoveMember: member doc records status=removed with reason", async () => {
        await seedClubMember(COACH_UID, "coach");
        await env.withSecurityRulesDisabled(async ctx => {
            await ctx.firestore().doc(`clubs/${CLUB_ID}/members/${COACH_UID}`).update({
                status: "removed", actionedByUid: ROWER_UID,
                actionReason: "Test removal", updatedAt: "2025-01-04",
            });
        });
        let status = "", actionReason = "";
        await env.withSecurityRulesDisabled(async ctx => {
            const snap  = await ctx.firestore().doc(`clubs/${CLUB_ID}/members/${COACH_UID}`).get();
            status       = snap.data()!.status;
            actionReason = snap.data()!.actionReason;
        });
        expect(status).toBe("removed");
        expect(actionReason).toBe("Test removal");
    });

    it("federationAdmin can read clubs in their federation but not other federations", async () => {
        // Seed a club in a different federation
        await seed(env, "clubs/other-club", {
            id: "other-club", name: "Other Club", federationId: "other-fed",
            adminUids: [], status: "active", openMembership: true,
            memberCount: 0, rowerCount: 0, coachCount: 0,
            location: { city: "Other", country: "US" },
            createdBy: PLATFORM_ADMIN_UID, approvedAt: null, approvedBy: null,
            createdAt: "2025-01-01", updatedAt: "2025-01-01",
        });

        const fedAdminDb = authedDb(env, FED_ADMIN_UID, AS_FED_ADMIN);
        await assertSucceeds(getDoc(doc(fedAdminDb, "clubs", CLUB_ID)));         // own fed ✅
        // Write to a different federation's club is blocked
        await assertFails(updateDoc(doc(fedAdminDb, "clubs", "other-club"), { contactEmail: "hacked@other.com" }));
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4: Admin notifications subcollection
// ─────────────────────────────────────────────────────────────────────────────

describe("Flow 4 — admin notifications", () => {

    it("user can read their own admin notifications", async () => {
        await seed(env, `users/${ROWER_UID}/adminNotifications/notif-001`, {
            id: "notif-001", type: "club_creation_request",
            title: "New request", body: "Test", linkPath: null,
            isRead: false, createdAt: "2025-01-01",
        });
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertSucceeds(getDoc(doc(db, `users/${ROWER_UID}/adminNotifications`, "notif-001")));
    });

    it("user cannot read another user's admin notifications", async () => {
        await seed(env, `users/${ROWER_UID}/adminNotifications/notif-001`, {
            id: "notif-001", type: "club_creation_request",
            title: "New request", body: "Test", linkPath: null,
            isRead: false, createdAt: "2025-01-01",
        });
        const db = authedDb(env, COACH_UID, AS_ROWER);
        await assertFails(getDoc(doc(db, `users/${ROWER_UID}/adminNotifications`, "notif-001")));
    });

    it("no client can write admin notifications — Functions only", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(setDoc(doc(db, `users/${ROWER_UID}/adminNotifications`, "notif-hack"), {
            id: "notif-hack", type: "club_approved",
            title: "Fake approval", body: "Hacked", linkPath: "/admin/club",
            isRead: false, createdAt: "2025-01-01",
        }));
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 5: Role escalation — no path grants admin roles client-side
// ─────────────────────────────────────────────────────────────────────────────

describe("Flow 5 — role escalation is impossible client-side", () => {

    beforeEach(async () => { await seedRowerUser(); });

    it("rower cannot self-assign platformAdmin via user update", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), { role: "platformAdmin" }));
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), { primaryRole: "federationAdmin" }));
        await assertFails(updateDoc(doc(db, "users", ROWER_UID), { primaryRole: "clubAdmin" }));
    });

    it("rower cannot create a federation", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(setDoc(doc(db, "federations", "hijacked-fed"), {
            id: "hijacked-fed", name: "Hijacked", slug: "hijacked",
            country: "IE", contactEmail: "h@h.ie", status: "active",
            adminUids: [ROWER_UID], createdBy: ROWER_UID,
            createdAt: "2025-01-01", updatedAt: "2025-01-01",
        }));
    });

    it("rower cannot write a federation invite", async () => {
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(setDoc(doc(db, "federationInvites", "fake-invite"), {
            id: "fake-invite", invitedEmail: "me@me.com",
            federationId: "any-fed", federationName: "Any Fed",
            invitedBy: ROWER_UID, status: "pending",
            token: "raw-token", createdAt: "2025-01-01",
            expiresAt: "2099-01-01", acceptedAt: null, acceptedByUid: null,
        }));
    });

    it("rower cannot approve a club request by updating it directly", async () => {
        await seedPendingRequest();
        const db = authedDb(env, ROWER_UID, AS_ROWER);
        await assertFails(updateDoc(doc(db, "clubCreationRequests", REQUEST_ID), {
            status: "approved", resultingClubId: "my-new-club",
        }));
    });

    it("claiming federationAdmin claims does not bypass federation rules on wrong federation", async () => {
        await seedFederation();
        // Even with a federationAdmin claim, the wrong federationId in the claim
        // means they can't access this federation
        const wrongFedAdminDb = authedDb(env, "wrong-admin", {
            primaryRole: "federationAdmin",
            federationId: "completely-different-federation",
        });
        await assertFails(getDoc(doc(wrongFedAdminDb, "federations", FEDERATION_ID)));
    });

    it("claiming clubAdmin claims does not allow updating a different club", async () => {
        await seedApprovedClub();
        await seed(env, "clubs/other-club", {
            id: "other-club", name: "Other Club", federationId: FEDERATION_ID,
            adminUids: [], status: "active", openMembership: true,
            memberCount: 0, rowerCount: 0, coachCount: 0,
            location: { city: "Other", country: "IE" },
            createdBy: PLATFORM_ADMIN_UID, approvedAt: null, approvedBy: null,
            createdAt: "2025-01-01", updatedAt: "2025-01-01",
        });
        // clubAdmin for CLUB_ID cannot update a different club
        const db = authedDb(env, ROWER_UID, AS_CLUB_ADMIN); // clubId = CLUB_ID
        await assertFails(updateDoc(doc(db, "clubs", "other-club"), { name: "Hijacked" }));
    });

});
