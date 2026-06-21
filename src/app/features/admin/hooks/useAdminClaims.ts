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
            const claims      = result.claims as Record<string, unknown>;
            const jwtRole     = (claims["role"] as AdminRole) ?? null;
            const jwtClubId   = (claims["clubId"]        as string) ?? null;
            const jwtFedId    = (claims["federationId"]  as string) ?? null;
            const p           = profile as UserProfile | null;

            // If the JWT already carries a role, resolve immediately.
            if (jwtRole) {
                setState({
                    adminRole:    jwtRole,
                    federationId: jwtFedId  ?? p?.roles?.federationAdmin?.federationId ?? null,
                    clubId:       jwtClubId ?? p?.roles?.clubAdmin?.clubId              ?? null,
                    loading:      false,
                });
                return;
            }

            // No JWT role. If the Firestore profile hasn't arrived yet, stay in
            // loading state — the effect will re-run when profile populates.
            if (!p) return;

            // Profile is loaded. Derive the admin role from Firestore roles (highest-privilege wins).
            const profileAdminRole: AdminRole | null =
                p.roles?.platformAdmin   ? "platformAdmin"   :
                p.roles?.federationAdmin ? "federationAdmin" :
                p.roles?.clubAdmin       ? "clubAdmin"       :
                null;

            setState({
                adminRole:    profileAdminRole,
                federationId: jwtFedId  ?? p.roles?.federationAdmin?.federationId ?? null,
                clubId:       jwtClubId ?? p.roles?.clubAdmin?.clubId              ?? null,
                loading:      false,
            });
        }).catch(() => {
            setState({ adminRole: null, federationId: null, clubId: null, loading: false });
        });
    }, [user, profile, authLoading]);

    return state;
}
