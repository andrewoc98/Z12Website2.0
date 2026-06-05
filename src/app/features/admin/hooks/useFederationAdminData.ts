import { useEffect, useState, useCallback } from "react";
import { getFederation } from "../services/federationService";
import {
    getClubsForFederation,
    getClubCreationRequestsForFederation,
} from "../services/clubAdminService";
import type { Federation, Club } from "../../auth/club";
import type { ClubCreationRequest } from "../types/admin.types";
import { useTourMock } from "../../../providers/TourMockContext";
import {
    TOUR_FEDERATION,
    TOUR_FEDERATION_CLUBS,
    TOUR_FEDERATION_PENDING,
} from "../../home/components/tourMockData";

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
    const { isTourActive } = useTourMock();

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (isTourActive) {
            setState({
                federation:      TOUR_FEDERATION,
                clubs:           TOUR_FEDERATION_CLUBS,
                pendingRequests: TOUR_FEDERATION_PENDING,
                loading:         false,
                error:           null,
            });
            return;
        }

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
    }, [federationId, tick, isTourActive]);

    return { ...state, reload };
}
