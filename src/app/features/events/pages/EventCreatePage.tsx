import { useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider.tsx";


const DEFAULT_CATEGORIES = [
    "1x Men Open",
    "1x Women Open",
    "2x Men Open",
    "2x Women Open",
    "4x Mixed",
    "8+ Open",
];

export default function EventCreatePage() {
    const { user } = useAuth();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [closingDate, setClosingDate] = useState("");
    const [lengthMeters, setLengthMeters] = useState<number>(2000);

    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [newCat, setNewCat] = useState("");

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
            // const doc: EventDoc = {
            //     hostId: user.uid,
            //     name,
            //     description,
            //     location,
            //     startDate,
            //     endDate,
            //     closingDate,
            //     lengthMeters,
            //     categories,
            //     status: "open",
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
            setCategories(DEFAULT_CATEGORIES);
            setNewCat("");
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

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
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
                        <input
                            type="date"
                            value={closingDate}
                            onChange={(e) => setClosingDate(e.target.value)}
                        />
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

                <h2 style={{ marginTop: 16 }}>Categories</h2>
                <ul>
                    {categories.map((c) => (
                        <li key={c} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span>{c}</span>
                            <button onClick={() => setCategories(categories.filter((x) => x !== c))}>Remove</button>
                        </li>
                    ))}
                </ul>

                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        value={newCat}
                        placeholder="Add category..."
                        onChange={(e) => setNewCat(e.target.value)}
                    />
                    <button
                        onClick={() => {
                            const v = newCat.trim();
                            if (!v) return;
                            if (categories.includes(v)) return;
                            setCategories([...categories, v]);
                            setNewCat("");
                        }}
                    >
                        Add
                    </button>
                </div>

                {err && <p style={{ color: "crimson" }}>{err}</p>}

                <button disabled={!canSubmit || busy} onClick={onCreate} style={{ marginTop: 16 }}>
                    {busy ? "Creating..." : "Create Event"}
                </button>
            </main>
        </>
    );
}
