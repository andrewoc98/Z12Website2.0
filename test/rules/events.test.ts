import { describe, it, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import {
    RulesTestEnvironment, assertFails, assertSucceeds,
    createTestEnv, authedDb, unauthDb, seed,
} from "./helpers";
import {
    doc, updateDoc, deleteDoc, getDoc,
    getDocs, collection, addDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const HOST_UID  = "host-user";
const ROWER_UID = "rower-user";
const EVENT_ID  = "event-123";

async function seedBase() {
    await seed(env, `users/${HOST_UID}`, {
        fullName:    "Host User",
        primaryRole: "host",
        roles:       { host: { location: "Dublin" } },
    });
    await seed(env, `users/${ROWER_UID}`, {
        fullName:    "Rower User",
        primaryRole: "rower",
        roles:       { rower: { club: "Dublin RC" } },
    });
}

async function seedEvent() {
    await seed(env, `events/${EVENT_ID}`, {
        hostId:    HOST_UID,
        name:      "Test Event",
        createdAt: new Date().toISOString(),
    });
}

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

describe("events — create", () => {
    beforeEach(async () => {
        await seedBase();
        // No event needed for create tests
    });

    it("host can create an event with their own hostId", async () => {
        const db = authedDb(env, HOST_UID);
        await assertSucceeds(addDoc(collection(db, "events"), {
            hostId: HOST_UID,
            name:   "New Event",
        }));
    });

    it("host cannot create event with someone else's hostId", async () => {
        const db = authedDb(env, HOST_UID);
        await assertFails(addDoc(collection(db, "events"), {
            hostId: ROWER_UID,  // 🚨 wrong hostId
            name:   "New Event",
        }));
    });

    it("rower cannot create an event", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(addDoc(collection(db, "events"), {
            hostId: ROWER_UID,
            name:   "New Event",
        }));
    });

    it("unauthenticated user cannot create an event", async () => {
        const db = unauthDb(env);
        await assertFails(addDoc(collection(db, "events"), {
            hostId: HOST_UID,
            name:   "New Event",
        }));
    });
});

describe("events — update/delete", () => {
    beforeEach(async () => {
        await seedBase();
        await seedEvent();  // ✅ event must exist for update/delete tests
    });

    it("host can update their own event", async () => {
        const db = authedDb(env, HOST_UID);
        await assertSucceeds(updateDoc(doc(db, "events", EVENT_ID), {
            name: "Updated",
        }));
    });

    it("rower cannot update an event", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(updateDoc(doc(db, "events", EVENT_ID), {
            name: "Hacked",
        }));
    });

    it("host can delete their own event", async () => {
        const db = authedDb(env, HOST_UID);
        await assertSucceeds(deleteDoc(doc(db, "events", EVENT_ID)));
    });

    it("rower cannot delete an event", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(deleteDoc(doc(db, "events", EVENT_ID)));
    });
});

describe("events — read", () => {
    beforeEach(async () => { await seedEvent(); });

    it("unauthenticated user can read events (public)", async () => {
        const db = unauthDb(env);
        await assertSucceeds(getDoc(doc(db, "events", EVENT_ID)));
        await assertSucceeds(getDocs(collection(db, "events")));
    });
});