import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

/** Returns the Concept2 authorize URL to redirect the browser to. */
export const startConcept2Link = call<Record<string, never>, { url: string }>("startConcept2Link");

/** Drops the stored tokens. Scores already imported are kept. */
export const unlinkConcept2 = call<Record<string, never>, { success: true }>("unlinkConcept2");

/** Pulls the caller's Concept2 results for one erg event and imports the valid ones. */
export const syncErgScores = call<
    { eventId: string },
    {
        imported: number;
        ranked: number;
        skipped: number;
        bestTimeMs: number | null;
        throttled: boolean;
    }
>("syncErgScores");

/** Host only — strikes a score out of the rankings with an athlete-facing reason. */
export const disqualifyErgScore = call<
    { eventId: string; scoreId: string; reason: string },
    { success: true }
>("disqualifyErgScore");

/** Host only — reverses a disqualification, re-applying the original eligibility check. */
export const reinstateErgScore = call<
    { eventId: string; scoreId: string },
    { success: true; status: string }
>("reinstateErgScore");
