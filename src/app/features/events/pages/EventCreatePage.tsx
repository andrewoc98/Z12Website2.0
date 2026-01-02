import { useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import CategoryPicker from "../components/CategoryPicker";
import { buildDefaultCategories } from "../lib/categories";
import { categoriesFromIds, createEvent, dateInputToTimestampLocalMidday } from "../api/events";
import type { EventStatus } from "../types";

export default function EventCreatePage() {
    const { user, profile } = useAuth() as any; // remove `as any` if your hook is typed

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    const [lengthMeters, setLengthMeters] = useState<number>(2000);

    const [categories, setCategories] = useState<string[]>(() => buildDefaultCategories());

    // optional: allow host to choose initial status
    const [status, setStatus] = useState<EventStatus>("open"); // or "draft"

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

    async function onCreate() {
        if (!user || !canSubmit) return;

        setBusy(true);
        setErr(null);
        try {
            const startAt = dateInputToTimestampLocalMidday(startDate);
            const endAt = dateInputToTimestampLocalMidday(endDate);
            const closeAt = dateInputToTimestampLocalMidday(closingDate);

            // basic validation
            if (endAt.toMillis() < startAt.toMillis()) throw new Error("End date must be on/after start date.");

            const eventId = await createEvent({
                name: name.trim(),
                description: description.trim(),
                location: location.trim(),
                startAt,
                endAt,
                closeAt,
                lengthMeters: Number(lengthMeters),
                categories: categoriesFromIds(categories),
                status, // "open" or "draft"
                createdByUid: user.uid,
                createdByName: profile?.displayName || user.displayName || user.email || "Host",
            });

            // reset
            setName("");
            setDescription("");
            setLocation("");
            setStartDate("");
            setEndDate("");
            setClosingDate("");
            setLengthMeters(2000);
            setCategories(buildDefaultCategories());
            setStatus("open");

            alert(`Event created! (${eventId})`);
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
                    <label>
                        Name
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>

                    <label>
                        Location
                        <input value={location} onChange={(e) => setLocation(e.target.value)} />
                    </label>

                    <label>
                        Description
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>

                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                        <label>
                            Start Date
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </label>

                        <label>
                            End Date
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </label>

                        <label>
                            Closing Date
                            <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
                        </label>

                        <label>
                            Length (meters)
                            <input type="number" value={lengthMeters} onChange={(e) => setLengthMeters(Number(e.target.value))} />
                        </label>
                    </div>

                    {/* Optional: initial status selector */}
                    <label>
                        Status
                        <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
                            <option value="draft">Draft</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="running">Running</option>
                            <option value="finished">Finished</option>
                        </select>
                    </label>
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

                <button className="btn-primary" disabled={!canSubmit || busy} onClick={onCreate} style={{ marginTop: 16 }}>
                    {busy ? "Creating..." : "Create Event"}
                </button>
            </main>
        </>
    );
}
