import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BrevoClient, BrevoEnvironment } from "@getbrevo/brevo";
import { parentConsentTemplate } from './emailTemplates';
import { verifyEmailTemplate } from './emailTemplates';
import { resetPasswordTemplate } from './emailTemplates';
import {onDocumentWritten} from "firebase-functions/firestore";

admin.initializeApp();
const db = admin.firestore();

const APP_URL = process.env.FUNCTIONS_EMULATOR === "true"
    ? "http://localhost:5173"
    : "https://www.z12challenge.com";

const callableOptions = {
    cors: ["https://www.z12challenge.com", "http://localhost:5173"],
};

function getEmailClient() {
    return new BrevoClient({
        apiKey: process.env.BREVO_API_KEY ?? "",
        environment: BrevoEnvironment.Default,
    });
}

function buildEmail(to: string, subject: string, html: string) {
    return {
        sender: { name: "Z12 Challenge", email: "noreply@z12challenge.com" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
    };
}

export const checkEmailExists = onCall(callableOptions, async (request) => {
    const email = ((request.data?.email) ?? "").trim().toLowerCase();

    if (!email) {
        throw new HttpsError("invalid-argument", "Email required.");
    }

    try {
        await admin.auth().getUserByEmail(email);
        return { exists: true };
    } catch (e: any) {
        if (e.code === "auth/user-not-found") return { exists: false };
        throw new HttpsError("internal", "Could not check email.");
    }
});

export const sendParentConsentEmail = onCall(callableOptions, async (request) => {
    const { parentEmail, consentLink, childName } = request.data ?? {};

    if (!parentEmail || !consentLink || !childName) {
        throw new HttpsError("invalid-argument", "Missing parentEmail, consentLink, or childName.");
    }

    try {
        const client = getEmailClient();
        await client.transactionalEmails.sendTransacEmail(
            buildEmail(
                parentEmail,
                "Parental Consent Required – Z12 Challenge",
                parentConsentTemplate(childName, consentLink)
            )
        );
    } catch (err) {
        console.error('Brevo error:', err);
        throw new HttpsError("internal", "Failed to send parent consent email.");
    }
});

export const sendVerificationEmail = onCall(callableOptions, async (request) => {
    const { email } = request.data ?? {};

    if (!email) {
        throw new HttpsError("invalid-argument", "Missing email.");
    }

    try {
        const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
            url: `${APP_URL}/auth`,
        });

        const client = getEmailClient();
        await client.transactionalEmails.sendTransacEmail(
            buildEmail(
                email,
                "Verify your Z12 Challenge account",
                verifyEmailTemplate(verificationLink)
            )
        );
    } catch (err) {
        console.error('Brevo error:', err);
        throw new HttpsError("internal", "Failed to send verification email.");
    }
});

export const sendPasswordResetEmail = onCall(callableOptions, async (request) => {
    const { email } = request.data ?? {};

    if (!email) {
        throw new HttpsError("invalid-argument", "Missing email.");
    }

    try {
        const firebaseResetLink = await admin.auth().generatePasswordResetLink(email);
        const oobCode = new URL(firebaseResetLink).searchParams.get("oobCode");
        const resetLink = `${APP_URL}/reset-password?oobCode=${oobCode}`;

        const client = getEmailClient();
        await client.transactionalEmails.sendTransacEmail(
            buildEmail(
                email,
                "Reset your Z12 Challenge password",
                resetPasswordTemplate(resetLink)
            )
        );
    } catch (err: any) {
        if (err?.code === "auth/user-not-found") return;
        console.error('Brevo error:', err);
        throw new HttpsError("internal", "Failed to send password reset email.");
    }
});

export const computeElapsedMs = onDocumentWritten(
    "events/{eventId}/boats/{boatId}",
    async (event) => {
        const after = event.data?.after?.data();
        if (!after) return; // document was deleted

        const { startedAt, finishedAt, adjustmentMs, elapsedMs: currentElapsedMs } = after;

        // Only proceed if boat is finished
        if (!startedAt || !finishedAt) return;

        const startMs = typeof startedAt === "number"
            ? startedAt
            : startedAt.toMillis?.() ?? null;

        const finishMs = typeof finishedAt === "number"
            ? finishedAt
            : finishedAt.toMillis?.() ?? null;

        if (startMs === null || finishMs === null) return;

        const newElapsedMs = (finishMs - startMs) + ((adjustmentMs ?? 0) * 1000);

        if (currentElapsedMs === newElapsedMs) return;

        await event.data!.after.ref.update({ elapsedMs: newElapsedMs });
    }
);

export const getEventResults = onCall(async (request) => {
    const {
        eventId,
        pageSize = 10,
        lastDocId = null,
        category = null,
    } = request.data;

    if (!eventId) throw new HttpsError("invalid-argument", "eventId is required");

    let q = db
        .collectionGroup("boats")
        .where("eventId", "==", eventId)
        .where("status", "==", "finished")
        .orderBy("elapsedMs")
        .limit(pageSize);

    if (category) {
        q = q.where("categoryName", "==", category);
    }

    if (lastDocId) {
        const lastDoc = await db
            .collectionGroup("boats")
            .where("eventId", "==", eventId)
            .where(/* find by id */ "__name__", "==", db.doc(`events/${eventId}/boats/${lastDocId}`))
            .limit(1)
            .get();

        if (!lastDoc.empty) {
            q = q.startAfter(lastDoc.docs[0]);
        }
    }

    const snap = await q.get();
    const boats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return {
        boats,
        hasMore: snap.docs.length === pageSize,
        lastDocId: snap.docs.at(-1)?.id ?? null,
    };
});