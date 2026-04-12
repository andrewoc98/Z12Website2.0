export type Role = "rower" | "host" | "admin" | "coach" | "guardian";
export type Gender = "male" | "female" | "unknown";

export type UserProfile = {
    uid: string;

    email: string;
    displayName: string;
    fullName?: string;

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
    roles: {
        rower?: {
            club: string;
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
            };
        };

        coach?: {
            club: string;
        };

        host?: {
            name?: string;
            email?: string;
            location: string;
        };

        admin?: {
            name: string;
            email: string;
            hostId: string;
        };

        guardian?: {
            linkedChildPendingId: string;
            linkedChildName: string;
        };
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
};

export type PendingUser = {
    fullName: string;
    email: string;
    club: string;
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

export type ConsentOptions = {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    performanceTrackingAccepted?: boolean;
    dataSharingAccepted?: boolean;
    guardianUid:string;
};

export type AdminInvite = {
    id: string;
    used: boolean;
};
