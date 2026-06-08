import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import CategoryPicker from "../components/CategoryPicker";
import { buildDefaultCategories, parseBoatClassFromCategory } from "../lib/categories";
import type { BoatClass } from "../lib/categories";
import { categoriesFromIds, createEvent, dateInputToTimestampStartOfDay, dateInputToTimestampEndOfDay } from "../api/events";
import type { EventCategory, EventStatus } from "../types";
import InfoTooltip from "../../../shared/components/Infotooltip/Infotooltip.tsx";
import { saveHostDefaultSeatFees } from "../../auth/api/users";
import "../styles/EventCreatePage.css";

const PLATFORM_RATE = 0.10;
const MIN_FEE_CENTS = 100;   // $1.00 — Stripe minimum
const MAX_FEE_CENTS = 100000; // $1000.00

const BOAT_CONFIGS: { key: BoatClass; label: string }[] = [
    { key: "1x",  label: "Single (1x)"      },
    { key: "2x",  label: "Double Scull (2x)" },
    { key: "2-",  label: "Pair (2-)"         },
    { key: "4x+", label: "Quad (4x+)"        },
];

type SeatFeeMap = Record<BoatClass, string>;
const EMPTY_FEES: SeatFeeMap = { "1x": "", "2x": "", "2-": "", "4x+": "" };

function parseFee(val: string): number | null {
    if (!val.trim()) return 0;
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return null;
    return Math.round(n * 100);
}

function feeError(val: string): string | null {
    if (!val.trim()) return null;
    const cents = parseFee(val);
    if (cents === null) return "Enter a valid amount";
    if (cents > 0 && cents < MIN_FEE_CENTS) return "Minimum is $1.00 (leave blank for free)";
    if (cents > MAX_FEE_CENTS) return "Maximum fee is $1,000.00";
    return null;
}

export default function EventCreatePage() {
    const { user, profile } = useAuth() as any;
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    const [lengthMeters, setLengthMeters] = useState<number>(3000);

    const [categories, setCategories] = useState<string[]>(() => buildDefaultCategories());
    const [seatFees, setSeatFees] = useState<SeatFeeMap>(EMPTY_FEES);

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Pre-populate from host's last-used fees
    useEffect(() => {
        const defaults = profile?.roles?.host?.defaultSeatFees;
        if (!defaults) return;
        setSeatFees({
            "1x":  defaults["1x"]  ? (defaults["1x"]  / 100).toFixed(2) : "",
            "2x":  defaults["2x"]  ? (defaults["2x"]  / 100).toFixed(2) : "",
            "2-":  defaults["2-"]  ? (defaults["2-"]  / 100).toFixed(2) : "",
            "4x+": defaults["4x+"] ? (defaults["4x+"] / 100).toFixed(2) : "",
        });
    }, [profile]);

    const feesValid = useMemo(
        () => BOAT_CONFIGS.every(({ key }) => !feeError(seatFees[key])),
        [seatFees]
    );

    const canSubmit = useMemo(() => {
        return (
            !!user &&
            name.trim().length > 1 &&
            location.trim().length > 1 &&
            startDate &&
            endDate &&
            closingDate &&
            lengthMeters > 0 &&
            categories.length > 0 &&
            feesValid
        );
    }, [user, name, location, startDate, endDate, closingDate, lengthMeters, categories, feesValid]);

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

    function buildCategoriesWithFees(): EventCategory[] {
        return categoriesFromIds(categories).map((cat) => {
            const bc = parseBoatClassFromCategory(cat.id);
            if (!bc) return cat;
            const cents = parseFee(seatFees[bc]);
            if (!cents) return cat;
            return { ...cat, feeCents: cents };
        });
    }

    async function onCreate() {
        if (!user || !canSubmit) return;

        setBusy(true);
        setErr(null);

        try {
            const startAt = dateInputToTimestampStartOfDay(startDate);
            const endAt = dateInputToTimestampEndOfDay(endDate);
            const closeAt = dateInputToTimestampStartOfDay(closingDate);

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

            const eventId = await createEvent({
                bowsAssigned: false,
                name: name.trim(),
                description: description.trim(),
                location: location.trim(),
                startAt,
                endAt,
                closeAt,
                lengthMeters: Number(lengthMeters),
                categories: buildCategoriesWithFees(),
                status,
                createdByUid: user.uid,
                createdByName:
                    profile?.displayName ||
                    user.displayName ||
                    user.email ||
                    "Host",
            });

            // Persist defaults for next event (fire-and-forget)
            const defaults: Partial<Record<BoatClass, number>> = {};
            for (const { key } of BOAT_CONFIGS) {
                const cents = parseFee(seatFees[key]);
                if (cents && cents > 0) defaults[key] = cents;
            }
            saveHostDefaultSeatFees(user.uid, defaults).catch(() => {});

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

                <div className="card">
                    <label className="event-form">
                        <span>
                            Name
                            <InfoTooltip text="The public name of the event shown to all participants." position="right" />
                        </span>
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>

                    <label className="event-form">
                        <span>
                            Location
                            <InfoTooltip text="The city, venue or general area where the event takes place." position="right" />
                        </span>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} />
                    </label>

                    <label className="event-form">
                        <span>
                            Description
                            <InfoTooltip text="Optional details about the event shown on the event page." position="right" />
                        </span>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>

                    <div className="event-dates-grid">
                        <label className="event-form">
                            <span>
                                Start Date
                                <InfoTooltip text="The date the event begins." position="right" />
                            </span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </label>

                        <label className="event-form">
                            <span>
                                End Date
                                <InfoTooltip text="The last day of the event. Must be on or after the start date." position="right" />
                            </span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </label>

                        <label className="event-form">
                            <span>
                                Closing Date
                                <InfoTooltip text="The last day athletes can register. Must be before the start date." position="right" />
                            </span>
                            <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
                        </label>
                        <label className="event-form">
                            <span>
                                Length (meters)
                                <InfoTooltip text="The total race distance in meters, e.g. 5000 for a 5K." position="right" />
                            </span>
                            <input type="number" value={lengthMeters} onChange={(e) => setLengthMeters(Number(e.target.value))} />
                        </label>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 14 }}>
                    <h3 style={{ margin: 0 }}>
                        Entry Fees
                        <span className="muted" style={{ fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
                            optional
                        </span>
                    </h3>
                    <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
                        Set a per-boat entry fee for each class. Leave blank for free entry.
                        The platform retains 10% of each fee collected.
                    </p>

                    <div className="seat-fee-list">
                        {BOAT_CONFIGS.map(({ key, label }) => {
                            const val = seatFees[key];
                            const cents = parseFee(val);
                            const feeErr = feeError(val);
                            const athletePays = (cents ?? 0) / 100;
                            const hostReceives = athletePays * (1 - PLATFORM_RATE);

                            return (
                                <div key={key} className="seat-fee-row">
                                    <span className="seat-fee-label">{label}</span>
                                    <div className="seat-fee-input-wrap">
                                        <span className="seat-fee-currency">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="1000"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={val}
                                            onChange={(e) =>
                                                setSeatFees((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        />
                                    </div>
                                    {feeErr ? (
                                        <p className="seat-fee-meta seat-fee-meta--error">{feeErr}</p>
                                    ) : val.trim() && athletePays > 0 ? (
                                        <p className="seat-fee-meta seat-fee-meta--breakdown">
                                            Athletes pay <b>${athletePays.toFixed(2)}</b>
                                            {" → "}you receive <b>${hostReceives.toFixed(2)}</b>
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <CategoryPicker value={categories} onChange={setCategories} />

                <div className="card" style={{ marginTop: 14 }}>
                    <div className="space-between">
                        <div>
                            <h3>Selected Categories</h3>
                            <p className="muted" style={{ marginTop: 4 }}>
                                Enabled: <b style={{ color: "var(--text)" }}>{categories.length}</b>
                            </p>
                        </div>

                        <button type="button" className="btn-ghost" onClick={() => setCategories(buildDefaultCategories())}>
                            Reset to All
                        </button>
                    </div>

                    <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                        {categories.slice(0, 12).map((c) => (
                            <li key={c} className="muted" style={{ marginBottom: 6 }}>
                                {c}
                            </li>
                        ))}
                        {categories.length > 12 && <li className="muted">…and {categories.length - 12} more</li>}
                    </ul>
                </div>

                {err && <p style={{ color: "crimson" }}>{err}</p>}

                <button
                    className="btn-primary"
                    disabled={!canSubmit || busy}
                    onClick={onCreate}
                    style={{ marginTop: 16 }}
                >
                    {busy ? "Creating..." : "Create Event"}
                </button>
            </main>
        </>
    );
}
