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
    doc, setDoc, getDoc, getDocs,
    collection, updateDoc, deleteDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const PENDING_ID = "pending-123";
const PENDING_DATA = {
    email:       "child@test.com",
    fullName:    "Child User",
    status:      "awaiting_parent_consent",
    parentEmail: "parent@test.com",
};

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

describe("pendingUsers", () => {
    beforeEach(async () => {
        await seed(env, `pendingUsers/${PENDING_ID}`, PENDING_DATA);
    });

    it("anyone can read a single pending doc by token (parent consent page)", async () => {
        const db = unauthDb(env);
        await assertSucceeds(getDoc(doc(db, "pendingUsers", PENDING_ID)));
    });

    it("nobody can list the pendingUsers collection", async () => {
        const db = authedDb(env, "some-uid");
        await assertFails(getDocs(collection(db, "pendingUsers")));
    });

    it("nobody can update a pending doc from client", async () => {
        const db = authedDb(env, "some-uid");
        await assertFails(setDoc(doc(db, "pendingUsers", PENDING_ID), {
            ...PENDING_DATA,
            status: "approved",  // 🚨 use setDoc not updateDoc to avoid NOT_FOUND error
        }));
    });

    it("nobody can delete a pending doc from client", async () => {
        const db = authedDb(env, "some-uid");
        await assertFails(deleteDoc(doc(db, "pendingUsers", PENDING_ID)));
    });
});