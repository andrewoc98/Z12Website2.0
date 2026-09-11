import {useState} from "react";
import { dateInputToTimestampStartOfDay, dateInputToTimestampEndOfDay, updateEvent } from "../../../api/events";
import { isErgEvent } from "../../../lib/categories";
import { hasClosingDate } from "../../../lib/registration";

interface Props {
    event: any;
    onSaved?: (updated: any) => void;
}

export default function EventHeaderEditor({ event, onSaved }: Props) {

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
    const [noClosingDate, setNoClosingDate] = useState<boolean>(() => !hasClosingDate(event));
    const [lengthMeters, setLengthMeters] = useState<number>(event.lengthMeters ?? 0);

    // Indoor events never have a deadline of their own — entering and posting a
    // score share one window — so the choice is not offered there.
    const erg = isErgEvent(event);

    const resetDraft = () => {
        setName(event.name ?? "");
        setLocation(event.location ?? "");
        setDescription(event.description ?? "");
        setStartDate(toDateInput(event.startDate));
        setEndDate(toDateInput(event.endDate));
        setClosingDate(toDateInput(event.closingDate));
        setNoClosingDate(!hasClosingDate(event));
        setLengthMeters(event.lengthMeters ?? 0);
    };

    const save = async () => {
        setErr(null);
        setBusy(true);

        try {
            const startAt = dateInputToTimestampStartOfDay(startDate);
            const endAt   = dateInputToTimestampEndOfDay(endDate);
            // No deadline means entries run to the end of the event, stored as
            // closeAt = endAt so every date-driven consumer keeps working.
            const deadlineless = erg || noClosingDate;
            const closeAt = deadlineless ? endAt : dateInputToTimestampEndOfDay(closingDate);

            if (endAt.toMillis() < startAt.toMillis()) {
                throw new Error("End date must be on or after start date.");
            }
            if (!deadlineless && !closingDate) {
                throw new Error("Set a closing date, or tick “No closing date”.");
            }
            if (!deadlineless && closeAt.toMillis() > startAt.toMillis()) {
                throw new Error("Registration closing date must be before the start date.");
            }

            // The host's manual switch outranks the dates, so it decides the
            // stored status unless the event is already running or over.
            const now = Date.now();
            const manual: boolean | undefined = event.registrationOpen;
            const status: "open" | "closed" | "running" | "finished" =
                now > endAt.toMillis()    ? "finished" :
                now >= startAt.toMillis() ? "running"  :
                manual === false          ? "closed"   :
                manual === true           ? "open"     :
                now > closeAt.toMillis()  ? "closed"   :
                                            "open";

            const updates = {
                name: name.trim(),
                location: location.trim(),
                description: description.trim(),
                startAt,
                endAt,
                closeAt,
                noClosingDate: deadlineless && !erg,
                lengthMeters: Number(lengthMeters),
                status,
            };

            await updateEvent(event.id, updates);
            // The parent holds a mapped EventDoc (ISO strings), not the raw
            // document, so hand back that shape rather than the Timestamps.
            onSaved?.({
                ...event,
                name: updates.name,
                location: updates.location,
                description: updates.description,
                startDate: startAt.toDate().toISOString(),
                endDate: endAt.toDate().toISOString(),
                closingDate: closeAt.toDate().toISOString(),
                noClosingDate: updates.noClosingDate,
                lengthMeters: updates.lengthMeters,
                status,
            });
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
            <div className="flex justify-between items-center mb-4">
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

            <div className="grid grid-cols-[150px_1fr] gap-[10px] max-[700px]:grid-cols-1">
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
                    ? (erg
                        ? <span>When the event ends</span>
                        : (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="date"
                                    value={closingDate}
                                    onChange={e => setClosingDate(e.target.value)}
                                    disabled={noClosingDate}
                                />
                                <label className="flex items-center gap-2 text-[13px]">
                                    <input
                                        type="checkbox"
                                        checked={noClosingDate}
                                        onChange={e => {
                                            setNoClosingDate(e.target.checked);
                                            if (e.target.checked) setClosingDate("");
                                        }}
                                        className="w-4 h-4 m-0"
                                    />
                                    No closing date — entries stay open until you close them
                                </label>
                            </div>
                        ))
                    : <span>{hasClosingDate(event) ? fmt(event.closingDate) : "No closing date"}</span>}

                <label>Length (meters)</label>
                {edit
                    ? <input type="number" value={lengthMeters} onChange={e => setLengthMeters(Number(e.target.value))} />
                    : <span>{event.lengthMeters?.toLocaleString()} m</span>}

                <label>Description</label>
                {edit
                    ? <textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px] bg-surface-2 border border-border text-text rounded-[6px] p-2" />
                    : <span>{event.description || "—"}</span>}
            </div>

            {err && <p className="text-danger mt-2">{err}</p>}
        </section>
    );
}
