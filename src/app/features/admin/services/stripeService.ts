import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

export const createConnectAccount = call<
    Record<string, never>,
    { url: string }
>("createConnectAccount");

export const cancelEvent = call<
    { eventId: string; reason: string },
    { success: boolean; refundedCount: number; failedCount: number }
>("cancelEvent");

export const removeCrewMember = call<
    { bookingId: string; targetUid: string },
    { success: boolean }
>("removeCrewMember");
