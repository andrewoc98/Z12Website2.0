import { useState } from "react";

export default function EventHeaderEditor({ event }: any) {

    const [edit, setEdit] = useState(false);
    const [draft, setDraft] = useState(event);

    const update = (key: string, value: any) => {
        setDraft((prev:any) => ({ ...prev, [key]: value }));
    };

    const save = () => {
        // TODO: call API updateEvent(draft)
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
                        <button onClick={save}>Save</button>
                        <button onClick={() => setEdit(false)}>Cancel</button>
                    </>
                )}
            </div>

            <div className="event-grid">

                <label>Name</label>
                {edit
                    ? <input value={draft.name} onChange={e => update("name", e.target.value)} />
                    : <span>{event.name}</span>
                }

                <label>Location</label>
                {edit
                    ? <input value={draft.location} onChange={e => update("location", e.target.value)} />
                    : <span>{event.location}</span>
                }

                <label>Start Date</label>
                {edit
                    ? <input type="date" value={draft.startDate?.slice(0,10)} onChange={e => update("startDate", e.target.value)} />
                    : <span>{event.startDate}</span>
                }

                <label>End Date</label>
                {edit
                    ? <input type="date" value={draft.endDate?.slice(0,10)} onChange={e => update("endDate", e.target.value)} />
                    : <span>{event.endDate}</span>
                }

                <label>Description</label>
                {edit
                    ? <textarea value={draft.description || ""} onChange={e => update("description", e.target.value)} />
                    : <span>{event.description}</span>
                }

            </div>

        </section>
    );
}