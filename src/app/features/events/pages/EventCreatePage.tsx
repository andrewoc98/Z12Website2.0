import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import { useAdminClaims } from "../../admin/hooks/useAdminClaims";
import { getClub } from "../../admin/services/clubAdminService";
import CategoryPicker from "../components/CategoryPicker";
import { EventTypeChooser, EventTypeBanner } from "../components/EventTypePicker";
import Modal from "../../../shared/components/Modal/Modal";
import { buildDefaultCategories, getCategoryRaceMeters, parseBoatClassFromCategory } from "../lib/categories";
import type { BoatClass } from "../lib/categories";
import { categoriesFromIds, createEvent, dateInputToTimestampStartOfDay,dateInputToTimestampEndOfDay } from "../api/events";
import type { EventStatus, EventSeriesType, EventType } from "../types";
import { DEFAULT_ERG_CONFIG, SERIES_LENGTH_METERS, STRIPE_SUPPORTED_COUNTRIES } from "../types";
import InfoTooltip from "../../../shared/components/Infotooltip/Infotooltip.tsx";
import { Link } from "react-router-dom";
import { createConnectAccount } from "../../admin/services/stripeService";

const DRAFT_KEY = "z12_event_create_draft";

function saveDraft(state: object) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch { /* quota */ }
}
function loadDraft(): Record<string, any> | null {
    try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
}

export default function EventCreatePage() {
    const { user, profile } = useAuth() as any;
    const { clubId } = useAdminClaims();
    const navigate = useNavigate();

    // "" until the host picks a type — the rest of the form stays hidden.
    const [eventType, setEventType] = useState<EventType | "">("");
    const [confirmTypeChange, setConfirmTypeChange] = useState(false);
    const isErg = eventType === "erg";

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    // Water events may run without a registration deadline: entries then stay
    // open until the host closes them from the manage page, and in no case past
    // the end of the event.
    const [noClosingDate, setNoClosingDate] = useState(false);
    const [lengthMeters, setLengthMeters] = useState<number>(3000);
    const [seriesType, setSeriesType] = useState<EventSeriesType | "">("");

    // Open water starts with every category enabled; erg starts empty, because a
    // host runs a handful of erg classes rather than the full 200-odd taxonomy.
    const [categories, setCategories] = useState<string[]>(() => buildDefaultCategories());

    const [allowedSeriesTypes, setAllowedSeriesTypes] = useState<EventSeriesType[]>([]);
    const [clubCountry, setClubCountry] = useState<string | null>(null);

    const stripeOnboarded: boolean = profile?.roles?.clubAdmin?.stripeOnboarded ?? false;
    const stripeSupported: boolean = clubCountry !== null && STRIPE_SUPPORTED_COUNTRIES.has(clubCountry);

    // Per-boat-class fees: globalFeeUsd applies to all; boatFees[boatClass] overrides a specific class
    const [globalFeeUsd, setGlobalFeeUsd] = useState("");
    const [boatFees, setBoatFees] = useState<Partial<Record<BoatClass, string>>>({});

    const BOAT_CLASS_ORDER: BoatClass[] = ["1x", "2x", "2-", "4x+"];

    const skeletonBar = "rounded-full [background:linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-2)_50%,var(--color-surface)_75%)] [background-size:600px_100%] animate-[sk-shimmer_1.4s_infinite_linear]";
    const BOAT_CLASS_LABEL: Record<BoatClass, string> = {
        "1x":  "Single (1x)",
        "2x":  "Double (2x)",
        "2-":  "Pair (2-)",
        "4x+": "Quad (4x+)",
    };

    const selectedBoatClasses = useMemo((): BoatClass[] => {
        const found = new Set<BoatClass>();
        for (const catId of categories) {
            const bc = parseBoatClassFromCategory(catId);
            if (bc) found.add(bc);
        }
        return BOAT_CLASS_ORDER.filter(bc => found.has(bc));
    }, [categories]);

    const overrideCount = Object.values(boatFees).filter(v => v?.trim()).length;
    const anyFeeSet = !!globalFeeUsd.trim() || overrideCount > 0;

    const [autoAssignBowNumbers, setAutoAssignBowNumbers] = useState(false);

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [connectingStripe, setConnectingStripe] = useState(false);

    // Restore any draft saved before a Stripe redirect
    useEffect(() => {
        const draft = loadDraft();
        if (!draft) return;
        clearDraft();
        if (draft.eventType)       setEventType(draft.eventType);
        if (draft.name)            setName(draft.name);
        if (draft.description)     setDescription(draft.description);
        if (draft.location)        setLocation(draft.location);
        if (draft.startDate)       setStartDate(draft.startDate);
        if (draft.endDate)         setEndDate(draft.endDate);
        if (draft.closingDate)     setClosingDate(draft.closingDate);
        if (draft.noClosingDate != null) setNoClosingDate(draft.noClosingDate);
        if (draft.lengthMeters)    setLengthMeters(draft.lengthMeters);
        if (draft.seriesType)      setSeriesType(draft.seriesType);
        if (draft.categories)      setCategories(draft.categories);
        if (draft.globalFeeUsd)    setGlobalFeeUsd(draft.globalFeeUsd);
        if (draft.boatFees)        setBoatFees(draft.boatFees);
        if (draft.autoAssignBowNumbers != null) setAutoAssignBowNumbers(draft.autoAssignBowNumbers);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!clubId) return;
        getClub(clubId).then(club => {
            setAllowedSeriesTypes(club?.allowedSeriesTypes ?? []);
            setClubCountry(club?.location?.country ?? null);
        }).catch(() => {});
    }, [clubId]);

    async function handleConnectStripe() {
        setConnectingStripe(true);
        saveDraft({ eventType, name, description, location, startDate, endDate, closingDate, noClosingDate, lengthMeters, seriesType, categories, globalFeeUsd, boatFees, autoAssignBowNumbers });
        try {
            const { url } = await createConnectAccount({});
            window.location.href = url;
        } catch (e: any) {
            clearDraft();
            setErr(e?.message ?? "Could not start Stripe setup. Please try again.");
            setConnectingStripe(false);
        }
    }

    // Switching type resets the category selection — the two taxonomies are not
    // interchangeable, so carrying "Men • Senior 70kg • 1x" into an erg event
    // would produce categories nobody can enter.
    function applyEventType(next: EventType) {
        setEventType(next);
        setCategories(next === "erg" ? [] : buildDefaultCategories());
        setBoatFees({});
        if (next === "erg") {
            setSeriesType("");
            setAutoAssignBowNumbers(false);
            setNoClosingDate(false);
            setLengthMeters(DEFAULT_ERG_CONFIG.distanceMeters);
        } else {
            setLengthMeters(3000);
        }
    }

    const needsStripeSetup = anyFeeSet && stripeSupported && !stripeOnboarded;

    const canSubmit = useMemo(() => {
        return (
            !!user &&
            eventType !== "" &&
            name.trim().length > 1 &&
            location.trim().length > 1 &&
            startDate &&
            endDate &&
            (isErg || noClosingDate || closingDate) &&
            lengthMeters > 0 &&
            categories.length > 0 &&
            !needsStripeSetup
        );
    }, [user, eventType, isErg, name, location, startDate, endDate, closingDate, noClosingDate, lengthMeters, categories, needsStripeSetup]);

    function calculateInitialStatus(
        startAtMillis: number,
        endAtMillis: number,
        closeAtMillis: number
    ): EventStatus {

        const now = Date.now();

        // If start and end same day → running immediately
        if (startAtMillis === endAtMillis) {
            return "running";
        }

        if (now >= startAtMillis && now <= endAtMillis) {
            return "running";
        }

        if (now > endAtMillis) {
            return "finished";
        }

        if (now > closeAtMillis) {
            return "closed";
        }

        return "open";
    }

    async function onCreate() {
        if (!user || !canSubmit) return;

        setBusy(true);
        setErr(null);

        try {
            const startAt = dateInputToTimestampStartOfDay(startDate);
            const endAt = dateInputToTimestampEndOfDay(endDate);
            // Erg events have no separate registration deadline — an athlete can
            // enter right up until the event ends, because entering and posting a
            // score are the same window. Storing closeAt = endAt keeps every
            // downstream consumer (status, reminders, refunds) working unchanged.
            // A water event with no closing date stores closeAt = endAt for the
            // same reason erg does: every downstream consumer (status, bow
            // assignment, reminders, refunds) is date-driven and keeps working.
            const closeAt = isErg || noClosingDate
                ? endAt
                : dateInputToTimestampEndOfDay(closingDate);

            const startMillis = startAt.toMillis();
            const endMillis = endAt.toMillis();
            const closeMillis = closeAt.toMillis();

            if (endMillis < startMillis) {
                throw new Error("End date must be on or after start date.");
            }

            if (!isErg && !noClosingDate && closeMillis > startMillis) {
                throw new Error("Registration closing date must be before the start date.");
            }

            const status = calculateInitialStatus(
                startMillis,
                endMillis,
                closeMillis
            );

            // Erg events are always their configured distance; the series
            // distance rules are an open-water concept.
            const resolvedLength = isErg
                ? DEFAULT_ERG_CONFIG.distanceMeters
                : seriesType
                    ? SERIES_LENGTH_METERS[seriesType]
                    : Number(lengthMeters);

            const globalFeeCents = globalFeeUsd.trim()
                ? Math.round(parseFloat(globalFeeUsd) * 100)
                : 0;

            const builtCategories = categoriesFromIds(categories).map(c => {
                // Erg: no per-category distance and no boat classes to price
                // separately, so every category takes the single event fee.
                if (isErg) {
                    if (clubCountry !== "US") return c;
                    return globalFeeCents > 0 ? { ...c, feeCents: globalFeeCents } : c;
                }

                const catLength = getCategoryRaceMeters(c.id, seriesType, resolvedLength);
                const withLength = catLength !== resolvedLength ? { ...c, lengthMeters: catLength } : c;

                if (clubCountry !== "US") return withLength; // entry fees only permitted for US clubs
                const bc = parseBoatClassFromCategory(c.id);
                const overrideStr = bc ? boatFees[bc] : undefined;
                const feeCents = overrideStr?.trim()
                    ? Math.round(parseFloat(overrideStr) * 100)
                    : globalFeeCents;
                return feeCents > 0 ? { ...withLength, feeCents } : withLength;
            });

            const eventId = await createEvent({
                bowsAssigned: false,
                autoAssignBowNumbers: isErg ? false : autoAssignBowNumbers,
                eventType: eventType as EventType,
                // Only the no-deadline case starts the manual switch explicitly
                // open. An event with a real closing date leaves it unset, so
                // that date governs until the host flips the switch themselves.
                ...(!isErg && noClosingDate ? { noClosingDate: true, registrationOpen: true } : {}),
                ...(isErg ? { ergConfig: DEFAULT_ERG_CONFIG } : {}),
                // EventPage reads these capitalised values; see updateEventPublishMode.
                resultsPublishMode: "Live",
                name: name.trim(),
                description: description.trim(),
                location: location.trim(),
                startAt,
                endAt,
                closeAt,
                lengthMeters: resolvedLength,
                categories: builtCategories,
                status,
                clubId: clubId ?? "",
                ...(seriesType && !isErg ? { seriesType } : {}),
                createdByUid: user.uid,
                createdByName:
                    profile?.displayName ||
                    user.displayName ||
                    user.email ||
                    "Club Admin",
            });

            clearDraft();
            navigate(`/host/events/${eventId}`);

        } catch (e: any) {
            setErr(e?.message ?? "Failed to create event");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <h1>Create Event</h1>

                {/* Step one: what kind of event. Nothing else renders until this
                    is answered — open water and erg diverge too much to default. */}
                {!eventType && <EventTypeChooser value={eventType} onChange={applyEventType} />}

                {eventType && (
                    <EventTypeBanner
                        eventType={eventType}
                        onChangeRequest={() => setConfirmTypeChange(true)}
                    />
                )}

                {confirmTypeChange && (
                    <Modal
                        title="Change event type?"
                        message="Switching between a water event and an indoor event resets your selected categories and entry fees. Everything else you have filled in is kept."
                        onClose={() => setConfirmTypeChange(false)}
                        actions={[
                            { label: "Keep current", onClick: () => setConfirmTypeChange(false) },
                            {
                                label: "Change type",
                                variant: "primary",
                                onClick: () => {
                                    applyEventType(eventType === "erg" ? "open_water" : "erg");
                                    setConfirmTypeChange(false);
                                },
                            },
                        ]}
                    />
                )}

                {eventType && <>
                {/* Stripe guard banner */}
                {stripeSupported && !stripeOnboarded && (
                    <div style={{
                        background: "rgba(254,185,89,0.06)",
                        border: "1px solid rgba(254,185,89,0.22)",
                        borderRadius: 10,
                        padding: "12px 16px",
                        marginBottom: 16,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                    }}>
                        <span style={{ color: "#FEB959", fontSize: 18, flexShrink: 0 }}>⚡</span>
                        <div>
                            <div style={{ color: "#FEB959", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                                Stripe not connected
                            </div>
                            <div className="muted" style={{ fontSize: 13 }}>
                                To charge entry fees, connect your Stripe account first.{" "}
                                <Link to="/admin/club" style={{ color: "#FEB959" }}>
                                    Go to Club Dashboard →
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <label>
                        <span className="inline-flex items-center">
                            Name
                            <InfoTooltip text="The public name of the event shown to all participants." position="right" />
                        </span>
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>

                    <label>
                        <span className="inline-flex items-center">
                            Location
                            <InfoTooltip
                                text={isErg
                                    ? "Where the event is based. Athletes row on their own machines, so \"Remote\" or your club's name is fine."
                                    : "The city, venue or general area where the event takes place."}
                                position="right"
                            />
                        </span>
                        <input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder={isErg ? "e.g. Remote" : undefined}
                        />
                    </label>

                    <label>
                        <span className="inline-flex items-center">
                            Description
                            <InfoTooltip text="Optional details about the event shown on the event page." position="right" />
                        </span>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-[10px] items-start [&>label]:mt-0">
                        <label>
                            <span className="inline-flex items-center">
                                Start Date
                                <InfoTooltip text="The date the event begins." position="right" />
                            </span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </label>

                        <label>
                            <span className="inline-flex items-center">
                                End Date
                                <InfoTooltip text="The last day of the event. Must be on or after the start date." position="right" />
                            </span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </label>

                        {isErg ? (
                            <label>
                                <span className="inline-flex items-center">
                                    Entries close
                                    <InfoTooltip text="Indoor events have no separate registration deadline — entering and rowing happen in the same window, so athletes can join at any point until the event ends." position="right" />
                                </span>
                                <div
                                    style={{
                                        marginTop: 6,
                                        padding: "8px 14px",
                                        borderRadius: "var(--radius-sm)",
                                        background: "var(--surface-2)",
                                        border: "1px solid var(--border)",
                                        fontSize: 13,
                                    }}
                                >
                                    <span style={{ fontWeight: 700 }}>When the event ends</span>
                                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                        Athletes can enter at any time.
                                    </div>
                                </div>
                            </label>
                        ) : (
                        <div>
                            {/* Two controls, so two labels: the date field and the
                                opt-out cannot share one without the checkbox text
                                pointing at the date input. */}
                            <label>
                                <span className="inline-flex items-center">
                                    Closing Date
                                    <InfoTooltip text="The last day athletes can register. Must be before the start date. Tick “No closing date” to keep entries open until you close them from the manage page." position="right" />
                                </span>
                                <input
                                    type="date"
                                    value={closingDate}
                                    onChange={(e) => setClosingDate(e.target.value)}
                                    disabled={noClosingDate}
                                />
                            </label>

                            <label
                                className="inline-flex items-center gap-2"
                                style={{ marginTop: 8, fontSize: 13, cursor: "pointer" }}
                            >
                                <input
                                    type="checkbox"
                                    checked={noClosingDate}
                                    onChange={(e) => {
                                        setNoClosingDate(e.target.checked);
                                        if (e.target.checked) setClosingDate("");
                                    }}
                                    style={{ width: 16, height: 16, margin: 0 }}
                                />
                                No closing date
                            </label>

                            <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                                {noClosingDate
                                    ? "Entries stay open until you close them on the manage page, and never past the end of the event."
                                    : "Registration closes automatically on this date."}
                            </span>
                        </div>
                        )}

                        {isErg ? (
                            <label>
                                <span className="inline-flex items-center">
                                    Distance
                                    <InfoTooltip text="Indoor erg events are 2000m. Other distances will be added later." position="right" />
                                </span>
                                <div
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginTop: 6,
                                        padding: "8px 14px",
                                        borderRadius: "var(--radius-sm)",
                                        background: "var(--surface-2)",
                                        border: "1px solid var(--border)",
                                        fontWeight: 700,
                                    }}
                                >
                                    <span style={{ color: "var(--brand)" }}>2000m</span>
                                    <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                                        Concept2 RowErg
                                    </span>
                                </div>
                            </label>
                        ) : (
                        <label>
                            <span className="inline-flex items-center">
                                Length (meters)
                                <InfoTooltip text="The total race distance in meters. Locked to 3000m for Regional Series and 6000m for National events." position="right" />
                            </span>
                            <input
                                type="number"
                                value={seriesType ? SERIES_LENGTH_METERS[seriesType] : lengthMeters}
                                onChange={(e) => setLengthMeters(Number(e.target.value))}
                                disabled={!!seriesType}
                            />
                            {seriesType && (
                                <p className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                                    Distance is fixed at {SERIES_LENGTH_METERS[seriesType]}m for {seriesType === "regional_series" ? "Regional Series" : seriesType === "national_series" ? "National Series" : "National Events"}.
                                    {seriesType === "national_event" && " Junior 14–16 and Masters categories race 3000m."}
                                </p>
                            )}
                        </label>
                        )}
                    </div>

                    {!isErg && allowedSeriesTypes.length > 0 && (
                        <label style={{ marginTop: "1rem" }}>
                            <span className="inline-flex items-center">
                                Series Type
                                <InfoTooltip text="Designate this event as part of a Regional Series, National Series, or National Event. Distance requirements are enforced automatically." position="right" />
                            </span>
                            <select
                                value={seriesType}
                                onChange={(e) => setSeriesType(e.target.value as EventSeriesType | "")}
                            >
                                <option value="">Standard Event</option>
                                {allowedSeriesTypes.includes("regional_series") && (
                                    <option value="regional_series">Regional Series (3000m)</option>
                                )}
                                {allowedSeriesTypes.includes("national_series") && (
                                    <option value="national_series">National Series (3000m)</option>
                                )}
                                {allowedSeriesTypes.includes("national_event") && (
                                    <option value="national_event">National Event (6000m)</option>
                                )}
                            </select>
                        </label>
                    )}
                    {!isErg && <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: "1rem" }}>
                        <input
                            type="checkbox"
                            checked={autoAssignBowNumbers}
                            onChange={(e) => setAutoAssignBowNumbers(e.target.checked)}
                            style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <span className="inline-flex items-center" style={{ fontWeight: 600, fontSize: 14 }}>
                            Auto-assign bow numbers
                            <InfoTooltip
                                text="When enabled, bow numbers are assigned automatically once registration closes — on the closing date, or when you close registration yourself on the manage page. Numbers are allocated in category order (as listed below), with entries within each category ordered by registration time. Excluded bow numbers are always skipped. You can also assign or adjust numbers manually at any time in the Bow Numbers tab."
                                position="right"
                            />
                        </span>
                    </label>}

                    {!isErg && noClosingDate && autoAssignBowNumbers && (
                        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            With no closing date, bow numbers are assigned when you close
                            registration on the manage page.
                        </p>
                    )}

                    {isErg && (
                        <div
                            className="mt-4"
                            style={{
                                padding: "12px 14px",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                                How scores reach the leaderboard
                            </div>
                            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                                Athletes link their Concept2 Logbook and row 2000m on a RowErg
                                between your start and end dates. Only pieces Concept2 marks as
                                verified — uploaded straight from a PM5 via ErgData or the
                                Concept2 Utility — are ranked. Each athlete may row as many
                                attempts as they like on one entry fee; their fastest counts.
                                You don't record any times yourself.
                            </p>
                        </div>
                    )}
                </div>

                <CategoryPicker
                    value={categories}
                    onChange={setCategories}
                    mode={isErg ? "erg" : "openWater"}
                />

                {/* Entry fees — Stripe-supported countries only */}
                {clubCountry === null && (
                    <div className="card mt-[14px]">
                        <div className={`${skeletonBar} mb-3`} style={{ width: 120, height: 18 }} />
                        <div className={skeletonBar} style={{ width: "60%", height: 14 }} />
                    </div>
                )}
                {clubCountry !== null && !stripeSupported && (
                    <div className="card mt-[14px]" style={{ opacity: 0.7 }}>
                        <h3>Entry Fees</h3>
                        <p className="muted mt-1" style={{ fontSize: 13 }}>
                            Entry fees are not yet available for events in your country.
                        </p>
                    </div>
                )}
                {stripeSupported && <div className="card mt-[14px]">
                    <h3>Entry Fees <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>(optional)</span></h3>
                    <p className="muted mt-1" style={{ fontSize: 13 }}>
                        {isErg
                            ? "One entry fee covers the whole event — an athlete may submit as many 2k attempts as they like. Leave blank for a free event."
                            : "Set a default fee for all boat types, or override per boat class. Leave blank for a free event."}
                    </p>

                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "8px 12px" }}>
                        {/* Default / apply-to-all row */}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {isErg ? "Entry fee" : "All boat types"}
                            <InfoTooltip
                                text={isErg
                                    ? "Charged once per athlete, per category entered. Covers unlimited 2k attempts."
                                    : "Default fee applied to every boat class that doesn't have its own override."}
                                position="right"
                            />
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="muted">$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={globalFeeUsd}
                                onChange={(e) => setGlobalFeeUsd(e.target.value)}
                                style={{ width: 90, textAlign: "right" }}
                            />
                        </div>

                        {/* Per-boat-class rows — only for classes present in selected
                            categories. Erg events have no boat classes to price. */}
                        {!isErg && selectedBoatClasses.map((bc) => (
                            <>
                                <span key={`label-${bc}`} style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 10 }}>
                                    {BOAT_CLASS_LABEL[bc]}
                                </span>
                                <div key={`input-${bc}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span className="muted">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder={globalFeeUsd || "0.00"}
                                        value={boatFees[bc] ?? ""}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setBoatFees(prev => {
                                                if (!v.trim()) {
                                                    const next = { ...prev };
                                                    delete next[bc];
                                                    return next;
                                                }
                                                return { ...prev, [bc]: v };
                                            });
                                        }}
                                        style={{ width: 90, textAlign: "right" }}
                                    />
                                </div>
                            </>
                        ))}
                    </div>

                    {!isErg && selectedBoatClasses.length === 0 && (
                        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                            Select categories above to see per-boat-class fee options.
                        </p>
                    )}

                    {needsStripeSetup && (
                        <div style={{
                            marginTop: 16,
                            padding: "14px 16px",
                            background: "rgba(254,185,89,0.07)",
                            border: "1px solid rgba(254,185,89,0.30)",
                            borderRadius: 10,
                        }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#FEB959", marginBottom: 6 }}>
                                Stripe setup required
                            </div>
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
                                You've added entry fees, but your club doesn't have a Stripe account connected.
                                Set it up now — your event details will be saved and you'll be brought straight back.
                            </p>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleConnectStripe}
                                disabled={connectingStripe}
                                style={{ width: "100%" }}
                            >
                                {connectingStripe ? "Opening Stripe…" : "Set up Stripe & continue →"}
                            </button>
                        </div>
                    )}
                </div>}

                <div className="card mt-[14px]">
                    <div className="space-between">
                        <div>
                            <h3>Selected Categories</h3>
                            <p className="muted mt-1">
                                Enabled: <b className="text-text">{categories.length}</b>
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setCategories(isErg ? [] : buildDefaultCategories())}
                        >
                            {isErg ? "Clear all" : "Reset to All"}
                        </button>
                    </div>

                    {categories.length === 0 && (
                        <p className="muted mt-[10px]" style={{ fontSize: 13 }}>
                            Pick at least one category above before creating the event.
                        </p>
                    )}

                    <ul className="mt-[10px] pl-[18px]">
                        {categories.slice(0, 12).map((c) => (
                            <li key={c} className="muted mb-[6px]">
                                {c}
                            </li>
                        ))}
                        {categories.length > 12 && <li className="muted">…and {categories.length - 12} more</li>}
                    </ul>
                </div>

                {err && <p className="text-[crimson]">{err}</p>}

                <button
                    className="btn-primary mt-4 w-full sm:w-auto"
                    disabled={!canSubmit || busy}
                    onClick={onCreate}
                >
                    {busy
                        ? "Creating..."
                        : isErg ? "Create Indoor Event" : "Create Water Event"}
                </button>
                </>}
            </main>
        </>
    );
}
