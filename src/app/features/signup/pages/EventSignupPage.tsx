import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc } from "../../events/types";
import { listEvents } from "../../events/api/events";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import type { BoatSize } from "../types";
import { createBoat, listBoatsForEvent } from "../api/boats";

export default function EventSignupPage() {
    const { user } = useMockAuth(); // DEV_MODE rower will use this
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [boats, setBoats] = useState<any[]>([]);

    const [clubName, setClubName] = useState("Z12 RC");
    const [boatSize, setBoatSize] = useState<BoatSize>(1);
    const [category, setCategory] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");

    const [loadingEvents, setLoadingEvents] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Load events
    useEffect(() => {
        (async () => {
            setLoadingEvents(true);
            const e = await listEvents();
            // only open events for sign-up
            const open = e.filter((x) => x.status === "open");
            setEvents(open);
            setSelectedEventId(open[0]?.id ?? "");
            setLoadingEvents(false);
        })();
    }, []);

    const selectedEvent = useMemo(
        () => events.find((e) => e.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    // When event changes, load boats already registered
    useEffect(() => {
        if (!selectedEventId) return;
        (async () => {
            setLoadingBoats(true);
            const b = await listBoatsForEvent(selectedEventId);
            setBoats(b);
            setLoadingBoats(false);
        })();
    }, [selectedEventId]);

    // default category when event changes
    useEffect(() => {
        if (selectedEvent && selectedEvent.categories.length > 0) {
            setCategory(selectedEvent.categories[0]);
        }
    }, [selectedEventId]);

    const canCreate = !!user && !!selectedEvent && clubName.trim().length > 1 && category;

    async function onCreateBoat() {
        if (!user || !selectedEvent) return;

        setErr(null);
        setBusy(true);
        try {
            // invite support for future: for now just store email if boat > 1
            const invites =
                boatSize === 1 ? [] : inviteEmail.trim() ? [inviteEmail.trim()] : [];

            await createBoat({
                eventId: selectedEvent.id!,
                category,
                clubName,
                boatSize,
                rowerUids: [user.uid],
                invitedEmails: invites,
            });

            // refresh list
            const b = await listBoatsForEvent(selectedEvent.id!);
            setBoats(b);

            setInviteEmail("");
            alert("Signed up boat!");
        } catch (e: any) {
            setErr(e?.message ?? "Failed to sign up");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <h1>Event Sign-Up</h1>
                <p>Choose an event, select your category, and register your boat.</p>

                {loadingEvents ? (
                    <p>Loading events…</p>
                ) : events.length === 0 ? (
                    <p>No open events available right now.</p>
                ) : (
                    <>
                        <label>
                            Event
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                            >
                                {events.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} ({e.location})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedEvent && (
                            <>
                                <label>
                                    Category
                                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                        {selectedEvent.categories.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Club Name
                                    <input value={clubName} onChange={(e) => setClubName(e.target.value)} />
                                </label>

                                <label>
                                    Boat Size
                                    <select
                                        value={boatSize}
                                        onChange={(e) => setBoatSize(Number(e.target.value) as BoatSize)}
                                    >
                                        <option value={1}>Single (1x)</option>
                                        <option value={2}>Double (2x)</option>
                                        <option value={4}>Quad (4x)</option>
                                        <option value={8}>Eight (8+)</option>
                                    </select>
                                </label>

                                {boatSize !== 1 && (
                                    <label>
                                        Invite teammate email (optional for now)
                                        <input
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="friend@email.com"
                                        />
                                    </label>
                                )}

                                {err && <p style={{ color: "crimson" }}>{err}</p>}

                                <button disabled={!canCreate || busy} onClick={onCreateBoat} style={{ marginTop: 12 }}>
                                    {busy ? "Signing up..." : "Register Boat"}
                                </button>

                                <hr style={{ margin: "18px 0" }} />

                                <h2>Registered Boats (this event)</h2>
                                {loadingBoats ? (
                                    <p>Loading boats…</p>
                                ) : boats.length === 0 ? (
                                    <p>No boats registered yet.</p>
                                ) : (
                                    <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                        {boats.map((b) => (
                                            <li
                                                key={b.id}
                                                style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}
                                            >
                                                <b>
                                                    {b.clubName} • {b.category}
                                                </b>
                                                <div>Boat size: {b.boatSize}</div>
                                                <div>Invites: {b.invitedEmails?.length ? b.invitedEmails.join(", ") : "None"}</div>
                                                <div>Bow: {b.bowNumber ?? "Not assigned yet"}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
