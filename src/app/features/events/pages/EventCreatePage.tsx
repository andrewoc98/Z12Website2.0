import { useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider.tsx";
import CategoryPicker from "../components/CategoryPicker";
import { buildDefaultCategories } from "../lib/categories";
// import type { EventDoc } from "../types";
// import { createEvent } from "../api/events";

export default function EventCreatePage() {
    const { user } = useAuth();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    const [lengthMeters, setLengthMeters] = useState<number>(2000);

    // ✅ Official categories enabled by default; host can omit
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

    async function onCreate() {
        if (!user || !canSubmit) return;

        setBusy(true);
        setErr(null);
        try {
            // ✅ When you re-enable persistence, use this:
            // const doc: EventDoc = {
            //   hostId: user.uid,
            //   name,
            //   description,
            //   location,
            //   startDate,
            //   endDate,
            //   closingDate,
            //   lengthMeters,
            //   categories,
            //   status: "open",
            // };
            // await createEvent(doc);

            // reset
            setName("");
            setDescription("");
            setLocation("");
            setStartDate("");
            setEndDate("");
            setClosingDate("");
            setLengthMeters(2000);
            setCategories(buildDefaultCategories());
            alert("Event created!");
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
                            <input
                                type="number"
                                value={lengthMeters}
                                onChange={(e) => setLengthMeters(Number(e.target.value))}
                            />
                        </label>
                    </div>
                </div>

                {/* ✅ Modern category selection */}
                <CategoryPicker value={categories} onChange={setCategories} />

                <div className="card" style={{ marginTop: 14 }}>
                    <div className="space-between">
                        <div>
                            <h3>Selected Categories</h3>
                            <p className="muted" style={{ marginTop: 4 }}>
                                Enabled: <b style={{ color: "var(--text)" }}>{categories.length}</b>
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setCategories(buildDefaultCategories())}
                        >
                            Reset to All
                        </button>
                    </div>

                    {/* Optional: show a compact preview list */}
                    <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                        {categories.slice(0, 12).map((c) => (
                            <li key={c} className="muted" style={{ marginBottom: 6 }}>
                                {c}
                            </li>
                        ))}
                        {categories.length > 12 && (
                            <li className="muted">…and {categories.length - 12} more</li>
                        )}
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
