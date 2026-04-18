import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Resend } from 'resend';
import {parentConsentTemplate, verifyEmailTemplate} from './emailTemplates';


admin.initializeApp();

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


export const sendParentConsentEmail = onCall(
    async (request) => {   // removed { secrets: ["RESEND_API_KEY"] }
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { parentEmail, consentLink, childName } = request.data ?? {};

        if (!parentEmail || !consentLink || !childName) {
            throw new HttpsError("invalid-argument", "Missing parentEmail, consentLink, or childName.");
        }

        try {
            await resend.emails.send({
                from: 'Z12 Challenge <noreply@z12challenge.com>',
                to: parentEmail,
                subject: 'Parental Consent Required – Z12 Challenge',
                html: parentConsentTemplate(childName, consentLink),
            });
        } catch (err) {
            console.error('Resend error:', err);
            throw new HttpsError("internal", "Failed to send parent consent email.");
        }
    }
);

export const sendVerificationEmail = onCall(async (request) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = request.data ?? {};

    if (!email) {
        throw new HttpsError("invalid-argument", "Missing email.");
    }

    try {
        const verificationLink = await admin.auth().generateEmailVerificationLink(email);

        await resend.emails.send({
            from: 'Z12 Challenge <noreply@z12challenge.com>',
            to: email,
            subject: 'Verify your Z12 Challenge account',
            html: verifyEmailTemplate(verificationLink),
        });
    } catch (err) {
        console.error('Resend error:', err);
        throw new HttpsError("internal", "Failed to send verification email.");
    }
});

import { resetPasswordTemplate } from './emailTemplates';

export const sendPasswordResetEmail = onCall(async (request) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = request.data ?? {};

    if (!email) {
        throw new HttpsError("invalid-argument", "Missing email.");
    }

    try {
        const firebaseResetLink = await admin.auth().generatePasswordResetLink(email);
        const oobCode = new URL(firebaseResetLink).searchParams.get("oobCode");
        const resetLink = `${process.env.APP_URL}/reset-password?oobCode=${oobCode}`;

        await resend.emails.send({
            from: 'Z12 Challenge <noreply@z12challenge.com>',
            to: email,
            subject: 'Reset your Z12 Challenge password',
            html: resetPasswordTemplate(resetLink),
        });
    } catch (err: any) {
        if (err?.code === "auth/user-not-found") return;
        console.error('Resend error:', err);
        throw new HttpsError("internal", "Failed to send password reset email.");
    }
});