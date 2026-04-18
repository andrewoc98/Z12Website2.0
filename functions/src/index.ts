import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { BrevoClient, BrevoEnvironment } from "@getbrevo/brevo";
import { parentConsentTemplate } from './emailTemplates';
import { verifyEmailTemplate } from './emailTemplates';
import { resetPasswordTemplate } from './emailTemplates';

admin.initializeApp();

const APP_URL = process.env.FUNCTIONS_EMULATOR === "true"
    ? "http://localhost:5173"
    : "https://www.z12challenge.com";

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

export const checkEmailExists = onCall(async (request) => {
    console.log("RAW request.data:", JSON.stringify(request.data));
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

export const sendParentConsentEmail = onCall(async (request) => {
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

export const sendVerificationEmail = onCall(async (request) => {
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

export const sendPasswordResetEmail = onCall(async (request) => {
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