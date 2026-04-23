import {useEffect, useState} from "react";
import { dateInputToTimestampStartOfDay, dateInputToTimestampEndOfDay, updateEvent } from "../../../api/events";

interface Props {
    event: any;
    onSaved?: (updated: any) => void;
}

export default function EventHeaderEditor({ event, onSaved }: Props) {

    useEffect(() => {
        console.log(event)
    }, []);

    const toDateInput = (ts: any): string => {
        if (!ts) return "";
        const ms = typeof ts.toMillis === "function"
            ? ts.toMillis()
            : typeof ts === "number"
                ? ts
                : new Date(ts).getTime();
        return new Date(ms).toISOString().slice(0, 10);
    };

    const fmt = (ts: any) => {
        const d = toDateInput(ts);
        return d ? new Date(d).toLocaleDateString() : "—";
    };

    const [edit, setEdit] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [name, setName] = useState(event.name ?? "");
    const [location, setLocation] = useState(event.location ?? "");
    const [description, setDescription] = useState(event.description ?? "");
    const [startDate, setStartDate] = useState(() => toDateInput(event.startDate));
    const [endDate, setEndDate] = useState(() => toDateInput(event.endDate));
    const [closingDate, setClosingDate] = useState(() => toDateInput(event.closingDate));
    const [lengthMeters, setLengthMeters] = useState<number>(event.lengthMeters ?? 0);

    const resetDraft = () => {
        setName(event.name ?? "");
        setLocation(event.location ?? "");
        setDescription(event.description ?? "");
        setStartDate(toDateInput(event.startDate));
        setEndDate(toDateInput(event.endDate));
        setClosingDate(toDateInput(event.closingDate));
        setLengthMeters(event.lengthMeters ?? 0);
    };

    const save = async () => {
        setErr(null);
        setBusy(true);

        try {
            const startAt = dateInputToTimestampStartOfDay(startDate);
            const endAt = dateInputToTimestampEndOfDay(endDate);
            const closeAt = dateInputToTimestampStartOfDay(closingDate);

            if (endAt.toMillis() < startAt.toMillis()) {
                throw new Error("End date must be on or after start date.");
            }
            if (closeAt.toMillis() > startAt.toMillis()) {
                throw new Error("Registration closing date must be before the start date.");
            }

            const updates = {
                name: name.trim(),
                location: location.trim(),
                description: description.trim(),
                startAt,
                endAt,
                closeAt,
                lengthMeters: Number(lengthMeters),
            };

            await updateEvent(event.id, updates);
            onSaved?.({ ...event, ...updates });
            setEdit(false);

        } catch (e: any) {
            setErr(e?.message ?? "Failed to save changes.");
        } finally {
            setBusy(false);
        }
    };

    const cancel = () => {
        resetDraft();
        setErr(null);
        setEdit(false);
    };

    return (
        <section className="card">
            <div className="card-header">
                <h2>Event Overview</h2>
                {!edit && (
                    <button onClick={() => setEdit(true)}>Edit</button>
                )}
                {edit && (
                    <>
                        <button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
                        <button onClick={cancel} disabled={busy}>Cancel</button>
                    </>
                )}
            </div>

            <div className="event-grid">
                <label>Name</label>
                {edit
                    ? <input value={name} onChange={e => setName(e.target.value)} />
                    : <span>{event.name}</span>}

                <label>Location</label>
                {edit
                    ? <input value={location} onChange={e => setLocation(e.target.value)} />
                    : <span>{event.location}</span>}

                <label>Start Date</label>
                {edit
                    ? <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    : <span>{fmt(event.startDate)}</span>}

                <label>End Date</label>
                {edit
                    ? <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    : <span>{fmt(event.endDate)}</span>}

                <label>Closing Date</label>
                {edit
                    ? <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} />
                    : <span>{fmt(event.closingDate)}</span>}

                <label>Length (meters)</label>
                {edit
                    ? <input type="number" value={lengthMeters} onChange={e => setLengthMeters(Number(e.target.value))} />
                    : <span>{event.lengthMeters?.toLocaleString()} m</span>}

                <label>Description</label>
                {edit
                    ? <textarea value={description} onChange={e => setDescription(e.target.value)} />
                    : <span>{event.description || "—"}</span>}
            </div>

            {err && <p style={{ color: "crimson", marginTop: 8 }}>{err}</p>}
        </section>
    );
}