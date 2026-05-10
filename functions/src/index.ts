import * as admin from "firebase-admin";

admin.initializeApp();

export const APP_URL = process.env.FUNCTIONS_EMULATOR === "true"
    ? "http://localhost:5173"
    : "https://www.z12challenge.com";

export { approveAndCreate } from "./approveAndCreate";
export {assignAdminRole} from "./assignAdminRole"
export {autoAssignBowNumbers, computeElapsedMs} from "./boatService"
export {checkEmailExists, sendParentConsentEmail, sendVerificationEmail, sendPasswordResetEmail, sendAdminInviteEmail} from "./emailService"

