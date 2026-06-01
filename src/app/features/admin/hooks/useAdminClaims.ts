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
            // Federation/platform admins who created a club keep their higher-privilege
            // JWT claim, so clubId is never written to the token. Fall back to the
            // Firestore profile's roles.clubAdmin.clubId in that case.
            const jwtClubId = (claims["clubId"] as string) ?? null;
            const profileClubId = (profile as UserProfile | null)?.roles?.clubAdmin?.clubId ?? null;
            setState({
                adminRole:    (claims["role"]         as AdminRole) ?? null,
                federationId: (claims["federationId"] as string)   ?? null,
                clubId:       jwtClubId ?? profileClubId,
                loading:      false,
            });
        }).catch(() => {
            setState({ adminRole: null, federationId: null, clubId: null, loading: false });
        });
    }, [user, profile, authLoading]);

    return state;
}
