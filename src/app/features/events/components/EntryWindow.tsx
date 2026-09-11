import { useCountdown } from "../hooks/useCountdown";

function ClockIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}

/** Inline "· 3d 4h remaining" for open-water events, red inside the last day. */
export function ClosingCountdown({ closingDate }: { closingDate: string }) {
    const countdown = useCountdown(closingDate);
    if (!countdown) return null;

    return (
        <span
            style={{
                fontSize: "11px",
                color: countdown.isUrgent ? "#ff6b6b" : "rgba(254,185,89,0.9)",
                fontWeight: countdown.isUrgent ? 700 : 500,
            }}
        >
            · {countdown.label}
        </span>
    );
}

/**
 * Erg events have no registration deadline, so there is nothing to count down
 * for most of their life — showing a timer the whole time would be noise.
 * This stays invisible until the last 24 hours, then flags hard: that really is
 * the deadline, because it is the last chance to post a score.
 *
 * Renders nothing outside that window, or once the event has ended.
 */
export function ErgFinalDayFlag({
    endDate,
    variant = "inline",
}: {
    endDate: string | undefined;
    variant?: "inline" | "banner";
}) {
    const countdown = useCountdown(endDate);
    if (!countdown || !countdown.isUrgent) return null;

    if (variant === "inline") {
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "#ff6b6b",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                }}
            >
                <ClockIcon size={12} />
                Final day · {countdown.label}
            </span>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "10px 14px",
                marginBottom: 14,
                borderRadius: "var(--radius-sm)",
                background: "rgba(255,107,107,0.08)",
                border: "1px solid #ff6b6b",
            }}
        >
            <span style={{ color: "#ff6b6b", display: "inline-flex" }}>
                <ClockIcon size={16} />
            </span>
            <span
                style={{
                    color: "#ff6b6b",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                }}
            >
                Final day — {countdown.label}
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
                Last chance to enter and post a score. Scores must be rowed before the event ends.
            </span>
        </div>
    );
}
