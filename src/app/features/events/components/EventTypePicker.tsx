import type { EventType } from "../types";
import ergIconUrl from "../../../../assets/workout.png";

type Props = {
    value: EventType | "";
    onChange: (next: EventType) => void;
};

/**
 * Indoor (erg) events are built but not open to hosts yet — the Concept2
 * validation side is not live. Flip this to true to turn them back on; nothing
 * else needs changing. Callers use `isEventTypeAvailable` rather than testing
 * the flag directly.
 */
export const ERG_EVENTS_ENABLED = false;

export function isEventTypeAvailable(type: EventType): boolean {
    return type === "erg" ? ERG_EVENTS_ENABLED : true;
}

/* ── Icons ────────────────────────────────────────────────────────────────────
   Thin line marks rather than emoji: they inherit currentColor, so they take
   the brand tint on selection and stay muted otherwise. */

function WaterIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 8.5c2.2 0 2.2 1.6 4.4 1.6S8.6 8.5 10.8 8.5s2.2 1.6 4.4 1.6S17.4 8.5 19.6 8.5" />
            <path d="M2 13.2c2.2 0 2.2 1.6 4.4 1.6s2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6" />
            <path d="M2 17.9c2.2 0 2.2 1.6 4.4 1.6s2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6" />
        </svg>
    );
}

/**
 * The erg mark is artwork (a solid silhouette), not a line icon. Painting it as
 * a CSS mask over `currentColor` rather than dropping in an <img> means it tints
 * with the card the same way the SVG marks do — the raw PNG is black, which
 * would be invisible on this theme.
 */
export function ErgIcon({ size = 26 }: { size?: number }) {
    return (
        <span
            aria-hidden="true"
            style={{
                display: "inline-block",
                width: size,
                height: size,
                backgroundColor: "currentColor",
                WebkitMaskImage: `url(${ergIconUrl})`,
                maskImage: `url(${ergIconUrl})`,
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
            }}
        />
    );
}

function CheckIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

type TypeCard = {
    type: EventType;
    icon: () => React.ReactElement;
    title: string;
    blurb: string;
    /** Same keys in the same order on both cards, so the two read as a comparison. */
    specs: Array<[string, string]>;
};

const CARDS: TypeCard[] = [
    {
        type: "open_water",
        icon: () => <WaterIcon />,
        title: "Water Event",
        blurb: "Crews race a set course on the water.",
        specs: [
            ["Entries",  "Crews of one to four"],
            ["Distance", "You set the course"],
            ["Results",  "You record times on the day"],
        ],
    },
    {
        type: "erg",
        icon: () => <ErgIcon />,
        title: "Indoor Event",
        blurb: "Athletes row a fixed piece on their own machine, anywhere.",
        specs: [
            ["Entries",  "Individual athletes"],
            ["Distance", "2000m, fixed"],
            ["Results",  "Validated automatically via Concept2"],
        ],
    },
];

/**
 * The first decision on the create page. Nothing else renders until it is made,
 * because the two kinds of event diverge on distance, categories, fees and how
 * results arrive — defaulting into one would be a trap.
 *
 * Both cards carry the same three spec rows in the same order so the difference
 * can be read across, not hunted for.
 */
export function EventTypeChooser({ value, onChange }: Props) {
    return (
        <div className="card">
            <h3 style={{ margin: 0 }}>Event type</h3>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
                Choose how this event is run. This cannot be changed once the event is created.
            </p>

            <div
                role="radiogroup"
                aria-label="Event type"
                style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 12,
                }}
            >
                {CARDS.map((card) => {
                    const available = isEventTypeAvailable(card.type);
                    const selected = available && value === card.type;
                    const Icon = card.icon;

                    return (
                        <button
                            key={card.type}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-disabled={!available}
                            disabled={!available}
                            onClick={() => available && onChange(card.type)}
                            className="group"
                            style={{
                                position: "relative",
                                textAlign: "left",
                                padding: "20px 18px 18px",
                                borderRadius: "var(--radius-sm)",
                                cursor: available ? "pointer" : "not-allowed",
                                background: selected ? "rgba(255,212,0,0.05)" : "var(--surface-2)",
                                border: "1px solid",
                                borderColor: selected ? "var(--brand)" : "var(--border)",
                                color: "var(--text)",
                                opacity: available ? 1 : 0.55,
                                transition: "border-color 140ms ease, background 140ms ease",
                            }}
                        >
                            {/* Selection indicator — a radio dot, not a badge. An
                                unavailable type gets the "Coming soon" pill in its
                                place: there is nothing to select. */}
                            {available ? (
                                <span
                                    aria-hidden="true"
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        right: 16,
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "1px solid",
                                        borderColor: selected ? "var(--brand)" : "rgba(255,255,255,0.22)",
                                        background: selected ? "var(--brand)" : "transparent",
                                        color: "var(--brand-ink)",
                                        transition: "all 140ms ease",
                                    }}
                                >
                                    {selected && <CheckIcon />}
                                </span>
                            ) : (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 14,
                                        right: 14,
                                        padding: "3px 9px",
                                        borderRadius: 999,
                                        fontFamily: "var(--font-display)",
                                        fontSize: 10,
                                        letterSpacing: "0.1em",
                                        textTransform: "uppercase",
                                        color: "var(--brand)",
                                        background: "rgba(255,212,0,0.10)",
                                        border: "1px solid rgba(255,212,0,0.35)",
                                    }}
                                >
                                    Coming soon
                                </span>
                            )}

                            <span
                                style={{
                                    display: "block",
                                    color: selected ? "var(--brand)" : "var(--muted)",
                                    transition: "color 140ms ease",
                                }}
                            >
                                <Icon />
                            </span>

                            <div
                                style={{
                                    marginTop: 12,
                                    fontFamily: "var(--font-heading)",
                                    fontSize: 22,
                                    lineHeight: 1.1,
                                    letterSpacing: "0.02em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {card.title}
                            </div>

                            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.45 }}>
                                {card.blurb}
                            </p>

                            {!available && (
                                <p
                                    style={{
                                        fontSize: 12.5,
                                        margin: "10px 0 0",
                                        lineHeight: 1.45,
                                        color: "var(--brand)",
                                    }}
                                >
                                    Not available yet — indoor events can&rsquo;t be created for now.
                                    We&rsquo;ll let hosts know as soon as they open.
                                </p>
                            )}

                            <dl
                                style={{
                                    margin: "16px 0 0",
                                    paddingTop: 14,
                                    borderTop: "1px solid var(--border)",
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr",
                                    columnGap: 14,
                                    rowGap: 8,
                                    fontSize: 12.5,
                                }}
                            >
                                {card.specs.map(([label, detail]) => (
                                    <div key={label} style={{ display: "contents" }}>
                                        <dt
                                            className="muted"
                                            style={{
                                                fontSize: 10.5,
                                                letterSpacing: "0.09em",
                                                textTransform: "uppercase",
                                                paddingTop: 1,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {label}
                                        </dt>
                                        <dd style={{ margin: 0, lineHeight: 1.4 }}>{detail}</dd>
                                    </div>
                                ))}
                            </dl>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Stays pinned above the form once a type is chosen, so a host filling in dates
 * and fees three screens down never loses track of what they are building.
 */
export function EventTypeBanner({
    eventType,
    onChangeRequest,
}: {
    eventType: EventType;
    onChangeRequest: () => void;
}) {
    const erg = eventType === "erg";

    // Only offer "Change" when there is something to change to — with indoor
    // events off, a water event has no alternative.
    const canSwitch = isEventTypeAvailable(erg ? "open_water" : "erg");

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "10px 14px",
                marginBottom: 14,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "2px solid var(--brand)",
            }}
        >
            <span style={{ color: "var(--brand)", display: "inline-flex" }}>
                {erg ? <ErgIcon size={24} /> : <WaterIcon />}
            </span>

            <span
                style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 17,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                }}
            >
                {erg ? "Indoor Event" : "Water Event"}
            </span>

            <span className="muted" style={{ fontSize: 12.5 }}>
                {erg
                    ? "2000m · scores validated via Concept2 Logbook"
                    : "Course race · times recorded by the host"}
            </span>

            {canSwitch && (
                <button
                    type="button"
                    className="btn-ghost"
                    onClick={onChangeRequest}
                    style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}
                >
                    Change
                </button>
            )}
        </div>
    );
}
