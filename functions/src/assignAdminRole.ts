import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Initialize admin if not already done elsewhere
if (admin.apps.length === 0) {
    admin.initializeApp();
}

export const assignAdminRole = onCall(async (request) => {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in to accept an invite.");
    }

    const { inviteId } = request.data;
    if (!inviteId || typeof inviteId !== "string") {
        throw new HttpsError("invalid-argument", "A valid invite ID is required.");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;
    const userEmail = request.auth.token.email;

    try {
        await db.runTransaction(async (transaction) => {
            const inviteRef = db.collection("adminInvites").doc(inviteId);
            const userRef = db.collection("users").doc(uid);

            const inviteSnap = await transaction.get(inviteRef);
            console.log(inviteSnap.exists)
            if (!inviteSnap.exists) { // Changed from !inviteSnap to !inviteSnap.exists
                throw new HttpsError("not-found", "Invite does not exist.");
            }

            const inviteData = inviteSnap.data();

            if (inviteData?.used === true) {
                throw new HttpsError("failed-precondition", "This invite has already been used.");
            }

            // 2. Use the imported Timestamp class directly
            const nowMillis = Timestamp.now().toMillis();
            if (inviteData?.expiresAt && inviteData.expiresAt.toMillis() < nowMillis) {
                throw new HttpsError("failed-precondition", "This invite has expired.");
            }

            if (inviteData?.email !== userEmail) {
                throw new HttpsError(
                    "permission-denied",
                    "The authenticated email does not match the invite email."
                );
            }

            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data() || {};

            const currentHostIds = userData.roles?.admin?.hostIds || [];
            const hostIdToGrant = inviteData?.hostId;
            const updatedHostIds = Array.from(new Set([...currentHostIds, hostIdToGrant]));

            transaction.set(userRef, {
                roles: {
                    ...userData.roles,
                    admin: {
                        ...(userData.roles?.admin || {}),
                        hostIds: updatedHostIds
                    }
                },
                // 3. Use the imported FieldValue class directly
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            transaction.update(inviteRef, {
                used: true,
                usedAt: FieldValue.serverTimestamp(),
                usedByUid: uid
            });
        });

        return { success: true, message: "Admin role assigned securely." };

    } catch (error: any) {
        if (error instanceof HttpsError) {
            throw error;
        }
        console.error("Error assigning admin role:", error);
        throw new HttpsError("internal", "An internal error occurred while processing the invite.");
    }
});