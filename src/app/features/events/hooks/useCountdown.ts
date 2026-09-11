import { useEffect, useMemo, useState } from "react";

const DAY_MS = 24 * 60 * 60_000;

/** Ticks once a minute — a countdown measured in minutes needs nothing finer. */
export function useCountdown(target: string | number | undefined | null) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    return useMemo(() => {
        if (target == null) return null;
        const targetMs = typeof target === "number" ? target : new Date(target).getTime();
        if (Number.isNaN(targetMs)) return null;

        const diff = targetMs - now;
        if (diff <= 0) return null;

        const totalMins = Math.floor(diff / 60_000);
        const days = Math.floor(totalMins / (60 * 24));
        const hours = Math.floor((totalMins % (60 * 24)) / 60);
        const mins = totalMins % 60;

        const label = days > 0
            ? `${days}d ${hours}h remaining`
            : hours > 0
                ? `${hours}h ${mins}m remaining`
                : `${mins}m remaining`;

        return { diff, label, isUrgent: diff < DAY_MS, days, hours, mins };
    }, [target, now]);
}
