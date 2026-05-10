import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { https, logger } from "firebase-functions/v2";
import { activateAccountTemplate } from "./emailTemplates";
import {APP_URL} from "./index";
import {buildEmail, getEmailClient} from "./emailService";

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
        let accountWasNew = true;

        try {
            const userRecord = await adminAuth.createUser({
                email: pendingData.email,
                password: crypto.randomBytes(32).toString("hex"), // never persisted
                displayName: pendingData.fullName,
                emailVerified: false,
            });
            childUid = userRecord.uid;
            logger.info(`Created child auth account: ${childUid} (${pendingData.email})`);
        } catch (err: any) {
            if (err.code === "auth/email-already-exists") {
                // Partial failure recovery — auth account exists but doc may not.
                const existing = await adminAuth.getUserByEmail(pendingData.email);
                childUid = existing.uid;
                accountWasNew = false;
                logger.warn(`Child auth account already existed: ${childUid}`);
            } else {
                logger.error("Failed to create child auth account", err);
                throw new https.HttpsError("internal", "Failed to create child account.");
            }
        }

        // ── Send activation email (password reset link repurposed) ────────────
        // generatePasswordResetLink creates a one-time link that lets the child
        // set their own password. We brand it as "Activate your account".
        // The random password above is immediately made irrelevant once they do this.
        try {
            const rawResetLink = await adminAuth.generatePasswordResetLink(
                pendingData.email,
                { url: `${APP_URL}/auth` } // redirect destination after password is set
            );

            // Extract oobCode and build the branded URL, consistent with
            // how sendPasswordResetEmail already works in your codebase.
            const oobCode = new URL(rawResetLink).searchParams.get("oobCode");
            const activationLink = `${APP_URL}/reset-password?oobCode=${oobCode}`;

            const client = getEmailClient();
            await client.transactionalEmails.sendTransacEmail(
                buildEmail(
                    pendingData.email,
                    "Activate your Z12 Challenge account",
                    activateAccountTemplate(pendingData.fullName, activationLink)
                )
            );

            logger.info(`Activation email sent to ${pendingData.email}`);
        } catch (err) {
            // Non-fatal — account exists, child can use "forgot password" as fallback.
            // Log clearly so it can be caught in monitoring.
            logger.error(`Failed to send activation email to ${pendingData.email}`, err);
        }

        // ── Create child Firestore user doc ───────────────────────────────────
        // Use set with merge:false only if the account was freshly created,
        // to avoid overwriting a doc that already exists from a partial run.
        const childDocRef = db.collection("users").doc(childUid);
        const childDocSnap = await childDocRef.get();

        if (!childDocSnap.exists) {
            await childDocRef.set({
                uid: childUid,
                email: pendingData.email,
                fullName: pendingData.fullName,
                displayName: pendingData.fullName,
                gender: pendingData.gender ?? "unknown",
                primaryRole: "rower",
                roles: {
                    rower: {
                        club: pendingData.club ?? "",
                    },
                },
                dateOfBirth: pendingData.dateOfBirth,
                birthYear: Number(pendingData.dateOfBirth?.slice(0, 4) ?? 0),
                isMinor: true,
                permissions: {
                    shareWithCoaches: false,
                    shareWithUniversities: false,
                    shareWithFederations: false,
                },
                consent: {
                    termsAccepted: consent.termsAccepted,
                    privacyAccepted: consent.privacyAccepted,
                    performanceTrackingAccepted: consent.performanceTrackingAccepted ?? false,
                    dataSharingAccepted: consent.dataSharingAccepted ?? false,
                    givenBy: "parent",
                    givenByUid: guardianUid,
                    approvedAt: now,
                    updatedAt: now,
                },
                status: {
                    isActive: true,
                    isVerified: false,
                    requiresParentalConsent: false, // consent is now satisfied
                },
                createdAt: now,
                updatedAt: now,
            });
        } else {
            logger.warn(`Child user doc already existed for ${childUid} — skipping write.`);
        }

        // ── Append child to guardian's linkedChildren ─────────────────────────
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