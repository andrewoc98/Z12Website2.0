import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

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