import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import {
    RulesTestEnvironment, assertFails, assertSucceeds,
    createTestEnv, authedDb, unauthDb, seed,
} from "./helpers";
import {
    doc, setDoc, updateDoc, deleteDoc, getDoc,
    getDocs, collection, onSnapshot,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const HOST_UID  = "host-user";
const ROWER_UID = "rower-user";
const OTHER_UID = "other-user";
const EVENT_ID  = "erg-event-1";
const SCORE_ID  = `${ROWER_UID}__12345`;

async function seedErgEvent() {
    await seed(env, `events/${EVENT_ID}`, {
        hostId:    HOST_UID,
        name:      "Winter 2k",
        eventType: "erg",
        ergConfig: { machineType: "rower", distanceMeters: 2000 },
        createdAt: new Date().toISOString(),
    });
    await seed(env, `events/${EVENT_ID}/ergScores/${SCORE_ID}`, {
        id:       SCORE_ID,
        eventId:  EVENT_ID,
        entryId:  "entry-1",
        uid:      ROWER_UID,
        timeMs:   412300,
        status:   "ranked",
        source:   "concept2",
    });
}

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async ()  => { await env.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

describe("ergScores — read", () => {
    beforeEach(seedErgEvent);

    it("anyone signed out can read a score (public leaderboard)", async () => {
        const db = unauthDb(env);
        await assertSucceeds(getDoc(doc(db, `events/${EVENT_ID}/ergScores/${SCORE_ID}`)));
    });

    it("anyone can list the scores collection", async () => {
        const db = authedDb(env, OTHER_UID);
        await assertSucceeds(getDocs(collection(db, `events/${EVENT_ID}/ergScores`)));
    });
});

describe("ergScores — write is Cloud Functions only", () => {
    beforeEach(seedErgEvent);

    it("the athlete cannot create their own score", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(setDoc(doc(db, `events/${EVENT_ID}/ergScores/${ROWER_UID}__999`), {
            uid: ROWER_UID, timeMs: 300000, status: "ranked",
        }));
    });

    it("the athlete cannot edit their own score", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(updateDoc(doc(db, `events/${EVENT_ID}/ergScores/${SCORE_ID}`), {
            timeMs: 1,
        }));
    });

    // This is the important one: the {subCollection} catch-all grants the host
    // write on every event subcollection, so the ergScores block must override it.
    it("the event host cannot hand-write a score", async () => {
        const db = authedDb(env, HOST_UID);
        await assertFails(setDoc(doc(db, `events/${EVENT_ID}/ergScores/${HOST_UID}__1`), {
            uid: HOST_UID, timeMs: 300000, status: "ranked",
        }));
    });

    it("the event host cannot edit a score to change its status", async () => {
        const db = authedDb(env, HOST_UID);
        await assertFails(updateDoc(doc(db, `events/${EVENT_ID}/ergScores/${SCORE_ID}`), {
            status: "disqualified",
        }));
    });

    it("nobody can delete a score", async () => {
        const db = authedDb(env, HOST_UID);
        await assertFails(deleteDoc(doc(db, `events/${EVENT_ID}/ergScores/${SCORE_ID}`)));
    });

    it("an unauthenticated client cannot write a score", async () => {
        const db = unauthDb(env);
        await assertFails(setDoc(doc(db, `events/${EVENT_ID}/ergScores/anon__1`), { timeMs: 1 }));
    });
});

describe("users/{uid}/private — Concept2 tokens", () => {
    beforeEach(async () => {
        await seed(env, `users/${ROWER_UID}`, {
            fullName: "Rower User",
            roles:    { rower: { club: "Dublin RC" } },
        });
        await seed(env, `users/${ROWER_UID}/private/concept2`, {
            c2UserId:     42,
            accessToken:  "secret-access",
            refreshToken: "secret-refresh",
        });
    });

    it("the owner cannot read their own Concept2 tokens", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(getDoc(doc(db, `users/${ROWER_UID}/private/concept2`)));
    });

    it("another user cannot read someone's Concept2 tokens", async () => {
        const db = authedDb(env, OTHER_UID);
        await assertFails(getDoc(doc(db, `users/${ROWER_UID}/private/concept2`)));
    });

    it("the owner cannot write to their private subcollection", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(setDoc(doc(db, `users/${ROWER_UID}/private/concept2`), {
            accessToken: "forged",
        }));
    });

    it("the owner cannot delete their token doc", async () => {
        const db = authedDb(env, ROWER_UID);
        await assertFails(deleteDoc(doc(db, `users/${ROWER_UID}/private/concept2`)));
    });
});


describe("erg leaderboard streams live", () => {
    beforeEach(seedErgEvent);

    const ENTRY = {
        id: "entry-1", eventId: EVENT_ID, boatSize: 1,
        rowerUids: [ROWER_UID], clubName: "Neptune RC",
        categoryId: "Men • Senior Open", categoryName: "Men • Senior Open",
        status: "registered",
    };

    // The results tab subscribes to the entries collection so scores appear as
    // they import from Concept2. That listen has to survive the rules for a
    // signed-out visitor, since the event page is public.
    it("an unauthenticated visitor receives a new best time without refetching", async () => {
        const db = unauthDb(env);

        await seed(env, `events/${EVENT_ID}/boats/entry-1`, {
            ...ENTRY, ergBestTimeMs: 412_300, ergScoreCount: 1,
        });

        const seen: Array<number | undefined> = [];
        let onFirst: () => void;
        let onUpdate: () => void;
        const first  = new Promise<void>(res => { onFirst = res; });
        const updated = new Promise<void>(res => { onUpdate = res; });

        const unsub = onSnapshot(collection(db, `events/${EVENT_ID}/boats`), snap => {
            const entry = snap.docs.find(d => d.id === "entry-1");
            seen.push(entry?.data().ergBestTimeMs as number | undefined);
            if (seen.length === 1) onFirst();
            if (seen[seen.length - 1] === 401_100) onUpdate();
        });

        // Attach before writing, or the first snapshot can already carry the
        // new value and the update is never observed as a change.
        await first;
        expect(seen[0]).toBe(412_300);

        // A faster piece imports — the board must move on its own.
        await seed(env, `events/${EVENT_ID}/boats/entry-1`, {
            ...ENTRY, ergBestTimeMs: 401_100, ergScoreCount: 2,
        });

        await updated;
        unsub();

        expect(seen.length).toBeGreaterThan(1);
        expect(seen[seen.length - 1]).toBe(401_100);
    });
});
