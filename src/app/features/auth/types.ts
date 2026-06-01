/**
 * user.types.ts
 *
 * Changes from previous version:
 *  - roles.rower.clubMembership  (ClubRef)   → roles.rower.clubMemberships  (ClubRef[])
 *  - roles.coach.clubMembership  (ClubRef)   → roles.coach.clubMemberships  (ClubRef[])
 *  - PendingUser.club            (string)    → PendingUser.clubId            (string | undefined)
 *
 * A ClubRef is a lightweight pointer that avoids a second Firestore read in
 * common rendering scenarios while keeping the canonical source of truth in
 * /clubs/{clubId}/members/{uid}.
 */
import type {ClubMemberRole} from "./club.ts";


export type Role =
    | "rower"
    | "host"
    | "admin"
    | "coach"
    | "guardian"
    | "clubAdmin"
    | "federationAdmin"
    | "platformAdmin";
export type Gender = "male" | "female" | "unknown";

// ── Guardian child reference ───────────────────────────────────────────────────
export type LinkedChild = {
    childPendingId: string;
    childName: string;
    approvedAt: string;
    childUid?: string;
};

// ── Club reference (denormalised snapshot stored on the user) ─────────────────

/**
 * A lightweight, denormalised pointer to a club membership.
 * Stored in the clubMemberships array on the user document so that club names
 * can be rendered without extra Firestore reads.
 *
 * IMPORTANT: When Club.name or Club.logoUrl changes, update every ClubRef that
 * points to that club via a Cloud Function triggered on /clubs/{clubId} writes.
 */
export type ClubRef = {
    clubId: string;
    clubName: string;       // denormalised — kept in sync via Cloud Function
    clubShortName?: string; // denormalised
    logoUrl?: string;       // denormalised
    federationId?:    string;
    role: ClubMemberRole;   // the member's role within this club
    membershipStatus: "pending" | "active" | "suspended";
    joinedAt: string;       // ISOTimestamp
};

// ── User Profile ──────────────────────────────────────────────────────────────

export type UserProfile = {
    uid: string;

    email: string;
    displayName: string;
    fullName?: string;
    mobile?: string;

    /**
     * @deprecated Use `roles.*` sub-objects to determine a user's role.
     * Still written by the existing rower/coach/host onboarding flow for
     * backward compatibility, but admin roles (clubAdmin, federationAdmin,
     * platformAdmin) no longer set this field. Check `roles.clubAdmin`,
     * `roles.federationAdmin`, or `roles.platformAdmin` instead.
     */
    primaryRole?: Role;

    // -------------------
    // DEMOGRAPHICS
    // -------------------
    gender: Gender;
    dateOfBirth: string; // "YYYY-MM-DD"
    birthYear?: number;
    ageGroup?: "junior" | "u19" | "u21" | "u23" | "senior" | "masters";

    isMinor: boolean;
    parentId?: string;

    consent: {
        termsAcceptedAt?: string;
        privacyAcceptedAt?: string;
        performanceTrackingAccepted?: boolean;
        dataSharingAccepted?: boolean;
        biometricProcessingAccepted?: boolean;
        givenBy: "self" | "parent";
        givenByUid?: string;
        updatedAt?: string;
    };

    permissions: {
        shareWithCoaches: boolean;
        shareWithUniversities: boolean;
        shareWithFederations: boolean;
    };

    /**
     * Athlete-controlled flag. When true, federationAdmins in the same
     * federation can see this athlete's full selection profile (stats,
     * performances, coach assignments). Defaults to false.
     * Only meaningful when roles.rower is present.
     */
    nationalSelectionVisible?: boolean;

    roles: {
        rower?: {
            /**
             * All clubs this rower currently belongs to.
             * Empty array = not a member of any club yet.
             * Canonical membership records live at /clubs/{clubId}/members/{uid}.
             */
            clubMemberships: ClubRef[];

            coachId?: string;

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
        };

        coach?: {
            /**
             * All clubs this coach currently belongs to.
             * Empty array = not attached to any club yet.
             */
            clubMemberships: ClubRef[];
            openAssignment?: boolean; // defaults to true when absent
        };

        host?: {
            name?: string;
            email?: string;
            location: string;
        };

        admin?: {
            name?: string;
            email?: string;
            hostIds: string[];
            inviteId?: string;
        };

        guardian?: {
            linkedChildren: LinkedChild[];
        };

        // ── Admin roles (dual-role: a clubAdmin may also have roles.rower) ──

        clubAdmin?: {
            clubId: string;
            federationId: string;
        };

        federationAdmin?: {
            federationId: string;
        };

        /**
         * No extra fields — presence of this key is sufficient.
         * The custom claim `role: "platformAdmin"` is the enforcement mechanism.
         */
        platformAdmin?: Record<string, never>;
    };

    // -------------------
    // ACCOUNT STATUS
    // -------------------
    status: {
        isActive: boolean;
        isVerified: boolean;
        requiresParentalConsent?: boolean;
    };

    // -------------------
    // METADATA
    // -------------------
    createdAt: string;
    updatedAt: string;

    hasSeenTour?: boolean;
};

// ── Pending User ──────────────────────────────────────────────────────────────

export type PendingUser = {
    fullName: string;
    email: string;
    /**
     * Optional: the club the pending user intends to join.
     * Storing the ID (not the name string) makes it resilient to club renames.
     * Resolved to a ClubRef once the account is fully created.
     */
    clubId?: string;
    dateOfBirth: string;
    parentEmail?: string;
    consent?: {
        termsAccepted: boolean;
        privacyAccepted: boolean;
        performanceTrackingAccepted?: boolean;
        dataSharingAccepted?: boolean;
        givenBy?: "parent" | "self";
        approvedAt?: string;
    };
};

// ── Supporting types (unchanged) ──────────────────────────────────────────────

export type ConsentOptions = {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    performanceTrackingAccepted?: boolean;
    dataSharingAccepted?: boolean;
    guardianUid: string;
};

export type AdminInvite = {
    id: string;
    used: boolean;
};