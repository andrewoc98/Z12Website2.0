import { httpsCallable } from "firebase/functions";
import {
    collection, doc, getDoc, getDocs,
    query, where, orderBy, updateDoc, serverTimestamp,
    deleteField, limit,
} from "firebase/firestore";
import { functions, db } from "../../../shared/lib/firebase";
import type { Club } from "../../auth/club";
import type { ClubCreationRequest, AdminNotification, ClubInvite } from "../types/admin.types";

// ── Callable helper ───────────────────────────────────────────────────────────

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

// ── Callable function wrappers ────────────────────────────────────────────────

export const submitClubCreationRequest = call<
    {
        federationId:             string;
        proposedClubName:         string;
        proposedClubLocation:     string;
        proposedClubDescription:  string;
        supportingInfo?:          string;
    },
    { requestId: string }
>("submitClubCreationRequest");

export const approveClubCreationRequest = call<
    { requestId: string },
    { clubId: string }
>("approveClubCreationRequest");

export const rejectClubCreationRequest = call<
    { requestId: string; rejectionReason: string },
    { success: true }
>("rejectClubCreationRequest");

export const suspendClub = call<
    { clubId: string; reason: string },
    { success: true }
>("suspendClub");

export const reactivateClub = call<
    { clubId: string },
    { success: true }
>("reactivateClub");

export const inviteClubAdmin = call<
    { clubId: string; targetEmail: string },
    { success: true; isExistingUser: boolean }
>("inviteClubAdmin");

export const appointClubAdmin = call<
    { targetEmail: string; canManageAdmins: boolean },
    { success: true; isExistingUser: boolean }
>("appointClubAdmin");

export const removeClubAdmin = call<
    { targetUid: string },
    { success: true }
>("removeClubAdmin");

export const claimClubAdminInvite = call<
    { inviteId: string },
    { success: true }
>("claimClubAdminInvite");

export const autoClaimClubAdminInvites = call<
    Record<string, never>,
    { claimed: boolean; clubId: string | null }
>("autoClaimClubAdminInvites");

export const inviteClubMember = call<
    { targetEmail: string; memberRole: "rower" | "coach" },
    { inviteId: string; isExistingUser: boolean }
>("inviteClubMember");

export const respondToClubInvite = call<
    { inviteId: string; action: "accept" | "decline" },
    { success: true }
>("respondToClubInvite");

export const adminRemoveMember = call<
    { targetUid: string; memberRole: "rower" | "coach"; reason: string },
    { success: true }
>("adminRemoveMember");

// ── Firestore reads ───────────────────────────────────────────────────────────

export async function getClub(clubId: string): Promise<Club | null> {
    const snap = await getDoc(doc(db, "clubs", clubId));
    return snap.exists() ? (snap.data() as Club) : null;
}

export async function getClubsForFederation(federationId: string): Promise<Club[]> {
    const snap = await getDocs(
        query(
            collection(db, "clubs"),
            where("federationId", "==", federationId),
            orderBy("name")
        )
    );
    return snap.docs.map(d => d.data() as Club);
}

/** All requests for a federation — for federationAdmin and platformAdmin dashboards. */
export async function getClubCreationRequestsForFederation(
    federationId: string,
    status?: ClubCreationRequest["status"]
): Promise<ClubCreationRequest[]> {
    const constraints = [
        where("federationId", "==", federationId),
        ...(status ? [where("status", "==", status)] : []),
        orderBy("submittedAt", "desc"),
    ];
    const snap = await getDocs(query(collection(db, "clubCreationRequests"), ...constraints));
    return snap.docs.map(d => d.data() as ClubCreationRequest);
}

/** A specific user's own requests — for the request status tracker UI. */
export async function getMyClubCreationRequests(uid: string): Promise<ClubCreationRequest[]> {
    const snap = await getDocs(
        query(
            collection(db, "clubCreationRequests"),
            where("requestedBy", "==", uid),
            orderBy("submittedAt", "desc")
        )
    );
    return snap.docs.map(d => d.data() as ClubCreationRequest);
}

/**
 * Returns athletes with nationalSelectionVisible=true who are active members
 * of any of the supplied clubIds. Coach assignments are excluded — the security
 * rules only allow a rower to read their own coachAssignments subcollection.
 */
export async function getAthleteSelectionProfiles(
    clubIds: string[]
): Promise<import("../types/admin.types").AthleteSelectionProfile[]> {
    if (clubIds.length === 0) return [];

    // 1. Collect active member UIDs across all clubs in the federation.
    // We intentionally do NOT filter by role="rower" here because a user
    // who has both rower and coach roles in the same club gets a single
    // member document whose `role` reflects whichever role joined first.
    // Rower eligibility is confirmed at step 3 via the user profile.
    const memberSnaps = await Promise.all(
        clubIds.map(clubId =>
            getDocs(query(
                collection(db, `clubs/${clubId}/members`),
                where("status", "==", "active"),
            ))
        )
    );

    // Map uid → clubId (keep the first club if member of multiple)
    const uidToClubId = new Map<string, string>();
    memberSnaps.forEach((snap, i) => {
        snap.docs.forEach(d => {
            if (!uidToClubId.has(d.id)) uidToClubId.set(d.id, clubIds[i]);
        });
    });

    const uids = [...uidToClubId.keys()];
    if (uids.length === 0) return [];

    // 2. Batch-fetch user profiles (Firestore `in` limit: 30 per query)
    const BATCH = 30;
    const profileSnaps = await Promise.all(
        chunk(uids, BATCH).map(batch =>
            getDocs(query(collection(db, "users"), where("uid", "in", batch)))
        )
    );

    const results: import("../types/admin.types").AthleteSelectionProfile[] = [];

    profileSnaps.forEach(snap => {
        snap.docs.forEach(d => {
            const u = d.data();
            // 3. Only include users who actually have the rower role on their
            //    profile and have opted in to national selection visibility.
            if (!u.roles?.rower) return;
            if (!u.consent?.nationalSelectionVisible && !u.nationalSelectionVisible) return;

            const clubId   = uidToClubId.get(u.uid) ?? "";
            const clubSnap = clubIds.includes(clubId) ? clubId : "";

            results.push({
                uid:          u.uid,
                displayName:  u.displayName ?? "",
                photoURL:     u.photoURL    ?? null,
                clubId,
                clubName:     u.roles?.rower?.clubMemberships?.find(
                    (m: { clubId: string }) => m.clubId === clubId
                )?.clubName ?? clubSnap,
                dateOfBirth:  u.dateOfBirth  ?? "",
                ageGroup:     u.ageGroup     ?? "",
                gender:       u.gender       ?? "",
                stats:        u.roles?.rower?.stats        ?? {},
                performances: u.roles?.rower?.performances ?? {},
                coachAssignments: [], // requires server-side Function — not readable client-side
            });
        });
    });

    return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export type ClubAdminProfile = {
    uid:             string;
    displayName:     string;
    email:           string;
    canManageAdmins: boolean;
};

/** Fetches display info for each UID in the club's adminUids array. */
export async function getClubAdminProfiles(adminUids: string[]): Promise<ClubAdminProfile[]> {
    if (!adminUids.length) return [];
    const snaps = await Promise.all(adminUids.map(uid => getDoc(doc(db, "users", uid))));
    return snaps
        .filter(s => s.exists())
        .map(s => {
            const d = s.data()!;
            return {
                uid:             s.id,
                displayName:     d.displayName ?? "",
                email:           d.email       ?? "",
                canManageAdmins: d.roles?.clubAdmin?.canManageAdmins === true,
            };
        });
}

/** Active members of a club, ordered by role then displayName. */
export async function getClubMembers(clubId: string) {
    const snap = await getDocs(
        query(
            collection(db, `clubs/${clubId}/members`),
            where("status", "==", "active"),
            orderBy("role"),
            orderBy("displayName"),
        )
    );
    return snap.docs.map(d => d.data() as import("../../../features/auth/club").ClubMembership);
}

/**
 * Updates safe club fields directly from the client.
 * ClubAdmin is permitted to update these per the Firestore security rules.
 */
export async function updateClubInfo(
    clubId: string,
    data: Partial<{
        name:          string;
        contactEmail:  string;
        websiteUrl:    string;
        openMembership: boolean;
        location: { city?: string; country?: string };
    }>
): Promise<void> {
    const { location, ...rest } = data;

    // Firestore rejects undefined — replace with deleteField() to clear optional fields
    const payload: Record<string, unknown> = {
        ...Object.fromEntries(
            Object.entries(rest).map(([k, v]) => [k, v ?? deleteField()])
        ),
        updatedAt: serverTimestamp(),
    };

    // Dot-notation keeps sibling location keys intact
    if (location !== undefined) {
        payload["location.city"]    = location.city    ?? deleteField();
        payload["location.country"] = location.country ?? deleteField();
    }

    await updateDoc(doc(db, "clubs", clubId), payload);
}

/** Unread in-app admin notifications for the given user. */
export async function getAdminNotifications(uid: string): Promise<AdminNotification[]> {
    const snap = await getDocs(
        query(
            collection(db, `users/${uid}/adminNotifications`),
            orderBy("createdAt", "desc")
        )
    );
    return snap.docs.map(d => d.data() as AdminNotification);
}

/**
 * Returns pending club invites for the current user.
 * Two queries are merged:
 *  1. Invites where targetUid == uid (existing-user invites)
 *  2. Invites where targetEmail == email AND targetUid == null (external invites
 *     that were created before the user signed up)
 */
export async function getPendingClubInvites(uid: string, email: string): Promise<ClubInvite[]> {
    const normalEmail = email.toLowerCase();

    const [byUidSnap, byEmailSnap] = await Promise.all([
        getDocs(query(
            collection(db, "clubInvites"),
            where("targetUid", "==", uid),
            where("status",    "==", "pending"),
        )),
        getDocs(query(
            collection(db, "clubInvites"),
            where("targetEmail", "==", normalEmail),
            where("status",      "==", "pending"),
            limit(20),
        )),
    ]);

    const seen    = new Set<string>();
    const results: ClubInvite[] = [];

    for (const snap of [byUidSnap, byEmailSnap]) {
        for (const d of snap.docs) {
            if (seen.has(d.id)) continue;
            const inv = d.data() as ClubInvite;
            // For the email query, only include docs where targetUid is null
            // (i.e. genuinely external invites not yet claimed by this uid)
            if (snap === byEmailSnap && inv.targetUid !== null) continue;
            seen.add(d.id);
            results.push(inv);
        }
    }

    return results;
}
