import { useEffect, useState, useCallback } from "react";
import { getClub } from "../services/clubAdminService";
import type { Club } from "../../auth/club";

type State = {
    club:    Club | null;
    loading: boolean;
    error:   string | null;
};

export function useClubAdminData(clubId: string | null) {
    const [state, setState] = useState<State>({ club: null, loading: true, error: null });
    const [tick, setTick]   = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!clubId) {
            setState({ club: null, loading: false, error: null });
            return;
        }

        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));

        async function load() {
            try {
                const club = await getClub(clubId!);
                if (!cancelled) setState({ club, loading: false, error: null });
            } catch (err) {
                console.error("[useClubAdminData]", err);
                if (!cancelled) setState({ club: null, loading: false, error: "Failed to load club data." });
            }
        }

        load();
        return () => { cancelled = true; };
    }, [clubId, tick]);

    return { ...state, reload };
}
