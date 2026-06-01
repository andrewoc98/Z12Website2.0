import { useEffect, useState, useCallback } from "react";
import { getAllFederations, getPendingFederationInvites } from "../services/federationService";
import type { Federation } from "../../auth/club";
import type { FederationInvite } from "../types/admin.types";

type State = {
    federations: Federation[];
    invites:     FederationInvite[];
    loading:     boolean;
    error:       string | null;
};

export function usePlatformAdminData() {
    const [state, setState] = useState<State>({
        federations: [],
        invites:     [],
        loading:     true,
        error:       null,
    });
    const [tick, setTick] = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));

        async function load() {
            try {
                const [federations, invites] = await Promise.all([
                    getAllFederations(),
                    getPendingFederationInvites(),
                ]);
                if (!cancelled) setState({ federations, invites, loading: false, error: null });
            } catch (err) {
                console.error("[usePlatformAdminData]", err);
                if (!cancelled) setState(s => ({ ...s, loading: false, error: "Failed to load platform data." }));
            }
        }

        load();
        return () => { cancelled = true; };
    }, [tick]);

    return { ...state, reload };
}
