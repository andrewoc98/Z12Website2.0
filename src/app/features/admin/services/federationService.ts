import { httpsCallable } from "firebase/functions";
import {
    collection, doc, getDoc, getDocs,
    query, where, orderBy,
} from "firebase/firestore";
import { functions, db, auth } from "../../../shared/lib/firebase";
import type { Federation } from "../../auth/club";
import type { FederationInvite } from "../types/admin.types";

// ── Callable helper (matches coachAssignmentService pattern) ──────────────────

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Forces an ID token refresh so newly-set custom claims become visible
 * on the client. Call this whenever a Function returns requiresTokenRefresh: true.
 */
export async function forceTokenRefresh(): Promise<void> {
    await auth.currentUser?.getIdToken(/* forceRefresh */ true);
}

// ── Callable function wrappers ────────────────────────────────────────────────

export const listActiveFederations = call<
    Record<string, never>,
    { federations: { id: string; name: string; country: string; slug: string }[] }
>("listActiveFederations");

export const createFederation = call<
    {
        name:          string;
        country:       string;
        contactEmail:  string;
        shortName?:    string;
        sport?:        string;
        websiteUrl?:   string;
    },
    { federationId: string }
>("createFederation");

export const inviteFederationAdmin = async (
    data: { email: string; federationId: string }
): Promise<{ inviteId: string }> => {
    // Force-refresh the token before calling the function so the latest
    // custom claims (role: "platformAdmin") are present in the JWT sent
    // to the Functions emulator. Without this, a stale cached token
    // (issued before setCustomUserClaims ran) causes a 403.
    await forceTokenRefresh();
    const fn = httpsCallable<{ email: string; federationId: string }, { inviteId: string }>(
        functions, "inviteFederationAdmin"
    );
    return (await fn(data)).data;
};

export const acceptFederationAdminInvite = call<
    { token: string; inviteId: string },
    { federationId: string; requiresTokenRefresh: true }
>("acceptFederationAdminInvite");

export const updateFederationSettings = call<
    { autoApproveClubRequests: boolean },
    { success: true }
>("updateFederationSettings");

// ── Firestore reads ───────────────────────────────────────────────────────────

export async function getFederation(federationId: string): Promise<Federation | null> {
    const snap = await getDoc(doc(db, "federations", federationId));
    return snap.exists() ? (snap.data() as Federation) : null;
}

export async function getAllFederations(): Promise<Federation[]> {
    const snap = await getDocs(
        query(collection(db, "federations"), orderBy("name"))
    );
    return snap.docs.map(d => d.data() as Federation);
}

export async function getFederationInvites(federationId?: string): Promise<FederationInvite[]> {
    const constraints = federationId
        ? [where("federationId", "==", federationId), orderBy("createdAt", "desc")]
        : [orderBy("createdAt", "desc")];
    const snap = await getDocs(query(collection(db, "federationInvites"), ...constraints));
    return snap.docs.map(d => d.data() as FederationInvite);
}

export async function getPendingFederationInvites(federationId?: string): Promise<FederationInvite[]> {
    const constraints = [
        where("status", "==", "pending"),
        ...(federationId ? [where("federationId", "==", federationId)] : []),
        orderBy("createdAt", "desc"),
    ];
    const snap = await getDocs(query(collection(db, "federationInvites"), ...constraints));
    return snap.docs.map(d => d.data() as FederationInvite);
}
