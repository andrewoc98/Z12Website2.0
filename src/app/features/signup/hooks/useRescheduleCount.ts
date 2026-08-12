import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";

/**
 * Returns the count of bookings that have an active reschedule refund window
 * (rescheduleRefundDeadline exists and is in the future, booking not yet refunded).
 * Returns 0 when the user is not signed in.
 */
export function useRescheduleCount(uid: string | null): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!uid) { setCount(0); return; }

        const q = query(
            collection(db, "bookings"),
            where("payerUid", "==", uid),
            where("status", "in", ["pending_crew", "confirmed"]),
        );

        const unsub = onSnapshot(q, (snap) => {
            const now = Date.now();
            const active = snap.docs.filter((d) => {
                const deadline = d.data().rescheduleRefundDeadline;
                if (!deadline) return false;
                const ms = typeof deadline.toMillis === "function" ? deadline.toMillis() : 0;
                return ms > now;
            });
            setCount(active.length);
        }, () => setCount(0));

        return unsub;
    }, [uid]);

    return count;
}
