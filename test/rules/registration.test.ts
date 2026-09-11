import { describe, it, beforeAll, afterAll, afterEach } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import { doc, setDoc, Timestamp } from "firebase/firestore";

let env: RulesTestEnvironment;
const DAY = 24 * 60 * 60 * 1000;
const ts = (off: number) => Timestamp.fromMillis(Date.now() + off);

beforeAll(async () => {
    env = await initializeTestEnvironment({
        // Its own project id rather than helpers.createTestEnv(): Firestore
        // namespaces data per project, so clearing between cases here cannot
        // touch the seeded dev data sitting in the same running emulator.
        projectId: "z12-rules-registration-check",
        firestore: {
            rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
            host: "127.0.0.1",
            port: 8080,
        },
    });
});
afterAll(async () => { await env?.cleanup(); });
afterEach(async () => { await env.clearFirestore(); });

async function seedEvent(id: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async ctx => {
        await ctx.firestore().doc(`events/${id}`).set({
            name: id, clubId: "club-1", hostId: "host-1", createdByUid: "host-1",
            startAt: ts(5 * DAY), endAt: ts(6 * DAY), status: "open", categories: [],
            ...data,
        });
    });
}

function entry(eventId: string, uid: string) {
    const db = env.authenticatedContext(uid, {}).firestore();
    return setDoc(doc(db, `events/${eventId}/boats/boat-${uid}`), {
        eventId, categoryId: "c1", rowerUids: [uid], createdByUid: uid, status: "registered",
    });
}

describe("boat create honours the registration window", () => {
    it("allows an entry while the closing date is in the future", async () => {
        await seedEvent("e-open", { closeAt: ts(2 * DAY) });
        await assertSucceeds(entry("e-open", "rower-1"));
    });

    it("blocks an entry once the closing date has passed", async () => {
        await seedEvent("e-past-close", { closeAt: ts(-DAY) });
        await assertFails(entry("e-past-close", "rower-2"));
    });

    it("blocks an entry when the host has closed registration", async () => {
        await seedEvent("e-manual-closed", { closeAt: ts(2 * DAY), registrationOpen: false });
        await assertFails(entry("e-manual-closed", "rower-3"));
    });

    it("allows an entry the host has manually held open past the closing date", async () => {
        await seedEvent("e-manual-open", { closeAt: ts(-DAY), registrationOpen: true });
        await assertSucceeds(entry("e-manual-open", "rower-4"));
    });

    it("allows an entry on a no-closing-date event before it is held", async () => {
        await seedEvent("e-no-close", { closeAt: ts(6 * DAY), noClosingDate: true, registrationOpen: true });
        await assertSucceeds(entry("e-no-close", "rower-5"));
    });

    it("blocks an entry after the event has been held, switch open or not", async () => {
        await seedEvent("e-held", {
            startAt: ts(-3 * DAY), endAt: ts(-DAY), closeAt: ts(-DAY), registrationOpen: true,
        });
        await assertFails(entry("e-held", "rower-6"));
    });
});
