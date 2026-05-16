import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";

export { assertFails, assertSucceeds };
export type { RulesTestEnvironment };

export async function createTestEnv(): Promise<RulesTestEnvironment> {
    return initializeTestEnvironment({
        projectId: "z12-website",
        firestore: {
            // Inline rules — emulator MUST use these, not whatever is running
            rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
            host:  "127.0.0.1",
            port:  8080,
        },
    });
}

export function authedDb(env: RulesTestEnvironment, uid: string, claims: Record<string, any> = {}) {
    return env.authenticatedContext(uid, claims).firestore();
}

export function unauthDb(env: RulesTestEnvironment) {
    return env.unauthenticatedContext().firestore();
}

export async function seed(
    env: RulesTestEnvironment,
    path: string,
    data: Record<string, any>
) {
    await env.withSecurityRulesDisabled(async ctx => {
        await ctx.firestore().doc(path).set(data);
    });
}