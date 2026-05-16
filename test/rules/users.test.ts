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
    getDoc, getDocs, collection,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const UID_A = "user-a";
const UID_B = "user-b";

// Base user doc that satisfies isHost/writesProtectedFields checks
const BASE_USER = {
    fullName:    "Alice",
    email:       "alice@test.com",
    primaryRole: "rower",
    roles:       { rower: { club: "Dublin RC" } },  // ✅ roles must exist
};

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

describe("users — create", () => {
    it("owner can create own doc without protected fields", async () => {
        const db = authedDb(env, UID_A);
        await assertSucceeds(setDoc(doc(db, "users", UID_A), {
            fullName:    "Alice",
            displayName: "Alice",
            email:       "alice@test.com",
            // No primaryRole, no role — should succeed
        }));
    });

    it("owner cannot create doc with primaryRole", async () => {
        const db = authedDb(env, UID_A);
        await assertFails(setDoc(doc(db, "users", UID_A), {
            fullName:    "Alice",
            primaryRole: "platform_admin",  // 🚨
        }));
    });

    it("owner cannot create doc with role field", async () => {
        const db = authedDb(env, UID_A);
        await assertFails(setDoc(doc(db, "users", UID_A), {
            fullName: "Alice",
            role:     "admin",              // 🚨
        }));
    });

    it("user cannot create another user's doc", async () => {
        const db = authedDb(env, UID_A);
        await assertFails(setDoc(doc(db, "users", UID_B), {
            fullName: "Bob",
        }));
    });

    it("unauthenticated user cannot create any doc", async () => {
        const db = unauthDb(env);
        await assertFails(setDoc(doc(db, "users", UID_A), {
            fullName: "Hacker",
        }));
    });
});

describe("users — update", () => {
    beforeEach(async () => {
        await seed(env, `users/${UID_A}`, BASE_USER);
    });

    it("owner can update safe fields", async () => {
        const db = authedDb(env, UID_A);
        await assertSucceeds(updateDoc(doc(db, "users", UID_A), {
            fullName: "Alice Updated",
        }));
    });

    it("owner cannot change primaryRole", async () => {
        const db = authedDb(env, UID_A);
        await assertFails(updateDoc(doc(db, "users", UID_A), {
            primaryRole: "platform_admin",  // 🚨
        }));
    });

    it("owner cannot change role field", async () => {
        const db = authedDb(env, UID_A);
        await assertFails(updateDoc(doc(db, "users", UID_A), {
            role: "admin",                  // 🚨
        }));
    });

    it("user cannot update another user's doc", async () => {
        const db = authedDb(env, UID_B);
        await assertFails(updateDoc(doc(db, "users", UID_A), {
            fullName: "Hacked",
        }));
    });
});

describe("users — read", () => {
    beforeEach(async () => {
        await seed(env, `users/${UID_A}`, BASE_USER);
    });

    it("signed-in user can read any profile", async () => {
        const db = authedDb(env, UID_B);
        await assertSucceeds(getDoc(doc(db, "users", UID_A)));
    });

    it("signed-in user can list users", async () => {
        const db = authedDb(env, UID_B);
        await assertSucceeds(getDocs(collection(db, "users")));
    });
});

describe("users — delete", () => {
    beforeEach(async () => {
        await seed(env, `users/${UID_A}`, BASE_USER);
    });

    it("owner can delete own doc", async () => {
        const db = authedDb(env, UID_A);
        await assertSucceeds(deleteDoc(doc(db, "users", UID_A)));
    });

    it("other user cannot delete someone else's doc", async () => {
        const db = authedDb(env, UID_B);
        await assertFails(deleteDoc(doc(db, "users", UID_A)));
    });
});