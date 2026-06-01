/**
 * admin.types.ts
 *
 * Types for the federation/club admin role hierarchy introduced in
 * BigAdminsUpdate. All new Firestore collections are defined here.
 *
 * Role hierarchy (top → bottom):
 *   platformAdmin → federationAdmin → clubAdmin → rower / coach
 *
 * Custom-claim key: `role` (NOT `primaryRole` — that field is deprecated on user docs).
 * Claim shape per role:
 *   platformAdmin:   { role: "platformAdmin" }
 *   federationAdmin: { role: "federationAdmin", federationId: string }
 *   clubAdmin:       { role: "clubAdmin", clubId: string, federationId: string }
 *
 * Dual roles are supported — a clubAdmin may still have roles.rower or
 * roles.coach on their UserProfile. The `role` custom claim reflects the
 * highest-privilege role and is the enforcement mechanism in security rules.
 */

/** ISO-8601 timestamp string */
type ISOTimestamp = string;

// ── Role constants ────────────────────────────────────────────────────────────

export const ADMIN_ROLES = ["platformAdmin", "federationAdmin", "clubAdmin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ALL_ROLES = [
    "rower",
    "coach",
    "clubAdmin",
    "federationAdmin",
    "platformAdmin",
] as const;
export type UserRole = (typeof ALL_ROLES)[number];

// ── Club creation request ─────────────────────────────────────────────────────

/**
 * Firestore path: /clubCreationRequests/{requestId}
 *
 * Any authenticated user may create one. Only functions may update it.
 * On approval a real /clubs/{clubId} document is created and the requester
 * becomes the clubAdmin.
 */
export type ClubCreationRequest = {
    id: string;
    requestedBy: string;              // uid of the requester
    requesterDisplayName: string;     // denormalised
    requesterEmail: string;           // denormalised

    federationId: string;
    proposedClubName: string;
    proposedClubLocation: string;
    proposedClubDescription: string;
    supportingInfo: string | null;

    status: "pending" | "approved" | "rejected";

    submittedAt: ISOTimestamp;
    reviewedAt: ISOTimestamp | null;
    reviewedBy: string | null;        // federationAdmin or platformAdmin uid
    rejectionReason: string | null;

    /** Populated on approval — links the request to the resulting club for audit. */
    resultingClubId: string | null;
};

// ── Federation invite ─────────────────────────────────────────────────────────

/**
 * Firestore path: /federationInvites/{inviteId}
 *
 * Created by platformAdmin via the `inviteFederationAdmin` callable function.
 * The `token` field stores a SHA-256 hash of the raw token. The raw token is
 * only ever sent in the invite email link — it is never stored in Firestore.
 */
export type FederationInvite = {
    id: string;
    invitedEmail: string;
    federationId: string;
    federationName: string;           // denormalised for email template

    invitedBy: string;                // platformAdmin uid

    status: "pending" | "accepted" | "expired" | "revoked";

    /** SHA-256 hash of the raw token. Raw token is sent in the email only. */
    token: string;

    createdAt: ISOTimestamp;
    expiresAt: ISOTimestamp;
    acceptedAt: ISOTimestamp | null;
    acceptedByUid: string | null;
};

// ── In-app admin notification ─────────────────────────────────────────────────

/**
 * Firestore path: /users/{uid}/adminNotifications/{notificationId}
 *
 * Written by Cloud Functions. Used alongside email for admin events
 * (e.g. new club creation requests, approval/rejection outcomes).
 */
export type AdminNotification = {
    id: string;
    type:
        | "club_creation_request"
        | "club_approved"
        | "club_rejected"
        | "club_invite"
        | "federation_invite_accepted";
    title: string;
    body: string;
    /** Frontend route to navigate to on click, e.g. "/admin/federation" */
    linkPath: string | null;
    isRead: boolean;
    createdAt: ISOTimestamp;
};

// ── Club member invite ────────────────────────────────────────────────────────

/**
 * Firestore path: /clubInvites/{inviteId}
 *
 * Created by `inviteClubMember`. Target user responds via `respondToClubInvite`.
 * External invites (targetUid = null) are matched by email after signup.
 */
export type ClubInvite = {
    id:            string;
    clubId:        string;
    clubName:      string;
    invitedBy:     string;
    invitedByName: string;
    targetEmail:   string;
    targetUid:     string | null;
    memberRole:    "rower" | "coach";
    status:        "pending" | "accepted" | "declined";
    createdAt:     ISOTimestamp;
    respondedAt:   ISOTimestamp | null;
};

// ── Federation admin selection view ──────────────────────────────────────────

/**
 * Projected shape returned by the `getAthleteSelectionProfiles` callable
 * function for federationAdmins. Only available when the athlete has set
 * nationalSelectionVisible = true on their UserProfile.
 */
export type AthleteSelectionProfile = {
    uid: string;
    displayName: string;
    photoURL: string | null;
    clubId: string;
    clubName: string;
    dateOfBirth: string;
    ageGroup: string;
    gender: string;
    stats: {
        heightCm?: number;
        wingspanCm?: number;
        weightKg?: number;
    };
    performances: {
        best100m?: number;
        best500m?: number;
        best2000m?: number;
        best6000m?: number;
        best10000m?: number;
    };
    coachAssignments: {
        coachUid: string;
        coachDisplayName: string;
        roles: string[];
    }[];
};

// ── Club overview (always visible to federationAdmin, no opt-in required) ────

/**
 * Returned by the `getFederationClubOverviews` callable function.
 * Aggregated — never exposes individual member records directly.
 */
export type ClubOverview = {
    clubId: string;
    clubName: string;
    location: string;
    totalAthletes: number;
    totalCoaches: number;
    adminDisplayNames: string[];
    status: "active" | "suspended" | "pending_approval";
};
