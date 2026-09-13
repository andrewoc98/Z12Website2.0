import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";

/**
 * Callable errors reach the UI as a bare message, which hides the Firebase
 * error code — the part that says whether a Stripe connect failure was a
 * permission problem, a precondition, or a genuine internal fault. Hosts ignore
 * the suffix; whoever is helping them debug needs it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function callableErrorText(e: any, fallback: string): string {
    const msg = e?.message ?? fallback;
    return e?.code ? `${msg} (${e.code})` : msg;
}

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

export const createConnectAccount = call<
    Record<string, never>,
    { url: string }
>("createConnectAccount");

/**
 * Express Dashboard link for an already-connected account. `kind` is
 * "onboarding" when Stripe still wants details before it will open the
 * dashboard, so the UI can say where the host is actually being sent.
 */
export const createConnectLoginLink = call<
    Record<string, never>,
    { url: string; kind: "dashboard" | "onboarding" }
>("createConnectLoginLink");

export type ConnectStatus = {
    connected:        boolean;
    accountId:        string | null;
    onboarded:        boolean;
    detailsSubmitted: boolean;
    payoutsEnabled:   boolean;
    chargesEnabled:   boolean;
    disabledReason:   string | null;
    currentlyDue:     string[];
    pastDue:          string[];
    checkedAt:        number;
};

export const refreshConnectStatus = call<Record<string, never>, ConnectStatus>(
    "refreshConnectStatus"
);

export const cancelEvent = call<
    { eventId: string; reason: string },
    { success: boolean; refundedCount: number; failedCount: number }
>("cancelEvent");

export const removeCrewMember = call<
    { bookingId: string; targetUid: string },
    { success: boolean }
>("removeCrewMember");

export const submitReview = call<
    { eventId: string; rating: number; comment: string },
    { success: boolean }
>("submitReview");
