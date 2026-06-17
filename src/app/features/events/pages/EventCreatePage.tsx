import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import { useAdminClaims } from "../../admin/hooks/useAdminClaims";
import { getClub } from "../../admin/services/clubAdminService";
import CategoryPicker from "../components/CategoryPicker";
import { buildDefaultCategories, parseBoatClassFromCategory } from "../lib/categories";
import type { BoatClass } from "../lib/categories";
import { categoriesFromIds, createEvent, dateInputToTimestampStartOfDay,dateInputToTimestampEndOfDay } from "../api/events";
import type { EventStatus, EventSeriesType } from "../types";
import { SERIES_LENGTH_METERS } from "../types";
import InfoTooltip from "../../../shared/components/Infotooltip/Infotooltip.tsx";
import { Link } from "react-router-dom";

export default function EventCreatePage() {
    const { user, profile } = useAuth() as any;
    const { clubId } = useAdminClaims();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    const [lengthMeters, setLengthMeters] = useState<number>(3000);
    const [seriesType, setSeriesType] = useState<EventSeriesType | "">("");

    const [categories, setCategories] = useState<string[]>(() => buildDefaultCategories());

    const [allowedSeriesTypes, setAllowedSeriesTypes] = useState<EventSeriesType[]>([]);
    const [clubCountry, setClubCountry] = useState<string | null>(null);

    const stripeOnboarded: boolean = profile?.roles?.clubAdmin?.stripeOnboarded ?? false;

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

    useEffect(() => {
        if (!clubId) return;
        getClub(clubId).then(club => {
            setAllowedSeriesTypes(club?.allowedSeriesTypes ?? []);
            setClubCountry(club?.location?.country ?? null);
        }).catch(() => {});
    }, [clubId]);

    const canSubmit = useMemo(() => {
        return (
            !!user &&
            name.trim().length > 1 &&
            location.trim().length > 1 &&
            startDate &&
            endDate &&
            closingDate &&
            lengthMeters > 0 &&
            categories.length > 0
        );
    }, [user, name, location, startDate, endDate, closingDate, lengthMeters, categories]);

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
            const closeAt = dateInputToTimestampEndOfDay(closingDate);

            const startMillis = startAt.toMillis();
            const endMillis = endAt.toMillis();
            const closeMillis = closeAt.toMillis();

            if (endMillis < startMillis) {
                throw new Error("End date must be on or after start date.");
            }

            if (closeMillis > startMillis) {
                throw new Error("Registration closing date must be before the start date.");
            }

            const status = calculateInitialStatus(
                startMillis,
                endMillis,
                closeMillis
            );

            const resolvedLength = seriesType
                ? SERIES_LENGTH_METERS[seriesType]
                : Number(lengthMeters);

            const globalFeeCents = globalFeeUsd.trim()
                ? Math.round(parseFloat(globalFeeUsd) * 100)
                : 0;

            const builtCategories = categoriesFromIds(categories).map(c => {
                if (clubCountry !== "US") return c; // entry fees only permitted for US clubs
                const bc = parseBoatClassFromCategory(c.id);
                const overrideStr = bc ? boatFees[bc] : undefined;
                const feeCents = overrideStr?.trim()
                    ? Math.round(parseFloat(overrideStr) * 100)
                    : globalFeeCents;
                return feeCents > 0 ? { ...c, feeCents } : c;
            });

            const eventId = await createEvent({
                bowsAssigned: false,
                autoAssignBowNumbers,
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
                ...(seriesType ? { seriesType } : {}),
                createdByUid: user.uid,
                createdByName:
                    profile?.displayName ||
                    user.displayName ||
                    user.email ||
                    "Club Admin",
            });

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

                {/* Stripe guard banner */}
                {!stripeOnboarded && (
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
                            <InfoTooltip text="The city, venue or general area where the event takes place." position="right" />
                        </span>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} />
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

                        <label>
                            <span className="inline-flex items-center">
                                Closing Date
                                <InfoTooltip text="The last day athletes can register. Must be before the start date." position="right" />
                            </span>
                            <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
                        </label>

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
                                    Distance is fixed at {SERIES_LENGTH_METERS[seriesType]}m for {seriesType === "regional_series" ? "Regional Series" : "National events"}.
                                </p>
                            )}
                        </label>
                    </div>

                    {allowedSeriesTypes.length > 0 && (
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
                                    <option value="national_series">National Series (6000m)</option>
                                )}
                                {allowedSeriesTypes.includes("national_event") && (
                                    <option value="national_event">National Event (6000m)</option>
                                )}
                            </select>
                        </label>
                    )}
                </div>

                <div className="card mt-[14px]">
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={autoAssignBowNumbers}
                            onChange={(e) => setAutoAssignBowNumbers(e.target.checked)}
                            style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <span>
                            <span className="inline-flex items-center" style={{ fontWeight: 600, fontSize: 14 }}>
                                Auto-assign bow numbers
                                <InfoTooltip
                                    text="When enabled, bow numbers are assigned automatically once the registration closing date passes. Numbers are allocated in category order (as listed below), with entries within each category ordered by registration time. Excluded bow numbers are always skipped. You can also assign or adjust numbers manually at any time in the Bow Numbers tab."
                                    position="right"
                                />
                            </span>
                            <span className="muted" style={{ display: "block", fontSize: 13, marginTop: 3 }}>
                                Off by default — enable only if you want the system to assign numbers automatically after closing.
                            </span>
                        </span>
                    </label>
                </div>

                <CategoryPicker value={categories} onChange={setCategories} />

                {/* Entry fees — US clubs only */}
                {clubCountry === null && (
                    <div className="card mt-[14px]">
                        <div className={`${skeletonBar} mb-3`} style={{ width: 120, height: 18 }} />
                        <div className={skeletonBar} style={{ width: "60%", height: 14 }} />
                    </div>
                )}
                {clubCountry !== null && clubCountry !== "US" && (
                    <div className="card mt-[14px]" style={{ opacity: 0.7 }}>
                        <h3>Entry Fees</h3>
                        <p className="muted mt-1" style={{ fontSize: 13 }}>
                            Entry fees are only available for US-based events.
                        </p>
                    </div>
                )}
                {clubCountry === "US" && <div className="card mt-[14px]">
                    <h3>Entry Fees <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>(optional)</span></h3>
                    <p className="muted mt-1" style={{ fontSize: 13 }}>
                        Set a default fee for all boat types, or override per boat class. Leave blank for a free event.
                    </p>

                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "8px 12px" }}>
                        {/* Default / apply-to-all row */}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            All boat types
                            <InfoTooltip text="Default fee applied to every boat class that doesn't have its own override." position="right" />
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

                        {/* Per-boat-class rows — only for classes present in selected categories */}
                        {selectedBoatClasses.map((bc) => (
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

                    {selectedBoatClasses.length === 0 && (
                        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                            Select categories above to see per-boat-class fee options.
                        </p>
                    )}

                    {anyFeeSet && !stripeOnboarded && (
                        <p style={{ color: "#FEB959", fontSize: 12, marginTop: 10 }}>
                            Connect Stripe in your Club Dashboard before athletes can pay this fee.
                        </p>
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

                        <button type="button" className="btn-ghost" onClick={() => setCategories(buildDefaultCategories())}>
                            Reset to All
                        </button>
                    </div>

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
                    {busy ? "Creating..." : "Create Event"}
                </button>
            </main>
        </>
    );
}
