import { useEffect, useState, useCallback } from "react";
import { getMyClubCreationRequests } from "../services/clubAdminService";
import type { ClubCreationRequest } from "../types/admin.types";

type State = {
    requests: ClubCreationRequest[];
    loading:  boolean;
    error:    string | null;
};

export function useClubCreationRequest(uid: string | null) {
    const [state, setState] = useState<State>({ requests: [], loading: true, error: null });
    const [tick, setTick]   = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!uid) {
            setState({ requests: [], loading: false, error: null });
            return;
        }

        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));

        async function load() {
            try {
                const requests = await getMyClubCreationRequests(uid!);
                if (!cancelled) setState({ requests, loading: false, error: null });
            } catch (err) {
                console.error("[useClubCreationRequest]", err);
                if (!cancelled) setState({ requests: [], loading: false, error: "Failed to load requests." });
            }
        }

        load();
        return () => { cancelled = true; };
    }, [uid, tick]);

    return { ...state, reload };
}
