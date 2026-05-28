/**
 * club.types.ts
 *
 * Club and Federation domain types.
 *
 * Design decisions:
 *  - Clubs are top-level Firestore documents at /clubs/{clubId}
 *  - Federations are top-level Firestore documents at /federations/{federationId}
 *  - A Club may belong to zero or one Federation
 *  - Membership is the join record between a User and a Club; it lives at
 *    /clubs/{clubId}/members/{uid} so it can be listed cheaply with a
 *    collection-group query and secured per-club with Firestore rules
 *  - All sensitive admin fields (inviteCodes, stripeCustomerId, etc.) live in
 *    a separate /clubs/{clubId}/private/config subcollection so they are never
 *    readable by ordinary club members
 */

// ── Shared primitives ─────────────────────────────────────────────────────────

/** ISO-8601 timestamp string, e.g. "2024-06-01T12:00:00.000Z" */
type ISOTimestamp = string;

/** Firestore document ID */
type DocId = string;

// ── Federation ────────────────────────────────────────────────────────────────

/**
 * A governing body that oversees one or more clubs.
 * Example: "Rowing Ireland", "British Rowing"
 *
 * Firestore path: /federations/{federationId}
 * Security: readable by authenticated users; writable only by federation admins
 */
export type Federation = {
    id: DocId;

    name: string; // "Rowing Ireland"
    shortName?: string; // "RI"
    sport: string; // "rowing" — free-form to support future sports

    logoUrl?: string;
    websiteUrl?: string;
    contactEmail?: string;

    /** Country or region this federation governs */
    country: string; // ISO 3166-1 alpha-2, e.g. "IE"
    region?: string;

    /** UIDs of users who can administer this federation */
    adminUids: string[];

    status: "active" | "inactive" | "suspended";

    createdAt: ISOTimestamp;
    updatedAt: ISOTimestamp;
};

// ── Club ──────────────────────────────────────────────────────────────────────

export type ClubStatus = "active" | "inactive" | "suspended" | "pending_approval";

/**
 * Public, readable club document.
 *
 * Firestore path: /clubs/{clubId}
 * Security: readable by any authenticated user; writable only by club admins
 *
 * Sensitive fields (inviteCodes, billing, etc.) live in
 * /clubs/{clubId}/private/config — never put them here.
 */
export type Club = {
    id: DocId;

    name: string; // "Neptune Rowing Club"
    shortName?: string; // "Neptune RC"
    sport: string; // "rowing"

    /** Optional parent federation */
    federationId?: DocId;

    logoUrl?: string;
    bannerUrl?: string;
    websiteUrl?: string;
    contactEmail?: string;
    phoneNumber?: string;

    location: ClubLocation;

    /** UIDs of users with club-admin rights */
    adminUids: string[];

    /**
     * Counts are denormalised here so the club listing page can render
     * without issuing a collection-group count query on every load.
     * Keep these in sync via Cloud Functions / transactions.
     */
    memberCount: number;
    rowerCount: number;
    coachCount: number;

    status: ClubStatus;

    /** Whether new members can join without admin approval */
    openMembership: boolean;

    createdAt: ISOTimestamp;
    updatedAt: ISOTimestamp;
};

export type ClubLocation = {
    addressLine1?: string;
    addressLine2?: string;
    city: string;
    county?: string; // relevant for IE/UK
    country: string; // ISO 3166-1 alpha-2
    postCode?: string;

    /** For map pins and geo-queries */
    lat?: number;
    lng?: number;
};

// ── Club private config (subcollection, admin-only) ───────────────────────────

/**
 * Sensitive club data that must never be exposed to ordinary members.
 *
 * Firestore path: /clubs/{clubId}/private/config
 * Security: readable/writable ONLY by users listed in Club.adminUids
 */
export type ClubPrivateConfig = {
    /**
     * Hashed invite codes.  Store SHA-256(code) so that even if this
     * document is accidentally exposed the raw codes remain secret.
     * Generate raw codes server-side (Cloud Function) and email them.
     */
    inviteCodeHashes: InviteCodeRecord[];

    /** Optional Stripe customer ID for subscription billing */
    stripeCustomerId?: string;

    /** Internal notes visible only to admins */
    adminNotes?: string;

    updatedAt: ISOTimestamp;
};

export type InviteCodeRecord = {
    codeHash: string; // SHA-256 hex of the raw invite code
    label?: string; // e.g. "2024 Junior Intake"
    role: ClubMemberRole; // what role the invitee will receive
    maxUses: number | null; // null = unlimited
    useCount: number;
    expiresAt?: ISOTimestamp;
    createdAt: ISOTimestamp;
    createdByUid: string;
    isRevoked: boolean;
};

// ── Club Membership ───────────────────────────────────────────────────────────

export type ClubMemberRole = "rower" | "coach" | "admin" | "committee";

export type MembershipStatus =
    | "pending" // waiting for admin approval
    | "active"
    | "suspended"
    | "left" // user voluntarily left
    | "removed"; // removed by admin

/**
 * Join record between a user and a club.
 *
 * Firestore path: /clubs/{clubId}/members/{uid}
 *
 * Security rules should ensure:
 *   - A user can read their own membership document
 *   - Club admins can read/write all membership documents in their club
 *   - No user can elevate their own role
 *   - Creation is allowed when openMembership=true OR a valid invite code is presented
 */
export type ClubMembership = {
    uid: string; // mirrors the document ID for easy reads
    clubId: DocId;

    displayName: string; // denormalised snapshot — avoids a user lookup in lists
    email: string; // denormalised snapshot
    avatarUrl?: string; // denormalised snapshot

    role: ClubMemberRole;
    status: MembershipStatus;

    /** Set when the member used an invite code to join */
    joinedViaInviteCodeHash?: string;

    /** UID of the admin who approved/suspended/removed this member */
    actionedByUid?: string;

    /** Reason supplied when suspending or removing a member */
    actionReason?: string;

    joinedAt: ISOTimestamp;
    updatedAt: ISOTimestamp;
};

// ── Membership request (optional approval flow) ───────────────────────────────

/**
 * Created when a user requests to join a club that has openMembership=false
 * and no valid invite code.
 *
 * Firestore path: /clubs/{clubId}/membershipRequests/{uid}
 *
 * Security rules should ensure:
 *   - A user can create their own request (max 1 per club — enforce in rules)
 *   - Club admins can read all requests and update status
 *   - Users can read/delete their own request
 */
export type MembershipRequest = {
    uid: string;
    clubId: DocId;

    displayName: string;
    email: string;

    requestedRole: Extract<ClubMemberRole, "rower" | "coach">;
    message?: string; // optional note from the applicant

    status: "pending" | "approved" | "rejected";

    reviewedByUid?: string;
    reviewNote?: string;

    createdAt: ISOTimestamp;
    updatedAt: ISOTimestamp;
};