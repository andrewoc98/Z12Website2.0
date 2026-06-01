import { useEffect, useState, useCallback } from "react";
import { getFederation } from "../services/federationService";
import {
    getClubsForFederation,
    getClubCreationRequestsForFederation,
} from "../services/clubAdminService";
import type { Federation, Club } from "../../auth/club";
import type { ClubCreationRequest } from "../types/admin.types";

type State = {
    federation:      Federation | null;
    clubs:           Club[];
    pendingRequests: ClubCreationRequest[];
    loading:         boolean;
    error:           string | null;
};

export function useFederationAdminData(federationId: string | null) {
    const [state, setState] = useState<State>({
        federation:      null,
        clubs:           [],
        pendingRequests: [],
        loading:         true,
        error:           null,
    });
    const [tick, setTick] = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!federationId) {
            setState({ federation: null, clubs: [], pendingRequests: [], loading: false, error: null });
            return;
        }

        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));

        async function load() {
            try {
                const [federation, clubs, pendingRequests] = await Promise.all([
                    getFederation(federationId!),
                    getClubsForFederation(federationId!),
                    getClubCreationRequestsForFederation(federationId!, "pending"),
                ]);
                if (!cancelled) setState({ federation, clubs, pendingRequests, loading: false, error: null });
            } catch (err) {
                console.error("[useFederationAdminData]", err);
                if (!cancelled) setState(s => ({ ...s, loading: false, error: "Failed to load federation data." }));
            }
        }

        load();
        return () => { cancelled = true; };
    }, [federationId, tick]);

    return { ...state, reload };
}
