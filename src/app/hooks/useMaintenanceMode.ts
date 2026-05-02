import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../shared/lib/firebase"; // your firestore instance

export function useMaintenanceMode() {
    const envFlag = import.meta.env.VITE_MAINTENANCE_MODE === "true";
    const [maintenance, setMaintenance] = useState(envFlag);

    useEffect(() => {
        if (envFlag) return;
        const unsub = onSnapshot(doc(db, "config", "maintenance"), (snap) => {
            setMaintenance(snap.exists() ? snap.data().enabled === true : false);
        });
        return unsub;
    }, []);

    return maintenance;
}