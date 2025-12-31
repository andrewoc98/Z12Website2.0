import { useEffect, useMemo, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc } from "../types";
import { listEvents, updateEvent } from "../api/events";
import { listBoatsForEvent, assignBowNumbersForEvent } from "../../signup/api/boats";
import { DEV_MODE } from "../../../shared/lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";
import { useAuth } from "../../../providers/AuthProvider";

type BoatLite = {
    id: string;
    clubName: string;
    category: string;
    boatSize: number;
    bowNumber?: number;
    createdAt?: number;
};

export default function HostEventManagePage() {
    // Host identity (mock vs firebase)
    const mock = DEV_MODE ? useMockAuth() : null;
    const fb = !DEV_MODE ? useAuth() : null;

    const hostUid = DEV_MODE ? mock?.user?.uid ?? null : fb?.user?.uid ?? null;

    const [events, setEvents] = useState<EventDoc[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [boats, setBoats] = useState<BoatLite[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const selectedEvent = useMemo(
        () => events.find((e) => e.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    async function refreshEvents(preserveId?: string) {
        const all = await listEvents();
        const mine = hostUid ? all.filter((e) => e.hostId === hostUid) : [];
        setEvents(mine);

        const nextId = preserveId || selectedEventId || mine[0]?.id || "";
        setSelectedEventId(nextId);
        return nextId;
    }

    async function refreshBoats(eventId: string) {
        console.log("Fetching boats for eventId:", eventId);
        const b = await listBoatsForEvent(eventId);
        console.log("Boats found:", b);
        setBoats(b as any);
    }

    async function refreshAll(preserveId?: string) {
        setMsg(null);
        const id = await refreshEvents(preserveId);
        if (id) await refreshBoats(id);
        else setBoats([]);
    }

    useEffect(() => {
        refreshAll();
    }, [hostUid]);

    useEffect(() => {
        if (!selectedEventId) return;
        refreshBoats(selectedEventId);
    }, [selectedEventId]);

    const categoryCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const b of boats) map.set(b.category, (map.get(b.category) ?? 0) + 1);
        return map;
    }, [boats]);

    const boatsSorted = useMemo(() => {
        // If bows assigned, sort by bow; otherwise by createdAt
        const hasAnyBow = boats.some((b) => typeof b.bowNumber === "number");
        const copy = boats.slice();
        if (hasAnyBow) {
            copy.sort((a, b) => (a.bowNumber ?? 999999) - (b.bowNumber ?? 999999));
        } else {
            copy.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        }
        return copy;
    }, [boats]);

    async function onAssignBows() {
        if (!selectedEvent) return;
        setBusy(true);
        setMsg(null);
        try {
            await assignBowNumbersForEvent(selectedEvent.id!, selectedEvent.categories);
            await refreshBoats(selectedEvent.id!);
            setMsg("Assigned bow numbers (unique across event).");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to assign bow numbers.");
        } finally {
            setBusy(false);
        }
    }

    async function onCloseRegistration() {
        if (!selectedEvent) return;
        setBusy(true);
        setMsg(null);
        try {
            // Ensure bows exist before closing (common real-world requirement)
            await assignBowNumbersForEvent(selectedEvent.id!, selectedEvent.categories);
            await updateEvent(selectedEvent.id!, { status: "closed" });
            await refreshAll(selectedEvent.id!);
            setMsg("Closed registration and ensured bow numbers are assigned.");
        } catch (e: any) {
            setMsg(e?.message ?? "Failed to close registration.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <h1>Manage Event (Host)</h1>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    <div>selectedEventId: <b>{selectedEventId || "—"}</b></div>
                    <div>boats loaded: <b>{boats.length}</b></div>
                </div>

                {!hostUid ? (
                    <p>Not signed in as a host.</p>
                ) : events.length === 0 ? (
                    <p>No events found for this host yet.</p>
                ) : (
                    <>
                        <label>
                            Event
                            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                                {events.map((e) => (
                                    <option key={e.id ?? e.name} value={e.id ?? ""}>
                                    {e.name} ({e.status})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedEvent && (
                            <>
                                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                                    <div><b>Status:</b> {selectedEvent.status}</div>
                                    <div><b>Location:</b> {selectedEvent.location}</div>
                                    <div><b>Dates:</b> {selectedEvent.startDate} → {selectedEvent.endDate}</div>
                                    <div><b>Closes:</b> {selectedEvent.closingDate}</div>
                                    <div><b>Length:</b> {selectedEvent.lengthMeters}m</div>
                                </div>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                                    <button disabled={busy} onClick={onAssignBows}>
                                        {busy ? "Working..." : "Assign Bow Numbers"}
                                    </button>

                                    <button
                                        disabled={busy || selectedEvent.status === "closed"}
                                        onClick={onCloseRegistration}
                                    >
                                        {selectedEvent.status === "closed" ? "Registration Closed" : "Close Registration"}
                                    </button>

                                    <button disabled={busy} onClick={() => refreshAll(selectedEvent.id!)}>
                                        Refresh
                                    </button>
                                </div>

                                {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

                                <hr style={{ margin: "18px 0" }} />

                                <h2>Boats Summary</h2>
                                {selectedEvent.categories.length === 0 ? (
                                    <p>No categories defined for this event.</p>
                                ) : (
                                    <ul>
                                        {selectedEvent.categories.map((c) => (
                                            <li key={c}>
                                                {c}: <b>{categoryCounts.get(c) ?? 0}</b>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <h2 style={{ marginTop: 18 }}>Boats</h2>
                                {boatsSorted.length === 0 ? (
                                    <p>No boats registered yet.</p>
                                ) : (
                                    <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                        {boatsSorted.map((b) => (
                                            <li key={b.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                    <b>{b.clubName}</b>
                                                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                            Bow: {b.bowNumber ?? "—"}
                          </span>
                                                </div>
                                                <div style={{ opacity: 0.9 }}>{b.category}</div>
                                                <div style={{ opacity: 0.8 }}>Boat size: {b.boatSize}</div>
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
