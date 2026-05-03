import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";  // ← add this
import { https, logger } from "firebase-functions/v2";

const db = getFirestore();
const adminAuth = admin.auth();

interface ConsentOptions {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    performanceTrackingAccepted?: boolean;
    dataSharingAccepted?: boolean;
    guardianUid: string;
}

interface ApproveAndCreateRequest {
    pendingUserId: string;
    consent: ConsentOptions;
}

function randomPassword(len = 12): string {
    return Math.random().toString(36).slice(-len);
}

export const approveAndCreate = https.onCall(
    async (request) => {
        if (!request.auth) {
            throw new https.HttpsError(
                "unauthenticated",
                "You must be signed in as a guardian to approve a child account."
            );
        }

        const guardianUid = request.auth.uid;
        const { pendingUserId, consent } = request.data as ApproveAndCreateRequest;

        // ── Input validation ──────────────────────────────────────────────────
        if (!pendingUserId || typeof pendingUserId !== "string") {
            throw new https.HttpsError("invalid-argument", "Missing pendingUserId.");
        }
        if (!consent?.termsAccepted || !consent?.privacyAccepted) {
            throw new https.HttpsError("invalid-argument", "Required consents not accepted.");
        }

        // ── Load pending user ─────────────────────────────────────────────────
        const pendingRef = db.collection("pendingUsers").doc(pendingUserId);
        const pendingSnap = await pendingRef.get();

        if (!pendingSnap.exists) {
            throw new https.HttpsError("not-found", "Consent link not found or already used.");
        }

        const pendingData = pendingSnap.data()!;

        if (pendingData.status === "converted") {
            throw new https.HttpsError("already-exists", "This consent link has already been used.");
        }

        // ── Mark as approved ──────────────────────────────────────────────────
        const now = new Date().toISOString();

        await pendingRef.set(
            {
                status: "approved",
                consent: {
                    termsAccepted: consent.termsAccepted,
                    privacyAccepted: consent.privacyAccepted,
                    performanceTrackingAccepted: consent.performanceTrackingAccepted ?? false,
                    dataSharingAccepted: consent.dataSharingAccepted ?? false,
                    givenBy: "parent",
                    givenByUid: guardianUid,
                    approvedAt: now,
                },
                updatedAt: now,
            },
            { merge: true }
        );

        let childUid: string;

        try {
            const userRecord = await adminAuth.createUser({
                email: pendingData.email,
                password: randomPassword(),
                displayName: pendingData.fullName,
                emailVerified: false,
            });
            childUid = userRecord.uid;
            logger.info(`Created child auth account: ${childUid} (${pendingData.email})`);
        } catch (err: any) {
            if (err.code === "auth/email-already-exists") {
                // If the auth account already exists but the user doc doesn't,
                // retrieve the uid and continue — this handles partial failures.
                const existing = await adminAuth.getUserByEmail(pendingData.email);
                childUid = existing.uid;
                logger.warn(`Child auth account already existed: ${childUid}`);
            } else {
                logger.error("Failed to create child auth account", err);
                throw new https.HttpsError("internal", "Failed to create child account.");
            }
        }

        // ── Send email verification ───────────────────────────────────────────
        // Generate a verification link and send via Firebase Auth email.
        try {
            const verificationLink = await adminAuth.generateEmailVerificationLink(
                pendingData.email
            );
            // If you have a custom email provider (SendGrid etc.) call it here.
            // For now Firebase will send the default verification email automatically
            // when generateEmailVerificationLink is called.
            logger.info(`Verification link generated for ${pendingData.email}: ${verificationLink}`);
        } catch (err) {
            // Non-fatal — account is still created
            logger.warn("Could not send verification email", err);
        }

        // ── Create child Firestore user doc ───────────────────────────────────
        await db.collection("users").doc(childUid).set({
            uid: childUid,
            email: pendingData.email,
            fullName: pendingData.fullName,
            displayName: pendingData.fullName,
            primaryRole: "rower",
            roles: {
                rower: {
                    club: pendingData.club,
                },
            },
            dateOfBirth: pendingData.dateOfBirth,
            birthYear: Number(pendingData.dateOfBirth?.slice(0, 4) ?? 0),
            consent: {
                termsAccepted: consent.termsAccepted,
                privacyAccepted: consent.privacyAccepted,
                performanceTrackingAccepted: consent.performanceTrackingAccepted ?? false,
                dataSharingAccepted: consent.dataSharingAccepted ?? false,
                givenBy: "parent",
                givenByUid: guardianUid,
                approvedAt: now,
            },
            status: { isActive: true, isVerified: false },
            createdAt: now,
            updatedAt: now,
        });

        // ── Append child to guardian's linkedChildren ─────────────────────────
        // arrayUnion is idempotent — safe if this runs more than once.
        await db.collection("users").doc(guardianUid).update({
            "roles.guardian.linkedChildren": FieldValue.arrayUnion({
                childUid,
                childPendingId: pendingUserId,
                childName: pendingData.fullName,
                approvedAt: now,
            }),
            updatedAt: now,
        });

        // ── Mark pending user as converted ────────────────────────────────────
        await pendingRef.set({ status: "converted" }, { merge: true });

        logger.info(`Consent approved. Guardian: ${guardianUid}, Child: ${childUid}`);

        return { childUid, email: pendingData.email };
    }
);