import { useEffect, useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import type { AdminRole } from "../types/admin.types";
import type { UserProfile } from "../../auth/types";

export type AdminClaims = {
    /** The user's admin role from the `role` custom claim. Null for non-admin users. */
    adminRole:    AdminRole | null;
    federationId: string | null;
    clubId:       string | null;
};

type State = AdminClaims & { loading: boolean };

/**
 * Reads the current user's custom claims, always forcing a token refresh.
 * Forcing a refresh ensures custom claims set after sign-in (e.g. by a seed
 * script or by a role-change Function) are picked up before any admin
 * Firestore/Functions call is made. Without this, the cached token sent to
 * the callable function may pre-date the setCustomUserClaims call, causing
 * a 403 permission-denied error even though the Firestore SDK (which has
 * its own background refresh) already has the updated claims.
 */
export function useAdminClaims(): State {
    const { user, profile, loading: authLoading } = useAuth();
    const [state, setState] = useState<State>({
        adminRole:    null,
        federationId: null,
        clubId:       null,
        loading:      true,
    });

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setState({ adminRole: null, federationId: null, clubId: null, loading: false });
            return;
        }

        user.getIdTokenResult(/* forceRefresh */ true).then(result => {
            const claims = result.claims as Record<string, unknown>;
            // Higher-privilege roles keep their elevated JWT claim, so clubId/federationId
            // may not be written to the token. Fall back to the Firestore profile in that case.
            const jwtClubId        = (claims["clubId"]        as string) ?? null;
            const jwtFederationId  = (claims["federationId"]  as string) ?? null;
            const p                   = profile as UserProfile | null;
            const profileClubId       = p?.roles?.clubAdmin?.clubId              ?? null;
            const profileFederationId = p?.roles?.federationAdmin?.federationId  ?? null;
            // Fall back to Firestore when the JWT role claim is absent (e.g. roles
            // written directly without going through the invite flow).
            const profileAdminRole: AdminRole | null =
                p?.roles?.platformAdmin   ? "platformAdmin"   :
                p?.roles?.federationAdmin ? "federationAdmin" :
                p?.roles?.clubAdmin       ? "clubAdmin"       :
                null;
            setState({
                adminRole:    (claims["role"] as AdminRole) ?? profileAdminRole,
                federationId: jwtFederationId ?? profileFederationId,
                clubId:       jwtClubId       ?? profileClubId,
                loading:      false,
            });
        }).catch(() => {
            setState({ adminRole: null, federationId: null, clubId: null, loading: false });
        });
    }, [user, profile, authLoading]);

    return state;
}
