import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import CategoryPicker from "../components/CategoryPicker";
import { buildDefaultCategories } from "../lib/categories";
import { categoriesFromIds, createEvent, dateInputToTimestampStartOfDay,dateInputToTimestampEndOfDay } from "../api/events";
import type { EventStatus } from "../types";
import InfoTooltip from "../../../shared/components/Infotooltip/Infotooltip.tsx";

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

    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
                name: name.trim(),
                description: description.trim(),
                location: location.trim(),
                startAt,
                endAt,
                closeAt,
                lengthMeters: Number(lengthMeters),
                categories: categoriesFromIds(categories),
                status,
                createdByUid: user.uid,
                createdByName:
                    profile?.displayName ||
                    user.displayName ||
                    user.email ||
                    "Host",
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

                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
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
